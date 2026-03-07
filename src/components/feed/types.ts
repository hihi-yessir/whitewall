export interface Generation {
  id: string;
  prompt: string;
  imageUrl: string | null;
  status: "granted" | "denied";
  agentId: string;
  ownerAddress: string;
  humanVerified: boolean;
  tier: number;
  reason: string | null;
  txHash: string | null;
  timestamp: number;
}

export interface FeedStats {
  total: number;
  granted: number;
  denied: number;
  uniqueAgents: number;
  teeVerified: number;
}

export const TIER_META: Record<number, { label: string; color: string }> = {
  1: { label: "T1", color: "#888" },
  2: { label: "T2", color: "#3b82f6" },
  3: { label: "T3", color: "#22c55e" },
  4: { label: "T4", color: "#f59e0b" },
};


export interface FeedResponse {
  entries: Generation[];
  nextCursor: string | null;
  stats: FeedStats;
}
