import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
    redis = new Redis({ url, token });
  }
  return redis;
}

// Keys
export const FEED_KEY = "feed:generations";
export const genKey = (id: string) => `gen:${id}`;
export const rateLimitKey = (address: string) => `ratelimit:${address}`;
export const STATS_GRANTED = "feed:stats:granted";
export const STATS_DENIED = "feed:stats:denied";
export const STATS_AGENTS = "feed:stats:agents";  // set of unique agentIds
export const ownerFeedKey = (address: string) => `feed:owner:${address.toLowerCase()}`;
