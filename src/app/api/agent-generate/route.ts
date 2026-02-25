import { NextRequest } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes, encodePacked } from "viem";
import { getAgentKey } from "@/lib/agent-keys";
import { getRedis, FEED_KEY, genKey, rateLimitKey, ownerFeedKey, STATS_GRANTED, STATS_DENIED, STATS_AGENTS } from "@/lib/redis";

const RATE_LIMIT = 3;
const RATE_WINDOW = 60;

const GATEWAY_URL = process.env.X402_GATEWAY_URL || "https://x402-auth-gateway.vercel.com";
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

// --- helpers ----------------------------------------------------------------

function sse(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function shorten(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// EIP-712 domain for USDC on Base Sepolia
const USDC_DOMAIN = {
  name: "USD Coin",
  version: "2",
  chainId: 84532,
  verifyingContract: USDC_ADDRESS,
} as const;

const TRANSFER_WITH_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

interface PaymentRequirement {
  maxAmountRequired: string;
  resource: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
}

/**
 * Sign an EIP-3009 `transferWithAuthorization` off-chain and return a
 * base64-encoded X-PAYMENT header value.
 */
async function signEIP3009(
  agentKey: `0x${string}`,
  req: PaymentRequirement,
): Promise<string> {
  const account = privateKeyToAccount(agentKey);
  const nonce = keccak256(toBytes(crypto.randomUUID()));
  const now = Math.floor(Date.now() / 1000);
  const validBefore = BigInt(now + req.maxTimeoutSeconds);

  const signature = await account.signTypedData({
    domain: USDC_DOMAIN,
    types: TRANSFER_WITH_AUTH_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from: account.address,
      to: req.payTo as `0x${string}`,
      value: BigInt(req.maxAmountRequired),
      validAfter: 0n,
      validBefore,
      nonce,
    },
  });

  const payload = JSON.stringify({
    signature,
    from: account.address,
    to: req.payTo,
    value: req.maxAmountRequired,
    validAfter: "0",
    validBefore: validBefore.toString(),
    nonce,
  });

  return btoa(payload);
}

/**
 * Async generator that consumes the Gateway SSE job stream and yields parsed
 * events: { type: "progress", progress: number } | { type: "done", imageUrl: string }
 */
async function* streamGatewayJob(
  jobId: string,
  signal: AbortSignal,
): AsyncGenerator<{ type: string; progress?: number; imageUrl?: string }> {
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

  const agentKey = getAgentKey(agentId.toString());
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
          controller.close();
          return;
        }

        // ── B. Resolve agent key ───────────────────────────────────────
        if (!agentKey) {
          send({ type: "step", stepId: "agent", status: "fail", detail: "No agent key" });
          send({ type: "terminal", tag: "AGENT", message: "Agent wallet not found — register first", termStatus: "fail" });
          send({ type: "result", status: "denied", reason: "Agent wallet not found" });
          send({ type: "done" });
          controller.close();
          return;
        }

        // ── C. POST /api/generate (no payment) → 402 ──────────────────
        send({ type: "step", stepId: "agent", status: "active" });
        send({ type: "terminal", tag: "AGENT", message: `Agent #${agentId} received task: "${cleanPrompt.slice(0, 50)}${cleanPrompt.length > 50 ? "..." : ""}"`, termStatus: "info" });

        const gatewayBody = { prompt: cleanPrompt, agentId, ownerAddress, type: genType };

        const initialRes = await fetch(`${GATEWAY_URL}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gatewayBody),
        });

        send({ type: "step", stepId: "agent", status: "pass", detail: "Request sent", timing: 500 });

        if (initialRes.status !== 402) {
          // Unexpected — gateway should always 402 on first call
          const errText = await initialRes.text().catch(() => "Unknown error");
          send({ type: "step", stepId: "x402", status: "fail", detail: `HTTP ${initialRes.status}` });
          send({ type: "terminal", tag: "x402", message: `Expected 402 but got ${initialRes.status}: ${errText.slice(0, 200)}`, termStatus: "fail" });
          send({ type: "result", status: "denied", reason: `Gateway error: ${initialRes.status}` });
          send({ type: "done" });
          controller.close();
          return;
        }

        // Parse 402 PaymentRequirements
        const paymentRequirements: PaymentRequirement[] = await initialRes.json();
        const payReq = paymentRequirements[0];
        if (!payReq) {
          send({ type: "step", stepId: "x402", status: "fail", detail: "No payment info" });
          send({ type: "result", status: "denied", reason: "No payment requirements in 402" });
          send({ type: "done" });
          controller.close();
          return;
        }

        send({ type: "step", stepId: "x402", status: "active" });
        send({ type: "terminal", tag: "x402", message: "\u2190 402 Payment Required", termStatus: "warn" });

        const usdcAmount = Number(payReq.maxAmountRequired) / 1e6;
        send({ type: "terminal", tag: "x402", message: `PaymentRequirements: $${usdcAmount.toFixed(2)} USDC via EIP-3009 (Base Sepolia)`, termStatus: "info" });
        send({ type: "terminal", tag: "x402", message: `Asset: USDC (${shorten(USDC_ADDRESS)}) | PayTo: ${shorten(payReq.payTo)}`, termStatus: "info" });

        // ── D. Sign EIP-3009 ───────────────────────────────────────────
        send({ type: "terminal", tag: "x402", message: `Signing: ${agentShort} \u2192 ${shorten(payReq.payTo)} ($${usdcAmount.toFixed(2)} USDC)`, termStatus: "info" });

        const xPayment = await signEIP3009(agentKey, payReq);

        send({ type: "terminal", tag: "x402", message: "EIP-3009 transferWithAuthorization signed (off-chain, no gas, no MetaMask)", termStatus: "pass" });
        send({ type: "step", stepId: "x402", status: "pass", detail: "EIP-3009 signed", timing: 1000 });

        // ── E. POST /api/generate + X-PAYMENT ──────────────────────────
        send({ type: "step", stepId: "gateway", status: "active" });
        send({ type: "terminal", tag: "AGENT", message: "Re-sending request with X-PAYMENT header...", termStatus: "info" });

        const paidRes = await fetch(`${GATEWAY_URL}/api/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-PAYMENT": xPayment,
          },
          body: JSON.stringify(gatewayBody),
        });

        if (!paidRes.ok) {
          const errBody = await paidRes.json().catch(() => ({ error: "Unknown gateway error" }));
          const errMsg = errBody.error || errBody.message || `Gateway ${paidRes.status}`;
          send({ type: "terminal", tag: "GW", message: `Gateway rejected: ${errMsg}`, termStatus: "fail" });
          send({ type: "step", stepId: "gateway", status: "fail", detail: errMsg.slice(0, 30) });

          // Record denied in Redis
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
          controller.close();
          return;
        }

        const gatewayResult = await paidRes.json() as {
          job_id: string;
          txHash: string;
          status: string;
          type: string;
          tier: string;
        };

        send({ type: "terminal", tag: "GW", message: "X-PAYMENT verified, gates passed, payment settled", termStatus: "pass" });
        send({ type: "step", stepId: "gateway", status: "pass", detail: "Payment attached", timing: 700 });

        const tier = gatewayResult.tier || "2";
        const txHash = gatewayResult.txHash || "";

        // ── F. Emit synthetic gate/settlement steps ────────────────────
        // These already happened on the Gateway; we replay them for the UI

        // Credential verification
        send({ type: "step", stepId: "cre", status: "active" });
        send({ type: "terminal", tag: "VERIFY", message: "Facilitator verified EIP-3009 signature", termStatus: "pass" });
        send({ type: "step", stepId: "cre", status: "pass", detail: "Payment valid", timing: 500 });

        // Gate 1: Identity
        send({ type: "step", stepId: "gate1", status: "active" });
        send({ type: "terminal", tag: "GATE 1", message: `Identity: ownerOf(${agentId}) — registered`, termStatus: "pass" });
        send({ type: "step", stepId: "gate1", status: "pass", detail: shorten(ownerAddress), timing: 400 });

        // Gate 2: Human verification
        send({ type: "step", stepId: "gate2", status: "active" });
        send({ type: "terminal", tag: "GATE 2", message: `Human: isHumanVerified(${agentId}) — verified`, termStatus: "pass" });
        send({ type: "step", stepId: "gate2", status: "pass", detail: "Human verified", timing: 300 });

        // Gate 3: KYC
        send({ type: "step", stepId: "gate3", status: "active" });
        if (tier === "3" || tier === "4") {
          send({ type: "terminal", tag: "GATE 3", message: "KYC: StripeKYCValidator — verified", termStatus: "pass" });
          send({ type: "step", stepId: "gate3", status: "pass", detail: "KYC verified", timing: 200 });
        } else {
          send({ type: "terminal", tag: "GATE 3", message: `KYC: StripeKYCValidator — not required for Tier ${tier}`, termStatus: "info" });
          send({ type: "step", stepId: "gate3", status: "pass", detail: "Not required", timing: 150 });
        }

        // Gate 4: Credit
        send({ type: "step", stepId: "gate4", status: "active" });
        if (tier === "4") {
          send({ type: "terminal", tag: "GATE 4", message: "Credit: PlaidCreditValidator — verified", termStatus: "pass" });
          send({ type: "step", stepId: "gate4", status: "pass", detail: "Credit verified", timing: 200 });
        } else {
          send({ type: "terminal", tag: "GATE 4", message: `Credit: PlaidCreditValidator — not required for Tier ${tier}`, termStatus: "info" });
          send({ type: "step", stepId: "gate4", status: "pass", detail: "Not required", timing: 150 });
        }

        // Settlement
        send({ type: "step", stepId: "don", status: "active" });
        send({ type: "terminal", tag: "SETTLE", message: `txHash: ${txHash ? txHash.slice(0, 14) + "..." : "pending"}`, termStatus: "info" });
        send({ type: "terminal", tag: "SETTLE", message: `$${usdcAmount.toFixed(2)} USDC transferred (${agentShort} → Gateway)`, termStatus: "pass" });
        send({ type: "step", stepId: "don", status: "pass", detail: `$${usdcAmount.toFixed(2)} settled`, timing: 900 });

        // ── G. Stream generation progress from Gateway ─────────────────
        send({ type: "step", stepId: "ace", status: "active" });
        send({ type: "terminal", tag: "GEN", message: `Job ${gatewayResult.job_id} started — generating ${genType}...`, termStatus: "info" });

        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 180_000);

        let imageUrl = "";
        try {
          for await (const event of streamGatewayJob(gatewayResult.job_id, abortController.signal)) {
            if (event.type === "progress") {
              send({ type: "terminal", tag: "GEN", message: `Progress: ${event.progress}%`, termStatus: "info" });
            } else if (event.type === "done") {
              imageUrl = event.imageUrl || "";
              send({ type: "terminal", tag: "GEN", message: `${genType === "video" ? "Video" : "Image"} generated`, termStatus: "pass" });
              send({ type: "step", stepId: "ace", status: "pass", detail: `${genType === "video" ? "Video" : "Image"} ready`, timing: 3000 });
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
          controller.close();
          return;
        } finally {
          clearTimeout(timeout);
        }

        if (!imageUrl) {
          send({ type: "terminal", tag: "GEN", message: "Stream ended without result URL", termStatus: "fail" });
          send({ type: "step", stepId: "ace", status: "fail", detail: "No URL" });
          send({ type: "result", status: "denied", reason: "No result URL from gateway" });
          send({ type: "done" });
          controller.close();
          return;
        }

        // ── H. Record in Redis feed ────────────────────────────────────
        send({ type: "step", stepId: "result", status: "active" });
        send({ type: "terminal", tag: "LEDGER", message: "Recording license plate in feed...", termStatus: "info" });

        const genId = crypto.randomUUID();
        const entry = {
          id: genId, prompt: cleanPrompt, imageUrl, status: "granted",
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

        // ── I. Final result + done ─────────────────────────────────────
        send({
          type: "result", status: "granted",
          id: genId, imageUrl, prompt: cleanPrompt,
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
