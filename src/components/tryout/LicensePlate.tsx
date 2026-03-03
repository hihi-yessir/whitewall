"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { ThemeCtx } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import type { TryoutState, KYCStatus, CreditStatus } from "./types";

const CHECKS = [
  { key: "registered" as const, label: "REG", full: "Registered", hashKey: "register" as const },
  { key: "humanVerified" as const, label: "HUMAN", full: "Human Verified", hashKey: "worldId" as const },
  { key: "kycVerified" as const, label: "KYC", full: "KYC Passed", hashKey: "kyc" as const },
  { key: "hasCreditScore" as const, label: "CREDIT", full: "Credit Score", hashKey: "credit" as const },
];

const RESOURCES = [
  { tier: 2, label: "Image", abbr: "T2" },
  { tier: 3, label: "Video", abbr: "T3" },
  { tier: 4, label: "Premium", abbr: "T4" },
];

const TIER_LABELS: Record<number, string> = {
  0: "UNVERIFIED",
  1: "REGISTERED",
  2: "HUMAN VERIFIED",
  3: "PARTIALLY VERIFIED",
  4: "FULLY VERIFIED",
};

/** Inline CSS spinner for pending validators */
function Spinner({ color }: { color: string }) {
  return (
    <span style={{
      display: "inline-block",
      width: 11,
      height: 11,
      border: `1.5px solid ${color}30`,
      borderTopColor: color,
      borderRadius: "50%",
      animation: "plateSpin .8s linear infinite",
    }} />
  );
}

export function LicensePlate({ state }: { state: TryoutState }) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const prevChecks = useRef<boolean[]>([false, false, false, false]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const current = CHECKS.map((c) => !!state.tierData[c.key]);
    current.forEach((val, i) => {
      if (val && !prevChecks.current[i]) {
        setFlashIdx(i);
        const timer = setTimeout(() => setFlashIdx(null), 1200);
        return () => clearTimeout(timer);
      }
    });
    prevChecks.current = current;
  }, [state.tierData.registered, state.tierData.humanVerified, state.tierData.kycVerified, state.tierData.hasCreditScore]);

  const td = state.tierData;
  const tier = td.effectiveTier;
  const tierPct = Math.min((tier / 4) * 100, 100);
  const agentId = state.agent.id?.toString();
  const ownerAddr = state.wallet.address;
  const agentWallet = state.agent.agentWallet;

  const shorten = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const tierColor = tier >= 4 ? t.green : tier >= 2 ? t.blue : tier >= 1 ? t.ink : t.inkMuted;

  const isPending = (key: string): boolean => {
    if (key === "kycVerified") return state.kycStatus === "done" && !td.kycVerified;
    if (key === "hasCreditScore") return state.creditStatus === "done" && !td.hasCreditScore;
    return false;
  };

  const Bolt = () => (
    <div style={{
      width: 8, height: 8, borderRadius: "50%",
      border: `1.5px solid ${t.cardBorder}60`,
      background: `${t.codeBg}`,
      flexShrink: 0,
    }} />
  );

  const hasImage = !!state.generation;
  const hasCREData = td.kycData?.verified || td.creditData?.hasScore;
  const hasVideo = !!state.videoGeneration;
  const hasResult = !!state.result;

  return (
    <div style={{ maxWidth: mobile ? "100%" : 560, width: "100%" }}>
      {/* ═══ THE PLATE — single unified card ═══ */}
      <div style={{
        background: t.card,
        border: `2.5px solid ${t.cardBorder}`,
        borderRadius: 14,
        boxShadow: `inset 0 0 0 3px ${t.codeBg}, 0 2px 12px ${t.bg}80`,
        overflow: "hidden",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "none" : "translateY(8px)",
        transition: "opacity 0.5s ease, transform 0.5s ease, background .4s, border-color .4s",
      }}>

        {/* A. Top strip: issuer + bolt holes */}
        <div style={{
          background: t.codeBg,
          padding: mobile ? "6px 10px" : "6px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <Bolt />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 2.5, textTransform: "uppercase", color: t.inkMuted }}>
              Whitewall OS
            </span>
            <span style={{ color: `${t.cardBorder}40`, fontSize: 8 }}>{"\u00B7"}</span>
            <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 2.5, textTransform: "uppercase", color: t.blue }}>
              Base Sepolia
            </span>
          </div>
          <Bolt />
        </div>

        {/* B. Photo + ID row */}
        <div style={{
          padding: mobile ? "12px 12px 10px" : "16px 24px 12px",
          display: "flex",
          flexDirection: mobile ? "column" : "row",
          alignItems: mobile ? "center" : "flex-start",
          gap: mobile ? 10 : 16,
        }}>
          {/* Photo thumbnail / placeholder */}
          <div style={{
            width: mobile ? "100%" : 120,
            height: mobile ? 160 : 120,
            borderRadius: 8,
            overflow: "hidden",
            flexShrink: 0,
            border: hasImage ? `1px solid ${t.cardBorder}40` : `1.5px dashed ${t.cardBorder}50`,
            background: hasImage ? "transparent" : `${t.codeBg}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {hasImage ? (
              <img
                src={state.generation!.imageUrl}
                alt={state.generation!.prompt}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1,
                color: `${t.cardBorder}60`,
                textTransform: "uppercase",
              }}>
                No Photo
              </span>
            )}
          </div>

          {/* ID info + badge grid */}
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            textAlign: mobile ? "center" : "left",
            minWidth: 0,
          }}>
            {/* Agent ID */}
            <div style={{
              fontFamily: "'SF Mono','Fira Code',monospace",
              fontSize: agentId ? (mobile ? 32 : 28) : (mobile ? 18 : 20),
              fontWeight: 900,
              letterSpacing: agentId ? 3 : 2,
              color: agentId ? t.ink : `${t.cardBorder}80`,
              lineHeight: 1,
              transition: "color .3s",
            }}>
              {agentId ? `# ${agentId}` : "- - -"}
            </div>

            {/* Owner address */}
            <div style={{
              fontFamily: "'SF Mono','Fira Code',monospace",
              fontSize: mobile ? 10 : 11,
              fontWeight: 600,
              color: ownerAddr ? t.inkMuted : `${t.cardBorder}60`,
              letterSpacing: 1,
            }}>
              {ownerAddr ? shorten(ownerAddr) : "no wallet connected"}
              {agentWallet && (
                <span style={{ color: `${t.inkMuted}80` }}>
                  {" \u00B7 "}{shorten(agentWallet)}
                </span>
              )}
            </div>

            {/* 2×2 badge grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 4,
            }}>
              {CHECKS.map((check, i) => {
                const ok = !!td[check.key];
                const pending = isPending(check.key);
                const hash = td.txHashes[check.hashKey];
                const isFlashing = flashIdx === i;
                return (
                  <div key={check.key} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 6px",
                    borderRadius: 5,
                    background: ok ? `${t.green}10` : pending ? `${t.blue}08` : `${t.cardBorder}15`,
                    border: `1px solid ${ok ? `${t.green}25` : pending ? `${t.blue}20` : `${t.cardBorder}25`}`,
                    transition: "all .3s, box-shadow 1s",
                    boxShadow: isFlashing ? `0 0 16px ${t.green}40` : "none",
                  }}>
                    <span style={{
                      fontSize: 10,
                      color: ok ? t.green : pending ? t.blue : `${t.cardBorder}80`,
                      fontWeight: 700,
                      lineHeight: 1,
                      display: "flex",
                      alignItems: "center",
                    }}>
                      {ok ? "\u2713" : pending ? <Spinner color={t.blue} /> : "\u2610"}
                    </span>
                    <span style={{
                      fontSize: 8,
                      fontWeight: 800,
                      letterSpacing: 0.5,
                      color: ok ? t.ink : pending ? t.blue : t.inkMuted,
                    }}>
                      {check.label}
                    </span>
                    {hash && (
                      <a
                        href={`https://sepolia.basescan.org/tx/${hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          marginLeft: "auto",
                          fontSize: 7,
                          fontFamily: "'SF Mono','Fira Code',monospace",
                          color: t.blue,
                          textDecoration: "none",
                          opacity: 0.7,
                        }}
                      >
                        {hash.slice(0, 6)}..
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* C. Tier bar + resource badges */}
        <div style={{
          padding: mobile ? "6px 10px 8px" : "6px 20px 10px",
          borderTop: `1px solid ${t.cardBorder}20`,
        }}>
          {/* Tier bar row */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: mobile ? 8 : 12,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                height: 6,
                borderRadius: 3,
                background: `${t.cardBorder}30`,
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${tierPct}%`,
                  borderRadius: 3,
                  background: `linear-gradient(90deg, ${t.blue}, ${t.green})`,
                  transition: "width 0.6s ease",
                }} />
              </div>
            </div>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 1,
              color: tierColor,
              whiteSpace: "nowrap",
            }}>
              T{tier} {TIER_LABELS[tier] ?? ""}
            </span>
          </div>

          {/* Resource badges */}
          <div style={{
            display: "flex",
            gap: 8,
            marginTop: 6,
            justifyContent: mobile ? "center" : "flex-start",
          }}>
            {RESOURCES.map((r) => {
              const unlocked = tier >= r.tier;
              return (
                <span key={r.label} style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  color: unlocked ? t.green : `${t.inkMuted}80`,
                  transition: "color .3s",
                }}>
                  {r.label} {unlocked ? "\u2713" : "\uD83D\uDD12"}
                </span>
              );
            })}
          </div>
        </div>

        {/* D. CRE data strip (conditional) */}
        {hasCREData && (
          <div style={{
            borderTop: `1px solid ${t.cardBorder}30`,
            background: t.codeBg,
            padding: mobile ? "6px 12px" : "6px 20px",
          }}>
            <div style={{
              fontFamily: "'SF Mono','Fira Code',monospace",
              fontSize: 11,
              color: t.inkMuted,
              lineHeight: 1.6,
            }}>
              {td.kycData?.verified && (
                <span>kycVerified: <span style={{ color: t.green }}>true</span></span>
              )}
              {td.kycData?.verified && td.creditData?.hasScore && (
                <span style={{ margin: "0 8px", opacity: 0.3 }}>{"\u00B7"}</span>
              )}
              {td.creditData?.hasScore && (
                <span>creditScore: <span style={{ color: t.blue }}>{td.creditData.score}</span></span>
              )}
            </div>
          </div>
        )}

        {/* E. Video section (conditional — gated on videoGeneration only) */}
        {hasVideo && (
          <div style={{
            borderTop: `1px solid ${t.cardBorder}30`,
            padding: mobile ? "8px 12px" : "10px 20px",
          }}>
            <div style={{
              borderRadius: 6,
              overflow: "hidden",
              border: `1px solid ${t.cardBorder}30`,
            }}>
              <video
                src={state.videoGeneration!.imageUrl}
                autoPlay
                muted
                playsInline
                loop
                style={{ width: "100%", display: "block" }}
              />
            </div>
            <div style={{
              marginTop: 5,
              fontSize: 10,
              fontFamily: "'SF Mono','Fira Code',monospace",
              color: t.inkMuted,
              letterSpacing: 0.3,
            }}>
              <span style={{ color: t.blue }}>#{state.videoGeneration!.agentId}</span>
              {" \u00B7 "}
              {state.videoGeneration!.id.slice(0, 8)}
              {" \u00B7 "}
              {state.videoGeneration!.prompt.slice(0, 40)}{state.videoGeneration!.prompt.length > 40 ? "..." : ""}
            </div>
          </div>
        )}

        {/* F. Result status strip (conditional) */}
        {hasResult && (
          <div style={{
            borderTop: `1px solid ${t.cardBorder}30`,
            padding: mobile ? "8px 12px" : "8px 20px",
            background: state.result!.granted ? `${t.green}08` : `${t.red}08`,
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 6,
          }}>
            <span style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.5,
              color: state.result!.granted ? t.green : t.red,
            }}>
              {state.result!.granted ? "\u2705 ACCESS GRANTED" : "\u274C ACCESS DENIED"}
            </span>
            {state.result!.granted && state.result!.tier !== undefined && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: t.inkMuted,
              }}>
                {"\u00B7"} Tier {state.result!.tier}
              </span>
            )}
            {state.result!.granted && state.result!.accountableHuman && (
              <span style={{
                fontSize: 10,
                fontFamily: "'SF Mono','Fira Code',monospace",
                color: t.inkMuted,
              }}>
                {"\u00B7"} {shorten(state.result!.accountableHuman)}
              </span>
            )}
            {!state.result!.granted && state.result!.reason && (
              <span style={{ fontSize: 10, color: t.inkMuted }}>
                {"\u00B7"} {state.result!.reason}
              </span>
            )}
            {!state.result!.granted && (
              <span style={{ fontSize: 9, color: `${t.inkMuted}80`, marginLeft: "auto" }}>
                Payment refunded
              </span>
            )}
          </div>
        )}

        {/* G. Bottom strip: bolt holes only */}
        <div style={{
          background: t.codeBg,
          padding: mobile ? "6px 10px" : "6px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <Bolt />
          <Bolt />
        </div>
      </div>

      {/* Spinner keyframe — injected once */}
      <style>{`
        @keyframes plateSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes plateFlash {
          0% { box-shadow: 0 0 0 0 ${t.green}40; }
          50% { box-shadow: 0 0 16px 4px ${t.green}30; }
          100% { box-shadow: 0 0 0 0 ${t.green}00; }
        }
      `}</style>
    </div>
  );
}
