import { NextRequest } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { getAgentKey } from "@/lib/agent-keys";
import { getRedis, FEED_KEY, genKey, rateLimitKey, ownerFeedKey, STATS_GRANTED, STATS_DENIED, STATS_AGENTS } from "@/lib/redis";
import { generateImage } from "@/lib/genapi";
import { uploadBuffer } from "@/lib/blob";

const RATE_LIMIT = 3;
const RATE_WINDOW = 60;

const WORLD_ID_VALIDATOR = "0x1258F013d1BA690Dc73EA89Fd48F86E86AD0f124" as const;
const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

const verifyAbi = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function isHumanVerified(uint256 agentId) view returns (bool)",
]);

function getPublicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
  });
}

function sse(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shorten(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export async function POST(request: NextRequest) {
  let body: { prompt?: string; agentId?: string; ownerAddress?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { prompt, agentId, ownerAddress } = body;
  if (!prompt || !agentId || !ownerAddress) {
    return new Response(JSON.stringify({ error: "Missing prompt, agentId, or ownerAddress" }), { status: 400 });
  }

  const cleanPrompt = prompt.slice(0, 500).trim();
  if (!cleanPrompt) {
    return new Response(JSON.stringify({ error: "Empty prompt" }), { status: 400 });
  }

  // Resolve agent wallet address for display
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
        // Rate limit
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

        // ── x402 Flow: Agent operates autonomously ──

        // 1. Agent sends initial request (no payment)
        send({ type: "step", stepId: "agent", status: "active" });
        send({ type: "terminal", tag: "AGENT", message: `Agent #${agentId} received task: "${cleanPrompt.slice(0, 50)}${cleanPrompt.length > 50 ? "..." : ""}"`, termStatus: "info" });
        await delay(300);
        send({ type: "terminal", tag: "AGENT", message: `POST /api/generate { prompt, agentId: ${agentId}, type: "image" }`, termStatus: "info" });
        await delay(200);
        send({ type: "step", stepId: "agent", status: "pass", detail: "Request sent", timing: 500 });

        // 2. Gateway returns 402 Payment Required
        send({ type: "step", stepId: "x402", status: "active" });
        send({ type: "terminal", tag: "x402", message: "\u2190 402 Payment Required", termStatus: "warn" });
        await delay(300);
        send({ type: "terminal", tag: "x402", message: `PaymentRequirements: $0.10 USDC via EIP-3009 (Base Sepolia)`, termStatus: "info" });
        send({ type: "terminal", tag: "x402", message: `Asset: USDC (${shorten(USDC_ADDRESS)}) | PayTo: Gateway`, termStatus: "info" });
        await delay(400);

        // 3. Agent signs EIP-3009 authorization (off-chain, no gas)
        send({ type: "terminal", tag: "x402", message: `Signing: ${agentShort} \u2192 Gateway ($0.10 USDC)`, termStatus: "info" });
        await delay(300);
        send({ type: "terminal", tag: "x402", message: "EIP-3009 transferWithAuthorization signed (off-chain, no gas, no MetaMask)", termStatus: "pass" });
        send({ type: "step", stepId: "x402", status: "pass", detail: "EIP-3009 signed", timing: 1000 });

        // 4. Agent re-sends with X-PAYMENT header
        send({ type: "step", stepId: "gateway", status: "active" });
        send({ type: "terminal", tag: "AGENT", message: "Re-sending request with X-PAYMENT header...", termStatus: "info" });
        await delay(300);
        send({ type: "terminal", tag: "GW", message: "X-PAYMENT received, forwarding to Facilitator for verification", termStatus: "info" });
        await delay(400);
        send({ type: "step", stepId: "gateway", status: "pass", detail: "Payment attached", timing: 700 });

        // 5. Facilitator verifies payment
        send({ type: "step", stepId: "cre", status: "active" });
        send({ type: "terminal", tag: "VERIFY", message: "Facilitator: POST /verify \u2014 checking EIP-3009 signature...", termStatus: "info" });
        await delay(500);
        send({ type: "terminal", tag: "VERIFY", message: "Facilitator: { isValid: true } \u2014 payment authorized", termStatus: "pass" });
        send({ type: "step", stepId: "cre", status: "pass", detail: "Payment valid", timing: 500 });

        // 6. On-chain gate checks (REAL)
        send({ type: "step", stepId: "gate1", status: "active" });
        send({ type: "terminal", tag: "GATE 1", message: `Identity: ownerOf(${agentId}) \u2192 ...`, termStatus: "info" });

        let humanVerified = false;
        let ownerAddr = "0x0000000000000000000000000000000000000000";
        try {
          const client = getPublicClient();
          const [o, h] = await Promise.all([
            client.readContract({
              address: IDENTITY_REGISTRY,
              abi: verifyAbi,
              functionName: "ownerOf",
              args: [BigInt(agentId)],
            }) as Promise<string>,
            client.readContract({
              address: WORLD_ID_VALIDATOR,
              abi: verifyAbi,
              functionName: "isHumanVerified",
              args: [BigInt(agentId)],
            }) as Promise<boolean>,
          ]);
          ownerAddr = o;
          humanVerified = h;
        } catch {
          // RPC failure — treat as unregistered
        }

        if (ownerAddr === "0x0000000000000000000000000000000000000000") {
          send({ type: "step", stepId: "gate1", status: "fail", detail: "NOT REGISTERED", timing: 400 });
          send({ type: "terminal", tag: "GATE 1", message: "Identity: agent not registered \u2014 payment not settled, signature expires", termStatus: "fail" });
          send({ type: "result", status: "denied", reason: "Agent not registered" });
          send({ type: "done" });
          controller.close();
          return;
        }

        send({ type: "step", stepId: "gate1", status: "pass", detail: shorten(ownerAddr), timing: 400 });
        send({ type: "terminal", tag: "GATE 1", message: `Identity: ownerOf(${agentId}) \u2192 ${shorten(ownerAddr)} (registered)`, termStatus: "pass" });

        // Gate 2: Human verification
        send({ type: "step", stepId: "gate2", status: "active" });
        send({ type: "terminal", tag: "GATE 2", message: `Human: isHumanVerified(${agentId}) \u2192 ...`, termStatus: "info" });
        await delay(300);

        if (!humanVerified) {
          send({ type: "step", stepId: "gate2", status: "fail", detail: "NOT VERIFIED", timing: 300 });
          send({ type: "terminal", tag: "GATE 2", message: "Human: not verified \u2014 payment not settled, signature expires", termStatus: "fail" });

          const genId = crypto.randomUUID();
          const deniedEntry = {
            id: genId, prompt: cleanPrompt, imageUrl: "", status: "denied",
            agentId, ownerAddress: ownerAddress.toLowerCase(),
            humanVerified: "false", tier: "2", reason: "Agent not human-verified",
            timestamp: String(Date.now()),
          };
          await redis.hset(genKey(genId), deniedEntry);
          await redis.zadd(FEED_KEY, { score: Number(deniedEntry.timestamp), member: genId });
          await redis.incr(STATS_DENIED);
          await redis.sadd(STATS_AGENTS, agentId);

          send({ type: "result", status: "denied", reason: "Agent not human-verified", id: genId });
          send({ type: "done" });
          controller.close();
          return;
        }

        send({ type: "step", stepId: "gate2", status: "pass", detail: "Human verified", timing: 300 });
        send({ type: "terminal", tag: "GATE 2", message: `Human: isHumanVerified(${agentId}) \u2192 true`, termStatus: "pass" });

        // Gates 3 & 4: skip for Tier 2 (image)
        send({ type: "step", stepId: "gate3", status: "active" });
        send({ type: "terminal", tag: "GATE 3", message: "KYC: StripeKYCValidator \u2014 not required for image generation (Tier 2)", termStatus: "info" });
        await delay(150);
        send({ type: "step", stepId: "gate3", status: "pass", detail: "Not required", timing: 150 });

        send({ type: "step", stepId: "gate4", status: "active" });
        send({ type: "terminal", tag: "GATE 4", message: "Credit: PlaidCreditValidator \u2014 not required for image generation (Tier 2)", termStatus: "info" });
        await delay(150);
        send({ type: "step", stepId: "gate4", status: "pass", detail: "Not required", timing: 150 });

        // 7. On-chain settlement
        send({ type: "step", stepId: "don", status: "active" });
        send({ type: "terminal", tag: "SETTLE", message: "Facilitator: POST /settle \u2014 executing transferWithAuthorization", termStatus: "info" });
        await delay(600);
        const fakeTxHash = `0x${crypto.randomUUID().replace(/-/g, "").slice(0, 40)}`;
        send({ type: "terminal", tag: "SETTLE", message: `txHash: ${fakeTxHash.slice(0, 14)}...`, termStatus: "info" });
        await delay(300);
        send({ type: "terminal", tag: "SETTLE", message: `$0.10 USDC transferred (${agentShort} \u2192 Gateway)`, termStatus: "pass" });
        send({ type: "step", stepId: "don", status: "pass", detail: "$0.10 settled", timing: 900 });

        // 8. Asset Generation (REAL)
        send({ type: "step", stepId: "ace", status: "active" });
        const jobId = `j_${crypto.randomUUID().slice(0, 8)}`;
        send({ type: "terminal", tag: "GEN", message: `Job ${jobId} started \u2014 generating image via SDXL...`, termStatus: "info" });

        const genId = crypto.randomUUID();
        let imageUrl: string | undefined;

        try {
          const result = await generateImage(cleanPrompt, (status) => {
            if (status === "processing") {
              send({ type: "terminal", tag: "GEN", message: "GPU processing...", termStatus: "info" });
            }
          });
          send({ type: "terminal", tag: "GEN", message: "Image generated", termStatus: "pass" });
          send({ type: "step", stepId: "ace", status: "pass", detail: "Image ready", timing: 3000 });

          // Upload to Vercel Blob
          send({ type: "terminal", tag: "UPLOAD", message: "Uploading to permanent storage...", termStatus: "info" });
          const ext = result.contentType.includes("webp") ? "webp" : "png";
          imageUrl = await uploadBuffer(result.buffer, `generations/${genId}.${ext}`, result.contentType);
          send({ type: "terminal", tag: "UPLOAD", message: "Stored permanently", termStatus: "pass" });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Generation failed";
          send({ type: "terminal", tag: "GEN", message: `Generation failed: ${msg}`, termStatus: "fail" });
          send({ type: "step", stepId: "ace", status: "fail", detail: "Gen failed" });

          const deniedEntry = {
            id: genId, prompt: cleanPrompt, imageUrl: "", status: "denied",
            agentId, ownerAddress: ownerAddress.toLowerCase(),
            humanVerified: "true", tier: "2", reason: msg,
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
        }

        // 9. Record license plate in feed
        send({ type: "step", stepId: "result", status: "active" });
        send({ type: "terminal", tag: "LEDGER", message: "Recording license plate in feed...", termStatus: "info" });

        const entry = {
          id: genId, prompt: cleanPrompt, imageUrl: imageUrl || "", status: "granted",
          agentId, ownerAddress: ownerAddress.toLowerCase(),
          humanVerified: "true", tier: "2", reason: "",
          timestamp: String(Date.now()),
        };
        await redis.hset(genKey(genId), entry);
        await redis.zadd(FEED_KEY, { score: Number(entry.timestamp), member: genId });
        await redis.zadd(ownerFeedKey(ownerAddress), { score: Number(entry.timestamp), member: genId });
        await redis.incr(STATS_GRANTED);
        await redis.sadd(STATS_AGENTS, agentId);

        send({ type: "terminal", tag: "LEDGER", message: `License plate issued: ${genId.slice(0, 8)}...`, termStatus: "pass" });
        send({ type: "terminal", tag: "x402", message: "Payment finalized \u2014 agent balance updated", termStatus: "pass" });
        send({ type: "step", stepId: "result", status: "pass", detail: "Tier 2: Image" });

        // Final result
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
