"use client";

import { useContext, useState, useEffect } from "react";
import { ThemeCtx } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import type { Generation } from "./types";
import { TIER_META } from "./types";
import { proxyMedia } from "@/lib/media";

/** Shared tick — one interval drives all LiveTimeAgo instances */
let tickListeners = new Set<() => void>();
let tickInterval: ReturnType<typeof setInterval> | null = null;

function subscribeTick(cb: () => void) {
  tickListeners.add(cb);
  if (!tickInterval) {
    tickInterval = setInterval(() => {
      tickListeners.forEach((fn) => fn());
    }, 1000);
  }
  return () => {
    tickListeners.delete(cb);
    if (tickListeners.size === 0 && tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  };
}

/** Live-ticking time ago — all instances share one 1s interval */
function LiveTimeAgo({ timestamp }: { timestamp: number }) {
  const { t } = useContext(ThemeCtx);
  const [, setTick] = useState(0);

  useEffect(() => subscribeTick(() => setTick((n) => n + 1)), []);

  const diff = Date.now() - timestamp;
  const secs = Math.floor(diff / 1000);
  let label: string;
  if (secs < 60) label = `${secs}s ago`;
  else if (secs < 3600) label = `${Math.floor(secs / 60)}m ago`;
  else if (secs < 86400) label = `${Math.floor(secs / 3600)}h ago`;
  else label = `${Math.floor(secs / 86400)}d ago`;

  return <span style={{ fontSize: 9, color: t.inkMuted }}>{label}</span>;
}

export function FeedListItem({ entry, isSelected, isNew, onSelect, onOwnerClick }: {
  entry: Generation;
  isSelected: boolean;
  isNew?: boolean;
  onSelect: () => void;
  onOwnerClick: (address: string) => void;
}) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();
  const granted = entry.status === "granted";
  const thumbSize = mobile ? 44 : 56;

  return (
    <div
      onClick={onSelect}
      style={{
        display: "flex", alignItems: "center", gap: mobile ? 8 : 12,
        padding: mobile ? "8px 8px" : "8px 12px",
        cursor: "pointer",
        background: isSelected ? `${t.blue}10` : "transparent",
        borderLeft: isSelected ? `3px solid ${t.blue}` : isNew ? `3px solid ${t.blue}60` : "3px solid transparent",
        borderBottom: `1px solid ${t.cardBorder}30`,
        transition: "background .15s, border-color .6s, box-shadow .6s",
        minHeight: 72,
        animation: isNew ? "feedEntryHighlight 2.5s ease-out" : undefined,
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = `${t.card}80`; }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Thumbnail */}
      {granted && entry.imageUrl ? (
        <img
          src={proxyMedia(entry.imageUrl)}
          alt=""
          style={{
            width: thumbSize, height: thumbSize, borderRadius: 6, objectFit: "cover",
            flexShrink: 0, background: t.codeBg,
          }}
          loading="lazy"
        />
      ) : (
        <div style={{
          width: thumbSize, height: thumbSize, borderRadius: 6, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${t.red}08`, color: t.red,
          fontSize: mobile ? 18 : 22, fontWeight: 900, opacity: 0.5,
        }}>
          {"\u2715"}
        </div>
      )}

      {/* Content area */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: mobile ? 2 : 3 }}>
        <div style={{
          fontSize: mobile ? 11 : 12, color: t.ink, lineHeight: 1.4,
          overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {entry.prompt}
        </div>
        <div
          onClick={(e) => { e.stopPropagation(); onOwnerClick(entry.ownerAddress); }}
          style={{
            fontSize: 10, fontFamily: "'SF Mono','Fira Code',monospace",
            color: t.blue, cursor: "pointer",
            textDecoration: "underline", textDecorationColor: `${t.blue}40`,
          }}
          title={`View all by ${entry.ownerAddress}`}
        >
          {entry.ownerAddress.slice(0, 6)}...{entry.ownerAddress.slice(-4)}
        </div>
      </div>

      {/* Right column: badge, status, time */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span style={{
            fontSize: 10, fontWeight: 800, color: t.blue,
            fontFamily: "'SF Mono','Fira Code',monospace",
          }}>
            #{entry.agentId}
          </span>
          {(() => {
            const tier = TIER_META[entry.tier] || TIER_META[1];
            return (
              <span style={{
                fontSize: 9, fontWeight: 800, color: tier.color,
                padding: "1px 5px", borderRadius: 3,
                background: `${tier.color}15`, border: `1px solid ${tier.color}30`,
                letterSpacing: 0.5, textTransform: "uppercase",
              }}>
                {tier.label}
              </span>
            );
          })()}
          {entry.tier >= 4 && (
            <span title="TEE-attested verification" style={{
              fontSize: 9, fontWeight: 800, color: "#f59e0b",
              padding: "1px 4px", borderRadius: 3,
              background: "#f59e0b15", border: "1px solid #f59e0b30",
              letterSpacing: 0.3, textTransform: "uppercase", cursor: "default",
            }}>
              TEE
            </span>
          )}
          {entry.humanVerified && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: t.green,
              padding: "1px 4px", borderRadius: 3,
              background: `${t.green}15`, border: `1px solid ${t.green}30`,
              letterSpacing: 0.3, textTransform: "uppercase",
            }}>
              Human
            </span>
          )}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: granted ? t.green : t.red,
        }}>
          {granted ? "Approved" : "Denied"}
        </span>
        <LiveTimeAgo timestamp={entry.timestamp} />
      </div>
    </div>
  );
}

export function FeedListItemSkeleton() {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();
  const thumbSize = mobile ? 44 : 56;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: mobile ? 8 : 12,
      padding: mobile ? "8px 8px" : "8px 12px", minHeight: 72,
      borderBottom: `1px solid ${t.cardBorder}30`,
    }}>
      <div style={{
        width: thumbSize, height: thumbSize, borderRadius: 6, flexShrink: 0,
        background: t.codeBg, animation: "skeletonPulse 1.5s ease-in-out infinite",
      }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{
          width: "70%", height: 12, borderRadius: 4,
          background: `${t.cardBorder}50`,
          animation: "skeletonPulse 1.5s ease-in-out infinite",
        }} />
        <div style={{
          width: "35%", height: 10, borderRadius: 4,
          background: `${t.cardBorder}40`,
          animation: "skeletonPulse 1.5s ease-in-out infinite",
        }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <div style={{
          width: 40, height: 10, borderRadius: 4,
          background: `${t.cardBorder}50`,
          animation: "skeletonPulse 1.5s ease-in-out infinite",
        }} />
        <div style={{
          width: 30, height: 9, borderRadius: 4,
          background: `${t.cardBorder}40`,
          animation: "skeletonPulse 1.5s ease-in-out infinite",
        }} />
      </div>
    </div>
  );
}
