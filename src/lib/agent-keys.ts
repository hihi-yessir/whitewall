// In-memory store for demo agent private keys.
// In production, this would be a secure enclave or KMS.

const agentKeys = new Map<string, `0x${string}`>();

export function storeAgentKey(agentId: string, privateKey: `0x${string}`) {
  agentKeys.set(agentId, privateKey);
}

export function getAgentKey(agentId: string): `0x${string}` | undefined {
  return agentKeys.get(agentId);
}
