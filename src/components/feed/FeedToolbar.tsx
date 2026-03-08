"use client";

import { useContext, useState, useEffect, useRef } from "react";
import { ThemeCtx } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import type { FeedStats } from "./types";

function AnimatedNumber({ value, color }: { value: number | string; color: string }) {
  const isString = typeof value === "string";
  const numValue = isString ? parseFloat(value) || 0 : value;
  const [displayed, setDisplayed] = useState(numValue);
  const prevRef = useRef(numValue);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = numValue;
    if (from === to) return;

    const start = performance.now();
    const duration = 400;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = from + (to - from) * eased;
      setDisplayed(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [numValue]);

  const display = isString
    ? `${Math.round(displayed)}%`
    : Math.round(displayed);

  return <span style={{ color, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{display}</span>;
}

export function FeedToolbar({ stats, searchValue, onSearchChange, onSearchSubmit, onClearSearch, isFiltering }: {
  stats: FeedStats;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
  onClearSearch: () => void;
  isFiltering: boolean;
}) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();
  const [focused, setFocused] = useState(false);

  const approvalRate = stats.total > 0 ? Math.round((stats.granted / stats.total) * 100) : 0;

  const statItems: { value: number | string; color: string; label: string; key: string }[] = [
    { value: stats.total, color: t.ink, label: "total", key: "total" },
    { value: stats.granted, color: t.green, label: "approved", key: "approved" },
    { value: stats.denied, color: t.red, label: "denied", key: "denied" },
    { value: stats.uniqueAgents, color: t.blue, label: "agents", key: "agents" },
    { value: stats.teeVerified, color: "#f59e0b", label: "TEE", key: "tee" },
    { value: `${approvalRate}%`, color: t.green, label: "rate", key: "rate" },
  ];

  return (
    <div style={{
      padding: mobile ? "12px 4px" : "16px 0",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* Row 1: Live Registry title + stat pills */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        flexWrap: "wrap",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          marginRight: mobile ? 0 : 8,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: t.green, animation: "demoPulse 2s ease-in-out infinite",
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11, fontWeight: 800, letterSpacing: 1.5,
            textTransform: "uppercase", color: t.inkMuted,
            whiteSpace: "nowrap",
          }}>
            Live Registry
          </span>
        </div>

        {/* Stat pills inline */}
        <div style={{
          display: "flex", alignItems: "center",
          gap: mobile ? 6 : 10,
          flexWrap: "wrap",
          flex: 1,
        }}>
          {statItems.map((s) => (
            <span key={s.key} style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              fontSize: 11, color: t.inkMuted,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: s.color, opacity: 0.7, flexShrink: 0,
              }} />
              <AnimatedNumber value={s.value} color={s.color} />
              {!mobile && (
                <span style={{ fontSize: 10, opacity: 0.7 }}>{s.label}</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Row 2: Search */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{
          position: "relative",
          flex: 1,
          maxWidth: mobile ? "100%" : 320,
        }}>
          <span style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            fontSize: 13, color: t.inkMuted, pointerEvents: "none",
          }}>{"\u2315"}</span>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSearchSubmit(); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search by owner 0x... or agent #id"
            style={{
              width: "100%", padding: "7px 12px 7px 30px",
              borderRadius: 8,
              border: `1.5px solid ${focused ? t.blue : `${t.cardBorder}80`}`,
              background: `${t.codeBg}80`,
              color: t.ink, fontSize: 12,
              fontFamily: "'SF Mono','Fira Code',monospace",
              outline: "none", transition: "border-color .2s",
            }}
          />
        </div>

        {/* Filter chip inline with search */}
        {isFiltering && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "5px 8px", borderRadius: 6,
            background: `${t.blue}10`, border: `1px solid ${t.blue}20`,
            fontSize: 10, color: t.blue, flexShrink: 0,
          }}>
            <span style={{ fontFamily: "'SF Mono','Fira Code',monospace" }}>
              {searchValue.startsWith("0x")
                ? `${searchValue.slice(0, 6)}...${searchValue.slice(-4)}`
                : `#${searchValue.replace(/^#/, "")}`
              }
            </span>
            <button
              onClick={onClearSearch}
              style={{
                background: "none", border: "none", color: t.blue,
                cursor: "pointer", fontSize: 14, fontWeight: 700,
                padding: "4px 6px", opacity: 0.7, lineHeight: 1,
                minHeight: 28, minWidth: 28,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              title="Clear filter"
            >{"\u00D7"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
