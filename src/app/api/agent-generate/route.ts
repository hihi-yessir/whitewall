import { NextRequest } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { getAgentKey } from "@/lib/agent-keys";
import { USDC_ADDRESS } from "@/lib/contracts";
import { getRedis, FEED_KEY, genKey, rateLimitKey, ownerFeedKey, STATS_GRANTED, STATS_DENIED, STATS_AGENTS } from "@/lib/redis";

const RATE_LIMIT = 3;
const RATE_WINDOW = 60;

const GATEWAY_URL = process.env.X402_GATEWAY_URL || "https://x402-auth-gateway.onrender.com";
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

// --- helpers ----------------------------------------------------------------

function sse(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function shorten(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Build x402-wrapped fetch for a given agent key.
 * Uses dynamic import since @x402/* are ESM-only.
 */
async function buildPaymentFetch(agentKey: `0x${string}`) {
  const { wrapFetchWithPayment } = await import("@x402/fetch");
  const { x402Client } = await import("@x402/core/client");
  const { registerExactEvmScheme } = await import("@x402/evm/exact/client");
  const { toClientEvmSigner } = await import("@x402/evm");

  const account = privateKeyToAccount(agentKey);
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
  });

  const signer = toClientEvmSigner(account, publicClient);
  const client = new x402Client();
  registerExactEvmScheme(client, { signer });

  return { fetchWithPayment: wrapFetchWithPayment(fetch, client), signer: account };
}

/**
 * Consume the Gateway SSE job stream via fetch.
 * Yields parsed events: { status, type, artifact_url?, error? }
 */
async function* streamGatewayJob(
  jobId: string,
  signal: AbortSignal,
): AsyncGenerator<Record<string, unknown>> {
  const res = await fetch(`${GATEWAY_URL}/api/jobs/${jobId}/stream`, { signal });
  if (!res.ok || !res.body) {
    throw new Error(`Gateway stream failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          yield JSON.parse(raw);
        } catch { /* skip malformed */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// --- POST handler -----------------------------------------------------------

export async function POST(request: NextRequest) {
  let body: { prompt?: string; agentId?: string; ownerAddress?: string; type?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { prompt, agentId, ownerAddress, type: genType = "image" } = body;
  if (!prompt || !agentId || !ownerAddress) {
    return new Response(JSON.stringify({ error: "Missing prompt, agentId, or ownerAddress" }), { status: 400 });
  }

  const cleanPrompt = prompt.slice(0, 500).trim();
  if (!cleanPrompt) {
    return new Response(JSON.stringify({ error: "Empty prompt" }), { status: 400 });
  }

  const agentKey = await getAgentKey(agentId.toString());
  const agentAddr = agentKey ? privateKeyToAccount(agentKey).address : "0xAgent";
  const agentShort = shorten(agentAddr);

  const redis = getRedis();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sse(data)));
      };

      try {
        // ── A. Rate limit ──────────────────────────────────────────────
        const rlKey = rateLimitKey(ownerAddress.toLowerCase());
        const count = await redis.incr(rlKey);
        if (count === 1) await redis.expire(rlKey, RATE_WINDOW);
        if (count > RATE_LIMIT) {
          send({ type: "terminal", tag: "RATE", message: `Rate limit exceeded (${RATE_LIMIT}/min)`, termStatus: "fail" });
          send({ type: "result", status: "denied", reason: "Rate limit exceeded" });
          send({ type: "done" });
          return;
        }

        // ── B. Resolve agent key ───────────────────────────────────────
        if (!agentKey) {
          send({ type: "step", stepId: "agent", status: "fail", detail: "No agent key" });
          send({ type: "terminal", tag: "AGENT", message: "Agent wallet not found — register first", termStatus: "fail" });
          send({ type: "result", status: "denied", reason: "Agent wallet not found" });
          send({ type: "done" });
          return;
        }

        // ── C. Build x402 payment-wrapped fetch ────────────────────────
        send({ type: "step", stepId: "agent", status: "active" });
        send({ type: "terminal", tag: "AGENT", message: `Agent #${agentId} received task: "${cleanPrompt.slice(0, 50)}${cleanPrompt.length > 50 ? "..." : ""}"`, termStatus: "info" });

        const { fetchWithPayment, signer } = await buildPaymentFetch(agentKey);
        send({ type: "terminal", tag: "AGENT", message: `Agent wallet: ${shorten(signer.address)}`, termStatus: "info" });

        // Check agent wallet USDC balance before attempting payment
        const usdcBalance = await createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) }).readContract({
          address: USDC_ADDRESS,
          abi: [{ type: "function", name: "balanceOf", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" }],
          functionName: "balanceOf",
          args: [signer.address],
        }) as bigint;
        const usdcFormatted = (Number(usdcBalance) / 1e6).toFixed(2);
        send({ type: "terminal", tag: "AGENT", message: `USDC balance: ${usdcFormatted}`, termStatus: usdcBalance > 0n ? "info" : "fail" });
        console.log(`[agent-generate] Agent ${signer.address} USDC balance: ${usdcFormatted}`);

        if (usdcBalance === 0n) {
          send({ type: "step", stepId: "agent", status: "fail", detail: "0 USDC" });
          send({ type: "terminal", tag: "AGENT", message: "Agent wallet has 0 USDC — cannot pay gateway. Was the wallet funded?", termStatus: "fail" });
          send({ type: "result", status: "denied", reason: "Agent wallet has 0 USDC" });
          send({ type: "done" });
          return;
        }

        send({ type: "step", stepId: "agent", status: "pass", detail: `${usdcFormatted} USDC`, timing: 500 });

        // ── D. POST /api/generate with auto x402 payment ───────────────
        send({ type: "step", stepId: "x402", status: "active" });
        send({ type: "terminal", tag: "x402", message: "Sending request to gateway (x402 SDK handles 402 → sign → retry)...", termStatus: "info" });

        const gatewayBody = { prompt: cleanPrompt, agentId, ownerAddress, type: genType };

        const paidRes = await fetchWithPayment(`${GATEWAY_URL}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gatewayBody),
        });

        if (paidRes.status !== 202) {
          const errBody = await paidRes.json().catch(() => ({ error: "Unknown gateway error" }));
          const errMsg = (errBody as Record<string, string>).error || (errBody as Record<string, string>).message || `Gateway ${paidRes.status}`;
          send({ type: "step", stepId: "x402", status: "fail", detail: `HTTP ${paidRes.status}` });
          send({ type: "terminal", tag: "x402", message: `Gateway rejected: ${errMsg}`, termStatus: "fail" });

          const genId = crypto.randomUUID();
          const deniedEntry = {
            id: genId, prompt: cleanPrompt, imageUrl: "", status: "denied",
            agentId, ownerAddress: ownerAddress.toLowerCase(),
            humanVerified: "unknown", tier: "unknown", reason: errMsg,
            timestamp: String(Date.now()),
          };
          await redis.hset(genKey(genId), deniedEntry);
          await redis.zadd(FEED_KEY, { score: Number(deniedEntry.timestamp), member: genId });
          await redis.incr(STATS_DENIED);
          await redis.sadd(STATS_AGENTS, agentId);

          send({ type: "result", status: "denied", reason: errMsg, id: genId });
          send({ type: "done" });
          return;
        }

        const gatewayResult = await paidRes.json() as {
          jobId: string;
          txHash: string;
          status: string;
          type?: string;
          tier?: string;
        };

        const tier = gatewayResult.tier || "2";
        const txHash = gatewayResult.txHash || "";

        send({ type: "terminal", tag: "x402", message: "Payment verified + settled on-chain", termStatus: "pass" });
        send({ type: "terminal", tag: "x402", message: `txHash: ${txHash ? shorten(txHash) : "pending"}`, termStatus: "info" });
        send({ type: "step", stepId: "x402", status: "pass", detail: "Payment settled", timing: 1500 });

        // ── E. Emit synthetic gate steps (already passed on gateway) ────
        send({ type: "step", stepId: "gateway", status: "active" });
        send({ type: "terminal", tag: "GW", message: `Job ${gatewayResult.jobId} accepted — gates passed`, termStatus: "pass" });
        send({ type: "step", stepId: "gateway", status: "pass", detail: "Accepted", timing: 700 });

        // CRE / Gates
        send({ type: "step", stepId: "cre", status: "pass", detail: "Payment valid", timing: 500 });
        send({ type: "step", stepId: "gate1", status: "pass", detail: shorten(ownerAddress), timing: 400 });
        send({ type: "step", stepId: "gate2", status: "pass", detail: "Human verified", timing: 300 });
        send({ type: "step", stepId: "gate3", status: "pass", detail: tier === "3" || tier === "4" ? "KYC verified" : "Not required", timing: 200 });
        send({ type: "step", stepId: "gate4", status: "pass", detail: tier === "4" ? "Credit verified" : "Not required", timing: 150 });

        send({ type: "terminal", tag: "GATE", message: `All gates passed — Tier ${tier}`, termStatus: "pass" });

        // Settlement
        send({ type: "step", stepId: "don", status: "pass", detail: txHash ? `settled` : "pending", timing: 900 });
        send({ type: "terminal", tag: "SETTLE", message: `USDC transferred (${agentShort} → Gateway)`, termStatus: "pass" });

        // ── F. Stream generation progress from Gateway ─────────────────
        send({ type: "step", stepId: "ace", status: "active" });
        send({ type: "terminal", tag: "GEN", message: `Job ${gatewayResult.jobId} — generating ${genType}...`, termStatus: "info" });

        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 180_000);

        let artifactUrl = "";
        try {
          for await (const event of streamGatewayJob(gatewayResult.jobId, abortController.signal)) {
            const status = event.status as string;

            if (status === "processing") {
              send({ type: "terminal", tag: "GEN", message: `Processing ${genType}...`, termStatus: "info" });
            } else if (status === "completed") {
              artifactUrl = (event.artifact_url as string) || "";
              send({ type: "terminal", tag: "GEN", message: `${genType === "video" ? "Video" : "Image"} generated!`, termStatus: "pass" });
              send({ type: "step", stepId: "ace", status: "pass", detail: `${genType === "video" ? "Video" : "Image"} ready`, timing: 3000 });
              break;
            } else if (status === "failed") {
              throw new Error((event.error as string) || "Generation failed on gateway");
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Stream failed";
          send({ type: "terminal", tag: "GEN", message: `Generation failed: ${msg}`, termStatus: "fail" });
          send({ type: "step", stepId: "ace", status: "fail", detail: "Gen failed" });

          const genId = crypto.randomUUID();
          const deniedEntry = {
            id: genId, prompt: cleanPrompt, imageUrl: "", status: "denied",
            agentId, ownerAddress: ownerAddress.toLowerCase(),
            humanVerified: "true", tier, reason: msg,
            timestamp: String(Date.now()),
          };
          await redis.hset(genKey(genId), deniedEntry);
          await redis.zadd(FEED_KEY, { score: Number(deniedEntry.timestamp), member: genId });
          await redis.incr(STATS_DENIED);
          await redis.sadd(STATS_AGENTS, agentId);

          send({ type: "result", status: "denied", reason: msg, id: genId });
          send({ type: "done" });
          return;
        } finally {
          clearTimeout(timeout);
        }

        // If no artifact URL, try fetching it directly
        if (!artifactUrl && gatewayResult.jobId) {
          try {
            const artRes = await fetch(`${GATEWAY_URL}/api/artifacts/${gatewayResult.jobId}`);
            if (artRes.ok) {
              // The artifact endpoint might return a redirect or the URL
              artifactUrl = artRes.url || "";
            }
          } catch { /* ignore */ }
        }

        if (!artifactUrl) {
          send({ type: "terminal", tag: "GEN", message: "Stream ended without result URL", termStatus: "fail" });
          send({ type: "step", stepId: "ace", status: "fail", detail: "No URL" });
          send({ type: "result", status: "denied", reason: "No result URL from gateway" });
          send({ type: "done" });
          return;
        }

        // ── G. Record in Redis feed ────────────────────────────────────
        send({ type: "step", stepId: "result", status: "active" });
        send({ type: "terminal", tag: "LEDGER", message: "Recording license plate in feed...", termStatus: "info" });

        const genId = crypto.randomUUID();
        const entry = {
          id: genId, prompt: cleanPrompt, imageUrl: artifactUrl, status: "granted",
          agentId, ownerAddress: ownerAddress.toLowerCase(),
          humanVerified: "true", tier, reason: "",
          txHash,
          timestamp: String(Date.now()),
        };
        await redis.hset(genKey(genId), entry);
        await redis.zadd(FEED_KEY, { score: Number(entry.timestamp), member: genId });
        await redis.zadd(ownerFeedKey(ownerAddress), { score: Number(entry.timestamp), member: genId });
        await redis.incr(STATS_GRANTED);
        await redis.sadd(STATS_AGENTS, agentId);

        send({ type: "terminal", tag: "LEDGER", message: `License plate issued: ${genId.slice(0, 8)}...`, termStatus: "pass" });
        send({ type: "terminal", tag: "x402", message: "Payment finalized — agent balance updated", termStatus: "pass" });
        send({ type: "step", stepId: "result", status: "pass", detail: `Tier ${tier}: ${genType === "video" ? "Video" : "Image"}` });

        // ── H. Final result + done ─────────────────────────────────────
        send({
          type: "result", status: "granted",
          id: genId,
          imageUrl: artifactUrl,
          videoUrl: genType === "video" ? artifactUrl : undefined,
          prompt: cleanPrompt,
          agentId, ownerAddress: ownerAddress.toLowerCase(),
          timestamp: Number(entry.timestamp),
        });
        send({ type: "done" });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        send({ type: "terminal", tag: "ERROR", message: msg, termStatus: "fail" });
        send({ type: "result", status: "denied", reason: msg });
        send({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
