import { NextRequest, NextResponse } from "next/server";
import { getRedis, FEED_KEY, STATS_GRANTED, STATS_DENIED, STATS_AGENTS, STATS_TEE, ACTIVITY_KEY } from "@/lib/redis";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function POST(req: NextRequest) {
  const { secret } = await req.json().catch(() => ({ secret: "" }));

  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redis = getRedis();

  // Get all generation IDs from the sorted set
  const genIds = await redis.zrange(FEED_KEY, 0, -1) as string[];

  // Delete each gen:* hash + any owner feed keys
  const pipeline = redis.pipeline();
  for (const id of genIds) {
    pipeline.del(`gen:${id}`);
  }
  // Delete the main feed sorted set
  pipeline.del(FEED_KEY);
  // Delete stats
  pipeline.del(STATS_GRANTED);
  pipeline.del(STATS_DENIED);
  pipeline.del(STATS_AGENTS);
  pipeline.del(STATS_TEE);

  // Delete activity timeline
  const activityIds = await redis.zrange(ACTIVITY_KEY, 0, -1) as string[];
  for (const id of activityIds) {
    pipeline.del(`activity:${id}`);
  }
  pipeline.del(ACTIVITY_KEY);

  await pipeline.exec();

  // Also clean up owner feed keys (pattern: feed:owner:*)
  // Upstash doesn't support SCAN easily, but these are low volume
  // They'll naturally expire or be overwritten

  return NextResponse.json({
    success: true,
    deleted: genIds.length,
    message: `Cleared ${genIds.length} generations and reset all stats`,
  });
}
