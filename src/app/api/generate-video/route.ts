import { NextRequest } from "next/server";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { getRedis, FEED_KEY, genKey, rateLimitKey, ownerFeedKey, STATS_GRANTED, STATS_DENIED, STATS_AGENTS } from "@/lib/redis";
import { generateVideo } from "@/lib/genapi";
import { uploadBuffer } from "@/lib/blob";

const RATE_LIMIT = 2;       // stricter for video
const RATE_WINDOW = 120;    // 2 minutes

const WORLD_ID_VALIDATOR = "0x1258F013d1BA690Dc73EA89Fd48F86E86AD0f124" as const;
const isHumanVerifiedAbi = [{
  type: "function",
  name: "isHumanVerified",
  inputs: [{ name: "agentId", type: "uint256" }],
  outputs: [{ name: "", type: "bool" }],
  stateMutability: "view",
}] as const;

function getPublicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
  });
}

function sse(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
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

  const redis = getRedis();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sse(data)));
      };

      try {
        // Rate limit
        send({ type: "terminal", tag: "RATE", message: `Checking rate limit for ${ownerAddress.slice(0, 8)}...`, termStatus: "info" });
        const rlKey = rateLimitKey(ownerAddress.toLowerCase());
        const count = await redis.incr(rlKey);
        if (count === 1) await redis.expire(rlKey, RATE_WINDOW);

        if (count > RATE_LIMIT) {
          send({ type: "terminal", tag: "RATE", message: `Rate limit exceeded (${RATE_LIMIT}/${RATE_WINDOW}s). Try again shortly.`, termStatus: "fail" });
          send({ type: "result", status: "denied", reason: "Rate limit exceeded" });
          send({ type: "done" });
          controller.close();
          return;
        }
        send({ type: "terminal", tag: "RATE", message: `Rate limit OK (${count}/${RATE_LIMIT})`, termStatus: "pass" });

        // On-chain verification
        send({ type: "terminal", tag: "VERIFY", message: `Checking on-chain verification for agent #${agentId}...`, termStatus: "info" });

        let humanVerified = false;
        try {
          const client = getPublicClient();
          humanVerified = await client.readContract({
            address: WORLD_ID_VALIDATOR,
            abi: isHumanVerifiedAbi,
            functionName: "isHumanVerified",
            args: [BigInt(agentId)],
          }) as boolean;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Verification check failed";
          send({ type: "terminal", tag: "VERIFY", message: `Verification lookup failed: ${msg}`, termStatus: "fail" });
        }

        if (!humanVerified) {
          send({ type: "terminal", tag: "VERIFY", message: `Agent #${agentId} is not human-verified on-chain`, termStatus: "fail" });

          const genId = crypto.randomUUID();
          const deniedEntry = {
            id: genId, prompt: cleanPrompt, imageUrl: "", status: "denied",
            agentId, ownerAddress: ownerAddress.toLowerCase(),
            humanVerified: "false", tier: "3", reason: "Agent is not human-verified",
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

        // Generate video
        send({ type: "terminal", tag: "GEN", message: `Video generation requested: "${cleanPrompt.slice(0, 60)}..."`, termStatus: "info" });
        send({ type: "terminal", tag: "GEN", message: "Submitting to LTX-Video (this may take 1-3 min)...", termStatus: "info" });

        const genId = crypto.randomUUID();
        let videoUrl: string | undefined;

        try {
          const result = await generateVideo(cleanPrompt, (status) => {
            if (status === "processing") {
              send({ type: "terminal", tag: "GEN", message: "GPU processing video frames...", termStatus: "info" });
            }
          });
          send({ type: "terminal", tag: "GEN", message: "Video generated successfully", termStatus: "pass" });

          send({ type: "terminal", tag: "BLOB", message: "Uploading to permanent storage...", termStatus: "info" });
          const ext = result.contentType.includes("webp") ? "webp" : "mp4";
          videoUrl = await uploadBuffer(result.buffer, `generations/${genId}.${ext}`, result.contentType);
          send({ type: "terminal", tag: "BLOB", message: "Video stored permanently", termStatus: "pass" });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Video generation failed";
          send({ type: "terminal", tag: "GEN", message: `Generation failed: ${msg}`, termStatus: "fail" });

          const deniedEntry = {
            id: genId, prompt: cleanPrompt, imageUrl: "", status: "denied",
            agentId, ownerAddress: ownerAddress.toLowerCase(),
            humanVerified: String(humanVerified), tier: "3", reason: msg,
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

        // Record in feed
        const entry = {
          id: genId, prompt: cleanPrompt, imageUrl: videoUrl || "", status: "granted",
          agentId, ownerAddress: ownerAddress.toLowerCase(),
          humanVerified: String(humanVerified), tier: "3", reason: "",
          timestamp: String(Date.now()),
        };
        await redis.hset(genKey(genId), entry);
        await redis.zadd(FEED_KEY, { score: Number(entry.timestamp), member: genId });
        await redis.zadd(ownerFeedKey(ownerAddress), { score: Number(entry.timestamp), member: genId });
        await redis.incr(STATS_GRANTED);
        await redis.sadd(STATS_AGENTS, agentId);

        send({ type: "terminal", tag: "LEDGER", message: `License plate issued: ${genId.slice(0, 8)}...`, termStatus: "pass" });

        send({
          type: "result", status: "granted",
          id: genId, videoUrl, prompt: cleanPrompt,
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
