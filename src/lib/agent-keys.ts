// Agent key store backed by Upstash Redis.
// Survives hot reloads and server restarts (unlike in-memory Map).
// In production, this would be a secure enclave or KMS.

import { getRedis } from "./redis";

const REDIS_PREFIX = "agent-key:";

export async function storeAgentKey(agentId: string, privateKey: `0x${string}`) {
  const redis = getRedis();
  await redis.set(`${REDIS_PREFIX}${agentId}`, privateKey);
}

export async function getAgentKey(agentId: string): Promise<`0x${string}` | undefined> {
  const redis = getRedis();
  const key = await redis.get(`${REDIS_PREFIX}${agentId}`);
  return key ? (key as `0x${string}`) : undefined;
}
