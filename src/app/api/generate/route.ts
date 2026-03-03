import { NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { getRedis, FEED_KEY, genKey, rateLimitKey, ownerFeedKey, STATS_GRANTED, STATS_DENIED, STATS_AGENTS } from "@/lib/redis";
import { generateImage } from "@/lib/genapi";
import { uploadBuffer } from "@/lib/blob";
import { addresses, tieredPolicyAbi, worldIdValidatorAbi } from "@whitewall-os/sdk";

const RATE_LIMIT = 3;       // max per window
const RATE_WINDOW = 60;     // seconds

const addr = addresses.baseSepolia;

// Cache policy config (addresses don't change)
let worldIdValidatorAddr: string | null = null;

function getPublicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
  });
}

async function getWorldIdValidator(): Promise<string> {
  if (worldIdValidatorAddr) return worldIdValidatorAddr;
  const client = getPublicClient();
  worldIdValidatorAddr = await client.readContract({
    address: addr.tieredPolicy as `0x${string}`,
    abi: tieredPolicyAbi,
    functionName: "getWorldIdValidator",
  }) as string;
  return worldIdValidatorAddr;
}

function sse(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  // Sanitize prompt length
  const cleanPrompt = prompt.slice(0, 500).trim();
  if (!cleanPrompt) {
    return new Response(JSON.stringify({ error: "Empty prompt" }), { status: 400 });
  }

  const redis = getRedis();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sse(data)));
      };

      try {
        // Rate limit check
        send({ type: "terminal", tag: "RATE", message: `Checking rate limit for ${ownerAddress.slice(0, 8)}...`, termStatus: "info" });
        const rlKey = rateLimitKey(ownerAddress.toLowerCase());
        const count = await redis.incr(rlKey);
        if (count === 1) await redis.expire(rlKey, RATE_WINDOW);

        if (count > RATE_LIMIT) {
          send({ type: "terminal", tag: "RATE", message: `Rate limit exceeded (${RATE_LIMIT}/min). Try again shortly.`, termStatus: "fail" });
          send({ type: "result", status: "denied", reason: "Rate limit exceeded" });
          send({ type: "done" });
          controller.close();
          return;
        }
        send({ type: "terminal", tag: "RATE", message: `Rate limit OK (${count}/${RATE_LIMIT})`, termStatus: "pass" });

        // On-chain verification check
        send({ type: "terminal", tag: "VERIFY", message: `Checking on-chain verification for agent #${agentId}...`, termStatus: "info" });
        send({ type: "step", stepId: "verify", status: "active" });

        let humanVerified = false;
        try {
          const client = getPublicClient();
          const validatorAddr = await getWorldIdValidator();
          humanVerified = await client.readContract({
            address: validatorAddr as `0x${string}`,
            abi: worldIdValidatorAbi,
            functionName: "isHumanVerified",
            args: [BigInt(agentId)],
          }) as boolean;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Verification check failed";
          send({ type: "terminal", tag: "VERIFY", message: `Verification lookup failed: ${msg}`, termStatus: "fail" });
          send({ type: "step", stepId: "verify", status: "fail", detail: "RPC error" });
          // Treat RPC failure as unverified
        }

        if (!humanVerified) {
          send({ type: "terminal", tag: "VERIFY", message: `Agent #${agentId} is not human-verified on-chain`, termStatus: "fail" });
          send({ type: "step", stepId: "verify", status: "fail", detail: "Not verified" });

          const genId = crypto.randomUUID();
          const deniedEntry = {
            id: genId,
            prompt: cleanPrompt,
            imageUrl: "",
            status: "denied",
            agentId,
            ownerAddress: ownerAddress.toLowerCase(),
            humanVerified: "false",
            tier: "0",
            reason: "Agent is not human-verified",
            timestamp: String(Date.now()),
          };
          await redis.hset(genKey(genId), deniedEntry);
          await redis.zadd(FEED_KEY, { score: Number(deniedEntry.timestamp), member: genId });
          await redis.zadd(ownerFeedKey(ownerAddress), { score: Number(deniedEntry.timestamp), member: genId });
          await redis.incr(STATS_DENIED);
          await redis.sadd(STATS_AGENTS, agentId);

          send({ type: "result", status: "denied", reason: "Agent is not human-verified", id: genId });
          send({ type: "done" });
          controller.close();
          return;
        }

        send({ type: "terminal", tag: "VERIFY", message: `Agent #${agentId} is human-verified`, termStatus: "pass" });
        send({ type: "step", stepId: "verify", status: "pass", detail: "Verified" });

        // Pipeline simulation (abbreviated — the real pipeline already ran in step 5)
        send({ type: "terminal", tag: "RESOURCE", message: `Image generation requested: "${cleanPrompt.slice(0, 60)}${cleanPrompt.length > 60 ? "..." : ""}"`, termStatus: "info" });
        send({ type: "step", stepId: "agent", status: "active" });
        await delay(200);
        send({ type: "step", stepId: "agent", status: "pass", detail: "Prompt received" });

        send({ type: "step", stepId: "x402", status: "active" });
        send({ type: "terminal", tag: "x402", message: "Resource payment: $0.10 USDC for image generation", termStatus: "info" });
        await delay(300);
        send({ type: "step", stepId: "x402", status: "pass", detail: "$0.10 held", timing: 300 });

        // Generate image
        send({ type: "step", stepId: "gateway", status: "active" });
        send({ type: "terminal", tag: "GEN", message: "Generating image via SDXL...", termStatus: "info" });

        const genId = crypto.randomUUID();
        let imageUrl: string | undefined;

        try {
          const result = await generateImage(cleanPrompt, (status) => {
            if (status === "processing") {
              send({ type: "terminal", tag: "GEN", message: "GPU processing...", termStatus: "info" });
            }
          });
          send({ type: "terminal", tag: "GEN", message: "Image generated successfully", termStatus: "pass" });
          send({ type: "step", stepId: "gateway", status: "pass", detail: "Image ready", timing: 3000 });

          // Upload to Vercel Blob
          send({ type: "terminal", tag: "BLOB", message: "Uploading to permanent storage...", termStatus: "info" });
          const ext = result.contentType.includes("webp") ? "webp" : "png";
          imageUrl = await uploadBuffer(result.buffer, `generations/${genId}.${ext}`, result.contentType);
          send({ type: "terminal", tag: "BLOB", message: "Image stored permanently", termStatus: "pass" });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Image generation failed";
          send({ type: "terminal", tag: "GEN", message: `Generation failed: ${msg}`, termStatus: "fail" });
          send({ type: "step", stepId: "gateway", status: "fail", detail: "Gen failed" });

          // Store denied entry (use empty strings for absent fields — Redis hashes are string-only)
          const deniedEntry = {
            id: genId,
            prompt: cleanPrompt,
            imageUrl: "",
            status: "denied",
            agentId,
            ownerAddress: ownerAddress.toLowerCase(),
            humanVerified: String(humanVerified),
            tier: "2",
            reason: msg,
            timestamp: String(Date.now()),
          };
          await redis.hset(genKey(genId), deniedEntry);
          await redis.zadd(FEED_KEY, { score: Number(deniedEntry.timestamp), member: genId });
          await redis.zadd(ownerFeedKey(ownerAddress), { score: Number(deniedEntry.timestamp), member: genId });
          await redis.incr(STATS_DENIED);
          await redis.sadd(STATS_AGENTS, agentId);

          send({ type: "result", status: "denied", reason: msg, id: genId });
          send({ type: "done" });
          controller.close();
          return;
        }

        // Store metadata in Redis
        send({ type: "step", stepId: "cre", status: "active" });
        send({ type: "terminal", tag: "LEDGER", message: "Recording license plate in feed...", termStatus: "info" });

        // All values as strings — Redis hashes are string-only
        const entry = {
          id: genId,
          prompt: cleanPrompt,
          imageUrl: imageUrl || "",
          status: "granted",
          agentId,
          ownerAddress: ownerAddress.toLowerCase(),
          humanVerified: String(humanVerified),
          tier: "2",
          reason: "",
          timestamp: String(Date.now()),
        };
        await redis.hset(genKey(genId), entry);
        await redis.zadd(FEED_KEY, { score: Number(entry.timestamp), member: genId });
        await redis.zadd(ownerFeedKey(ownerAddress), { score: Number(entry.timestamp), member: genId });
        await redis.incr(STATS_GRANTED);
        await redis.sadd(STATS_AGENTS, agentId);

        send({ type: "step", stepId: "cre", status: "pass", detail: "Recorded", timing: 100 });
        send({ type: "terminal", tag: "LEDGER", message: `License plate issued: ${genId.slice(0, 8)}...`, termStatus: "pass" });
        send({ type: "terminal", tag: "x402", message: "$0.10 USDC payment finalized", termStatus: "pass" });

        // Final result
        send({
          type: "result",
          status: "granted",
          id: genId,
          imageUrl,
          prompt: cleanPrompt,
          agentId,
          ownerAddress: ownerAddress.toLowerCase(),
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
