"use client";

import { useState, useContext, useEffect, useCallback } from "react";
import { ThemeCtx } from "../shared/theme";

interface OnChainState {
  registered: boolean;
  owner: string | null;
  humanVerified: boolean;
  kycVerified: boolean;
  kycData: { verified: boolean; sessionHash: string; verifiedAt: number } | null;
  creditScore: number;
  hasCreditScore: boolean;
  creditData: { score: number; dataHash: string; verifiedAt: number; hasScore: boolean } | null;
  effectiveTier: number;
}

interface ValidationRequests {
  kyc: Record<string, string> | null;
  credit: Record<string, string> | null;
}

const TIER_LABELS: Record<number, string> = {
  0: "Unregistered",
  1: "Registered",
  2: "Human Verified",
  3: "KYC Verified",
  4: "Credit Scored",
};

export function ChainStatus({ agentId, refreshKey }: { agentId: string; refreshKey: number }) {
  const { t } = useContext(ThemeCtx);
  const [chain, setChain] = useState<OnChainState | null>(null);
  const [requests, setRequests] = useState<ValidationRequests | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bonding/status?agentId=${agentId}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setChain(data.onChain);
      setRequests(data.validationRequests);
    } catch {
      setError("Failed to fetch status");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  // Fetch on mount and when refreshKey changes
  useEffect(() => { fetchStatus(); }, [fetchStatus, refreshKey]);

  const tierColor = (tier: number) => {
    if (tier >= 4) return t.green;
    if (tier >= 2) return t.blue;
    if (tier >= 1) return t.inkMuted;
    return t.red;
  };

  const dot = (ok: boolean) => (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: 4,
      background: ok ? t.green : `${t.cardBorder}80`,
      marginRight: 6, verticalAlign: "middle",
    }} />
  );

  return (
    <div style={{
      borderRadius: 12, padding: "20px 24px",
      border: `1.5px solid ${t.cardBorder}`,
      background: `${t.card}CC`, backdropFilter: "blur(8px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.blue, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            On-Chain Status
          </span>
          <span style={{ fontSize: 11, color: t.inkMuted, marginLeft: 8 }}>
            Agent #{agentId} · Base Sepolia
          </span>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          style={{
            background: "none", border: `1px solid ${t.cardBorder}`, borderRadius: 6,
            padding: "4px 10px", fontSize: 11, color: t.inkMuted, cursor: "pointer",
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: t.red, marginBottom: 12 }}>{error}</div>
      )}

      {chain && (
        <>
          {/* Tier badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 14px", borderRadius: 20, marginBottom: 16,
            background: `${tierColor(chain.effectiveTier)}18`,
            border: `1px solid ${tierColor(chain.effectiveTier)}40`,
          }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: tierColor(chain.effectiveTier) }}>
              T{chain.effectiveTier}
            </span>
            <span style={{ fontSize: 12, color: t.inkMuted }}>
              {TIER_LABELS[chain.effectiveTier]}
            </span>
          </div>

          {/* Validator checklist */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px",
            fontSize: 13, lineHeight: 1.8,
          }}>
            <div>{dot(chain.registered)} Registered</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: t.inkMuted }}>
              {chain.owner ? `${chain.owner.slice(0, 10)}...` : "—"}
            </div>

            <div>{dot(chain.humanVerified)} Human Verified</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: chain.humanVerified ? t.green : t.inkMuted }}>
              WorldIDValidator
            </div>

            <div>{dot(chain.kycVerified)} KYC Verified</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: chain.kycVerified ? t.green : t.inkMuted }}>
              {chain.kycData?.sessionHash ? `${chain.kycData.sessionHash.slice(0, 14)}...` : "—"}
            </div>

            <div>{dot(chain.hasCreditScore)} Credit Score</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: chain.hasCreditScore ? t.green : t.inkMuted }}>
              {chain.hasCreditScore ? `score=${chain.creditScore}` : "—"}
            </div>
          </div>

          {/* Validation requests queue */}
          {(requests?.kyc || requests?.credit) && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.cardBorder}40` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.inkMuted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
                Pending CRE Requests
              </div>
              <div style={{
                padding: "10px 12px", borderRadius: 8, fontSize: 11, fontFamily: "monospace",
                background: `${t.codeBg}CC`, border: `1px solid ${t.cardBorder}40`,
                color: t.inkMuted, lineHeight: 1.8,
              }}>
                {requests.kyc && (
                  <div>
                    KYC: <span style={{ color: t.ink }}>{(requests.kyc.requestHash as string)?.slice(0, 18)}...</span>
                    {" "}[<span style={{ color: requests.kyc.status === "pending_cre" ? "#E8A317" : t.green }}>{requests.kyc.status as string}</span>]
                  </div>
                )}
                {requests.credit && (
                  <div>
                    Credit: <span style={{ color: t.ink }}>{(requests.credit.requestHash as string)?.slice(0, 18)}...</span>
                    {" "}[<span style={{ color: requests.credit.status === "pending_cre" ? "#E8A317" : t.green }}>{requests.credit.status as string}</span>]
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Flow diagram */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.cardBorder}40` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.inkMuted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
              Data Flow
            </div>
            <div style={{
              fontSize: 11, fontFamily: "monospace", color: t.inkMuted, lineHeight: 2,
              padding: "10px 12px", borderRadius: 8,
              background: `${t.codeBg}CC`, border: `1px solid ${t.cardBorder}40`,
            }}>
              <div><span style={{ color: t.ink }}>Stripe</span> sessionId → <span style={{ color: t.blue }}>TEE</span> verify → <span style={{ color: t.green }}>StripeKYCValidator</span>.onReport()</div>
              <div><span style={{ color: t.ink }}>Plaid</span> access_token → <span style={{ color: t.blue }}>TEE</span> asset report → <span style={{ color: t.green }}>PlaidCreditValidator</span>.onReport()</div>
              <div style={{ marginTop: 4, color: `${t.inkMuted}80` }}>
                TieredPolicy reads all validators → tier 0-4 → AccessGranted/Denied
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
