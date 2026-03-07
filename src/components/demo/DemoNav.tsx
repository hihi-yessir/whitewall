"use client";

import { useContext, useState } from "react";
import { ThemeCtx, ThemeToggle } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import type { ScenarioId } from "./types";

const TIERS: { tier: number; scenario: ScenarioId; label: string; short: string }[] = [
  { tier: 0, scenario: "anon-bot",        label: "No Identity",     short: "Anon" },
  { tier: 1, scenario: "registered-bot",   label: "Registered",      short: "Reg" },
  { tier: 2, scenario: "verified-agent",   label: "Human Verified",  short: "Human" },
  { tier: 3, scenario: "kyc-agent",        label: "KYC Verified",    short: "KYC" },
  { tier: 4, scenario: "credit-agent",     label: "Fully Verified",  short: "Full" },
];

export function DemoNav({ currentScenario, isRunning, onScenario }: {
  currentScenario: ScenarioId;
  isRunning: boolean;
  onScenario: (scenario: ScenarioId) => void;
}) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: mobile ? "10px 12px" : "12px 32px",
      borderBottom: `1px solid ${t.cardBorder}40`,
      background: `${t.bg}B0`, backdropFilter: "blur(12px)",
      position: "sticky", top: 0, zIndex: 20,
    }}>
      {/* Left: back link + logo */}
      <a href="/" style={{
        display: "flex", alignItems: "center", gap: 8,
        textDecoration: "none", color: t.inkMuted, fontSize: 13, fontWeight: 600,
        transition: "color .2s", flexShrink: 0,
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

      {/* Center: tier buttons — full labels on desktop, short on mobile */}
      <div style={{ display: "flex", gap: mobile ? 2 : 6, alignItems: "center", flexWrap: "nowrap", overflowX: mobile ? "auto" : "visible", maxWidth: mobile ? "calc(100vw - 120px)" : "none", scrollbarWidth: "none" }}>
        {TIERS.map((entry) => {
          const active = currentScenario === entry.scenario;
          const isHovered = hovered === entry.tier;
          return (
            <button
              key={entry.tier}
              onClick={() => !isRunning && onScenario(entry.scenario)}
              disabled={isRunning}
              onMouseEnter={() => setHovered(entry.tier)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: mobile ? "8px 8px" : "8px 14px",
                minHeight: 44,
                border: active
                  ? `1.5px solid ${t.blue}`
                  : `1.5px solid ${isHovered ? `${t.ink}40` : `${t.cardBorder}60`}`,
                cursor: isRunning ? "not-allowed" : "pointer",
                background: active ? `${t.blue}20` : isHovered ? `${t.ink}08` : "transparent",
                borderRadius: 8,
                color: active ? t.blue : t.ink,
                fontSize: mobile ? 10 : 12,
                fontWeight: 700,
                letterSpacing: 0.5,
                transition: "all .2s",
                opacity: isRunning && !active ? 0.35 : 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{
                fontSize: mobile ? 8 : 9,
                fontWeight: 900,
                fontFamily: "'SF Mono','Fira Code',monospace",
                opacity: active ? 1 : 0.5,
                letterSpacing: 1,
              }}>
                T{entry.tier}
              </span>
              {mobile ? entry.short : entry.label}
              {isRunning && active && (
                <span style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  border: `1.5px solid ${t.blue}30`,
                  borderTopColor: t.blue,
                  borderRadius: "50%",
                  animation: "demoPulse .8s linear infinite",
                  verticalAlign: "middle",
                  flexShrink: 0,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Right: try it link + feed link + theme toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: mobile ? 8 : 12, flexShrink: 0 }}>
        {!mobile && (
          <>
            <a href="/tryout" style={{
              fontSize: 12, fontWeight: 700, color: t.ink,
              textDecoration: "none", letterSpacing: 1, textTransform: "uppercase",
              padding: "4px 10px", borderRadius: 4,
              background: `${t.blue}15`, border: `1px solid ${t.blue}30`,
              transition: "all .2s",
            }}>
              Try It {"\u2192"}
            </a>
            <a href="/feed" style={{
              fontSize: 12, fontWeight: 700, color: t.blue,
              textDecoration: "none", letterSpacing: 1, textTransform: "uppercase",
              padding: "4px 10px", borderRadius: 4,
              background: `${t.blue}10`, border: `1px solid ${t.blue}25`,
              transition: "all .2s",
            }}>
              Feed
            </a>
          </>
        )}
        <ThemeToggle />
      </div>
    </nav>
  );
}
