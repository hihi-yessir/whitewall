"use client";

import { useContext, useState } from "react";
import { ThemeCtx } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import type { FeedStats } from "./types";

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

  const statItems = [
    { value: stats.total, color: t.ink, label: "total" },
    { value: stats.granted, color: t.green, label: "approved" },
    { value: stats.denied, color: t.red, label: "denied" },
    { value: stats.uniqueAgents, color: t.blue, label: "agents" },
    { value: stats.teeVerified, color: "#f59e0b", label: "TEE" },
    { value: `${approvalRate}%`, color: t.green, label: "rate" },
  ];

  return (
    <div style={{
      padding: mobile ? "10px 12px" : "12px 0",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      {/* Live Registry header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        paddingBottom: 6, borderBottom: `1px solid ${t.cardBorder}15`,
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: t.green, animation: "demoPulse 2s ease-in-out infinite",
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: 2,
          textTransform: "uppercase", color: t.inkMuted,
        }}>
          Live Registry
        </span>
        <span style={{
          fontSize: 10, color: `${t.inkMuted}80`, fontWeight: 500,
          marginLeft: "auto",
        }}>
          {stats.total > 0 ? `${stats.total} license plates issued` : "Waiting for first registration..."}
        </span>
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: mobile ? 8 : 16,
        flexWrap: "wrap",
      }}>
        {/* Search input */}
        <div style={{
          position: "relative",
          width: mobile ? "100%" : 300,
          flexShrink: 0,
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
            placeholder="Search by owner 0x..."
            style={{
              width: "100%", padding: "8px 12px 8px 32px",
              borderRadius: 8,
              border: `1.5px solid ${focused ? t.blue : t.cardBorder}`,
              background: `${t.card}CC`,
              backdropFilter: "blur(8px)",
              color: t.ink, fontSize: 13,
              fontFamily: "'SF Mono','Fira Code',monospace",
              outline: "none", transition: "border-color .2s",
            }}
          />
        </div>

        {/* Stat pills */}
        <div style={{
          display: "flex", alignItems: "center", gap: mobile ? 8 : 12,
          fontSize: 12, fontWeight: 600, flexWrap: "wrap",
        }}>
          {statItems.map((s) => (
            <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 4, color: t.inkMuted }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: s.color, opacity: 0.8, flexShrink: 0,
              }} />
              <span style={{ color: s.color, fontWeight: 800 }}>{s.value}</span>
              {!mobile && <span>{s.label}</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Active filter chip */}
      {isFiltering && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "5px 10px", borderRadius: 6,
          background: `${t.blue}12`, border: `1px solid ${t.blue}25`,
          fontSize: 11, color: t.blue, alignSelf: "flex-start",
        }}>
          <span style={{ fontWeight: 600 }}>Owner:</span>
          <span style={{ fontFamily: "'SF Mono','Fira Code',monospace" }}>
            {searchValue.slice(0, 6)}...{searchValue.slice(-4)}
          </span>
          <button
            onClick={onClearSearch}
            style={{
              background: "none", border: "none", color: t.blue,
              cursor: "pointer", fontSize: 14, fontWeight: 700,
              padding: "0 2px", opacity: 0.7, lineHeight: 1,
            }}
            title="Clear filter"
          >{"\u00D7"}</button>
        </div>
      )}
    </div>
  );
}
