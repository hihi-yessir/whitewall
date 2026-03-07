import { NextRequest, NextResponse } from "next/server";
import { getRedis, ACTIVITY_KEY, activityKey } from "@/lib/redis";

export type ActivityType = "register" | "approve" | "worldid" | "kyc" | "credit" | "generation";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  agentId: string;
  ownerAddress: string;
  txHash?: string;
  detail?: string;
  timestamp: number;
}

// POST — log a new activity event
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, agentId, ownerAddress, txHash, detail } = body;

    if (!type || !agentId || !ownerAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const redis = getRedis();
    const id = `${type}-${agentId}-${Date.now()}`;
    const event: Record<string, string> = {
      id,
      type,
      agentId: String(agentId),
      ownerAddress: ownerAddress.toLowerCase(),
      timestamp: String(Date.now()),
    };
    if (txHash) event.txHash = txHash;
    if (detail) event.detail = detail;

    await redis.hset(activityKey(id), event);
    await redis.zadd(ACTIVITY_KEY, { score: Number(event.timestamp), member: id });

    // Cap at 200 entries — trim old ones
    const count = await redis.zcard(ACTIVITY_KEY);
    if (count > 200) {
      const toRemove = await redis.zrange(ACTIVITY_KEY, 0, count - 201) as string[];
      if (toRemove.length > 0) {
        const pipeline = redis.pipeline();
        for (const old of toRemove) pipeline.del(activityKey(old));
        pipeline.zremrangebyrank(ACTIVITY_KEY, 0, count - 201);
        await pipeline.exec();
      }
    }

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to log activity" }, { status: 500 });
  }
}

async function fetchEvents(ids: string[]): Promise<ActivityEvent[]> {
  if (ids.length === 0) return [];
  const redis = getRedis();
  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.hgetall(activityKey(id));
  const results = await pipeline.exec();
  return results
    .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object" && "id" in (r as Record<string, unknown>))
    .map((r) => ({
      id: String(r.id),
      type: String(r.type) as ActivityType,
      agentId: String(r.agentId),
      ownerAddress: String(r.ownerAddress),
      txHash: r.txHash ? String(r.txHash) : undefined,
      detail: r.detail ? String(r.detail) : undefined,
      timestamp: Number(r.timestamp) || 0,
    }));
}

// GET — fetch recent activity events (JSON or SSE stream)
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
            const ids = await redis.zrange(ACTIVITY_KEY, lastTimestamp, "+inf", { byScore: true }) as string[];
            if (ids.length > 0) {
              const events = await fetchEvents(ids);
              for (const ev of events) {
                if (ev.timestamp > lastTimestamp) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
                  lastTimestamp = ev.timestamp;
                }
              }
            }
          } catch { /* client will reconnect */ }

          if (!closed) setTimeout(poll, 2000);
        };

        const keepAlive = setInterval(() => {
          if (closed) { clearInterval(keepAlive); return; }
          try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch { clearInterval(keepAlive); }
        }, 15000);

        poll();

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

  // JSON mode
  const limit = Math.min(Number(searchParams.get("limit")) || 30, 100);

  const redis = getRedis();
  const ids = await redis.zrange(ACTIVITY_KEY, "+inf", "-inf", {
    byScore: true,
    rev: true,
    count: limit,
    offset: 0,
  }) as string[];

  const events = await fetchEvents(ids);
  return NextResponse.json({ events });
}
