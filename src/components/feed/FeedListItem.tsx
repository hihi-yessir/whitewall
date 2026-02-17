"use client";

import { useContext } from "react";
import { ThemeCtx } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import type { Generation } from "./types";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function FeedListItem({ entry, isSelected, onSelect, onOwnerClick }: {
  entry: Generation;
  isSelected: boolean;
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
        borderLeft: isSelected ? `3px solid ${t.blue}` : "3px solid transparent",
        borderBottom: `1px solid ${t.cardBorder}30`,
        transition: "background .15s, border-color .15s",
        minHeight: 72,
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = `${t.card}80`; }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Thumbnail */}
      {granted && entry.imageUrl ? (
        <img
          src={entry.imageUrl}
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
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            fontSize: 10, fontWeight: 800, color: t.blue,
            fontFamily: "'SF Mono','Fira Code',monospace",
          }}>
            #{entry.agentId}
          </span>
          {entry.humanVerified && (
            <span style={{
              fontSize: 8, fontWeight: 700, color: t.green,
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
        <span style={{ fontSize: 9, color: t.inkMuted }}>{timeAgo(entry.timestamp)}</span>
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
