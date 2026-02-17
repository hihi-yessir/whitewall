import { NextRequest } from "next/server";
import { getRedis, FEED_KEY, genKey, ownerFeedKey, STATS_GRANTED, STATS_DENIED, STATS_AGENTS } from "@/lib/redis";

export interface FeedEntry {
  id: string;
  prompt: string;
  imageUrl: string | null;
  status: "granted" | "denied";
  agentId: string;
  ownerAddress: string;
  humanVerified: boolean;
  tier: number;
  reason: string | null;
  timestamp: number;
}

async function fetchEntries(ids: string[]): Promise<FeedEntry[]> {
  if (ids.length === 0) return [];
  const redis = getRedis();
  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.hgetall(genKey(id));
  const results = await pipeline.exec();
  return results
    .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object" && "id" in (r as Record<string, unknown>))
    .map((r) => ({
      id: String(r.id),
      prompt: String(r.prompt),
      imageUrl: r.imageUrl ? String(r.imageUrl) : null,
      status: String(r.status) as "granted" | "denied",
      agentId: String(r.agentId),
      ownerAddress: String(r.ownerAddress),
      humanVerified: String(r.humanVerified) === "true",
      tier: Number(r.tier) || 0,
      reason: r.reason ? String(r.reason) : null,
      timestamp: Number(r.timestamp) || 0,
    }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // SSE stream mode for real-time updates
  if (searchParams.get("stream") === "true") {
    const encoder = new TextEncoder();
    let closed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const redis = getRedis();
        let lastTimestamp = Date.now();

        const poll = async () => {
          if (closed) return;
          try {
            // Get entries newer than lastTimestamp
            const ids = await redis.zrange(FEED_KEY, lastTimestamp, "+inf", { byScore: true }) as string[];
            if (ids.length > 0) {
              const entries = await fetchEntries(ids);
              for (const entry of entries) {
                if (entry.timestamp > lastTimestamp) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`));
                  lastTimestamp = entry.timestamp;
                }
              }
            }
          } catch {
            // Connection lost — client will reconnect
          }

          if (!closed) {
            setTimeout(poll, 2000);
          }
        };

        // Keep-alive
        const keepAlive = setInterval(() => {
          if (closed) { clearInterval(keepAlive); return; }
          try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch { clearInterval(keepAlive); }
        }, 15000);

        // Start polling
        poll();

        // Cleanup on abort
        request.signal.addEventListener("abort", () => {
          closed = true;
          clearInterval(keepAlive);
          try { controller.close(); } catch { /* already closed */ }
        });
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

  // JSON pagination mode
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);
  const owner = searchParams.get("owner");

  const redis = getRedis();

  // Use owner-specific feed key if filtering by owner, otherwise global
  const feedKey = owner ? ownerFeedKey(owner) : FEED_KEY;

  // Get total stats
  const total = await redis.zcard(feedKey);

  // Get IDs ordered by timestamp descending (most recent first)
  const maxScore = cursor ? Number(cursor) - 1 : "+inf";
  const ids = await redis.zrange(feedKey, maxScore, "-inf", {
    byScore: true,
    rev: true,
    count: limit + 1,  // +1 to check if there are more
    offset: 0,
  }) as string[];

  const hasMore = ids.length > limit;
  const pageIds = hasMore ? ids.slice(0, limit) : ids;
  const entries = await fetchEntries(pageIds);

  // Sort by timestamp descending
  entries.sort((a, b) => b.timestamp - a.timestamp);

  const nextCursor = hasMore && entries.length > 0
    ? String(entries[entries.length - 1].timestamp)
    : null;

  // Read global stats from counters
  const [granted, denied, uniqueAgents] = await Promise.all([
    redis.get(STATS_GRANTED).then(v => Number(v) || 0),
    redis.get(STATS_DENIED).then(v => Number(v) || 0),
    redis.scard(STATS_AGENTS),
  ]);

  return Response.json({
    entries,
    nextCursor,
    stats: {
      total,
      granted,
      denied,
      uniqueAgents,
    },
  });
}
