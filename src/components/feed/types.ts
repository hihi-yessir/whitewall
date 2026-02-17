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
  timestamp: number;
}

export interface FeedStats {
  total: number;
  granted: number;
  denied: number;
  uniqueAgents: number;
}

export interface FeedResponse {
  entries: Generation[];
  nextCursor: string | null;
  stats: FeedStats;
}
