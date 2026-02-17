"use client";

import { useContext } from "react";
import { ThemeCtx, ThemeToggle } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";

const acts = [
  { num: 1 as const, label: "The Threat" },
  { num: 2 as const, label: "The Wall" },
  { num: 3 as const, label: "The Proof" },
  { num: 4 as const, label: "Try It" },
];

export function DemoNav({ currentAct, onActChange }: {
  currentAct: 1 | 2 | 3 | 4;
  onActChange: (act: 1 | 2 | 3 | 4) => void;
}) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();

  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: mobile ? "12px 16px" : "14px 32px",
      borderBottom: `1px solid ${t.cardBorder}40`,
      background: `${t.bg}B0`, backdropFilter: "blur(12px)",
      position: "sticky", top: 0, zIndex: 20,
    }}>
      {/* Left: back link + logo */}
      <a href="/" style={{
        display: "flex", alignItems: "center", gap: 8,
        textDecoration: "none", color: t.inkMuted, fontSize: 13, fontWeight: 600,
        transition: "color .2s",
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

      {/* Center: act tabs */}
      <div style={{ display: "flex", gap: mobile ? 2 : 4, alignItems: "center" }}>
        {acts.map((act) => {
          const active = currentAct === act.num;
          return (
            <button key={act.num} onClick={() => onActChange(act.num)} style={{
              padding: mobile ? "6px 10px" : "8px 16px",
              border: "none", cursor: "pointer",
              background: active ? `${t.blue}20` : "transparent",
              borderBottom: active ? `2px solid ${t.blue}` : "2px solid transparent",
              color: active ? t.ink : t.inkMuted,
              fontSize: mobile ? 11 : 12, fontWeight: 700, transition: "all .2s",
              borderRadius: "6px 6px 0 0",
            }}>
              {mobile ? `Act ${act.num}` : `Act ${act.num}: ${act.label}`}
            </button>
          );
        })}
      </div>

      {/* Right: feed link + theme toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/feed" style={{
          fontSize: 12, fontWeight: 700, color: t.blue,
          textDecoration: "none", letterSpacing: 1, textTransform: "uppercase",
          padding: "4px 10px", borderRadius: 4,
          background: `${t.blue}10`, border: `1px solid ${t.blue}25`,
          transition: "all .2s",
        }}>
          Feed
        </a>
        <ThemeToggle />
      </div>
    </nav>
  );
}
