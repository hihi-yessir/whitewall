"use client";

import { useReducer, useContext, useEffect, useCallback } from "react";
import { ThemeCtx, ThemeToggle } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import { TryoutFlow } from "./TryoutFlow";
import { LicensePlate } from "./LicensePlate";
import { BottomTerminal } from "./CollapsibleTerminal";
import { tryoutReducer, initialTryoutState, loadPersistedState } from "./types";
import type { TryoutState, TryoutAction } from "./types";

const STORAGE_KEY = "ww-tryout-progress";

function persistState(state: TryoutState, step: string) {
  try {
    const data = {
      wallet: state.wallet,
      agent: {
        ...state.agent,
        id: state.agent.id ? state.agent.id.toString() : undefined,
      },
      tierData: state.tierData,
      phase: state.phase,
      step,
      kycStatus: state.kycStatus,
      creditStatus: state.creditStatus,
      generation: state.generation,
      videoGeneration: state.videoGeneration,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export default function TryoutPage() {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();

  const [state, rawDispatch] = useReducer(tryoutReducer, undefined, loadPersistedState);

  // Wrap dispatch to persist after each action
  const dispatch: React.Dispatch<TryoutAction> = useCallback((action: TryoutAction) => {
    rawDispatch(action);
  }, []);

  // Persist on state changes (step is stored in TryoutFlow, so we persist from here via a custom event)
  useEffect(() => {
    const step = (window as any).__wwTryoutStep || "connect";
    persistState(state, step);
  }, [state]);

  return (
    <>
      {/* Edge fade overlay */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
          background: mobile
            ? `linear-gradient(90deg,${t.bg}AA 0%,transparent 25%,transparent 75%,${t.bg}AA 100%),linear-gradient(180deg,${t.bg} 0%,transparent 15%,transparent 90%,${t.bg} 100%)`
            : `linear-gradient(90deg,${t.bg} 0%,${t.bg}BB 12%,${t.bg}55 30%,transparent 50%,transparent 92%,${t.bg} 100%),linear-gradient(180deg,${t.bg} 0%,transparent 15%,transparent 90%,${t.bg} 100%)`,
          transition: "background .4s",
        }} />

        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          {/* Nav */}
          <nav style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: mobile ? "12px 16px" : "14px 32px",
            borderBottom: `1px solid ${t.cardBorder}40`,
            background: `${t.bg}B0`, backdropFilter: "blur(12px)",
            position: "sticky", top: 0, zIndex: 20,
          }}>
            <a href="/" style={{
              display: "flex", alignItems: "center", gap: 8,
              textDecoration: "none", color: t.inkMuted, fontSize: 13, fontWeight: 600,
            }}>
              <span style={{ fontSize: 16 }}>{"\u2190"}</span>
              {!mobile && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ display: "flex", gap: 2 }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ width: 4, height: 22, borderRadius: 1, background: t.ink, opacity: t.logoDots[i], transition: "background .4s" }} />
                    ))}
                  </div>
                  <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: 1, textTransform: "uppercase", color: t.ink }}>Whitewall</span>
                </div>
              )}
            </a>

            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase",
              color: t.blue,
            }}>
              Try It Out
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <a href="/demo" style={{
                fontSize: 12, fontWeight: 700, color: t.inkMuted,
                textDecoration: "none", letterSpacing: 1, textTransform: "uppercase",
                padding: "4px 10px", borderRadius: 4,
                background: `${t.cardBorder}20`, border: `1px solid ${t.cardBorder}40`,
              }}>
                Demo
              </a>
              <a href="/feed" style={{
                fontSize: 12, fontWeight: 700, color: t.blue,
                textDecoration: "none", letterSpacing: 1, textTransform: "uppercase",
                padding: "4px 10px", borderRadius: 4,
                background: `${t.blue}10`, border: `1px solid ${t.blue}25`,
              }}>
                Feed
              </a>
              <ThemeToggle />
            </div>
          </nav>

          {/* Main layout: 2-column */}
          <div style={{
            flex: 1, display: "flex",
            flexDirection: mobile ? "column" : "row",
            overflow: "hidden",
          }}>
            {/* Left: TryoutFlow */}
            <div style={{
              width: mobile ? "100%" : 320,
              borderRight: mobile ? "none" : `1px solid ${t.cardBorder}40`,
              borderBottom: mobile ? `1px solid ${t.cardBorder}40` : "none",
              overflowY: "auto",
              maxHeight: mobile ? 500 : "none",
            }}>
              <TryoutFlow dispatch={dispatch} state={state} />
            </div>

            {/* Center: LicensePlate — frosted panel like demo page */}
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: mobile ? 8 : 24,
              paddingBottom: mobile ? 180 : 220,
              overflowY: "auto",
              alignItems: "center",
              justifyContent: "center",
              background: `${t.card}B0`,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}>
              <LicensePlate state={state} />
            </div>
          </div>
        </div>

        {/* Bottom-anchored terminal */}
        <BottomTerminal entries={state.terminal} />

        {/* Global styles */}
        <style>{`
          @keyframes demoPulse {
            0%, 100% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.1); }
          }
          @keyframes wwSpin {
            to { transform: rotate(360deg); }
          }
          @keyframes termFadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: none; }
          }
          @keyframes balCoinSpin {
            0% { transform: rotateY(0deg); }
            100% { transform: rotateY(360deg); }
          }
          ::selection { background: ${t.blue}30; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: ${t.bg}; }
          ::-webkit-scrollbar-thumb { background: ${t.blue}; border-radius: 3px; }
        `}</style>
    </>
  );
}
