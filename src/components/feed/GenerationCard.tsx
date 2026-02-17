"use client";

import { useContext, useState } from "react";
import { ThemeCtx } from "../shared/theme";
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

export function GenerationCard({ entry, onOwnerClick }: { entry: Generation; onOwnerClick?: (address: string) => void }) {
  const { t } = useContext(ThemeCtx);
  const [expanded, setExpanded] = useState(false);
  const granted = entry.status === "granted";
  const borderColor = granted ? t.green : t.red;

  return (
    <div style={{
      borderRadius: 12, overflow: "hidden",
      border: `1.5px solid ${granted ? `${t.cardBorder}` : `${t.red}40`}`,
      background: `${t.card}CC`,
      transition: "border-color .2s, transform .2s",
      animation: "resultAppear .5s cubic-bezier(.16,1,.3,1)",
    }}>
      {/* Image or denied placeholder */}
      {granted && entry.imageUrl ? (
        <div style={{ position: "relative", aspectRatio: "1", overflow: "hidden", background: t.codeBg }}>
          <img
            src={entry.imageUrl}
            alt={entry.prompt}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            loading="lazy"
          />
        </div>
      ) : (
        <div style={{
          aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
          background: `${t.red}08`, color: t.red,
          fontSize: 48, fontWeight: 900, opacity: 0.3,
        }}>
          {"\u2715"}
        </div>
      )}

      {/* License plate */}
      <div style={{ padding: "10px 12px" }}>
        {/* Top row: agent badge + timestamp */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 6,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 800, color: t.blue,
              fontFamily: "'SF Mono','Fira Code',monospace",
            }}>
              #{entry.agentId}
            </span>
            {entry.humanVerified && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: t.green,
                padding: "1px 5px", borderRadius: 3,
                background: `${t.green}15`, border: `1px solid ${t.green}30`,
                letterSpacing: 0.5, textTransform: "uppercase",
              }}>
                Human
              </span>
            )}
          </div>
          <span style={{ fontSize: 10, color: t.inkMuted }}>{timeAgo(entry.timestamp)}</span>
        </div>

        {/* Owner address */}
        <div
          onClick={(e) => { if (onOwnerClick) { e.stopPropagation(); onOwnerClick(entry.ownerAddress); } }}
          style={{
            fontSize: 10, fontFamily: "'SF Mono','Fira Code',monospace",
            color: onOwnerClick ? t.blue : t.inkMuted, marginBottom: 6,
            cursor: onOwnerClick ? "pointer" : "default",
            textDecoration: onOwnerClick ? "underline" : "none",
            textDecorationColor: `${t.blue}40`,
          }}
          title={onOwnerClick ? `View all generations by ${entry.ownerAddress}` : entry.ownerAddress}
        >
          {entry.ownerAddress.slice(0, 6)}...{entry.ownerAddress.slice(-4)}
        </div>

        {/* Prompt (truncated, expand on click) */}
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            fontSize: 11, color: t.ink, lineHeight: 1.4, cursor: "pointer",
            overflow: expanded ? "visible" : "hidden",
            display: expanded ? "block" : "-webkit-box",
            WebkitLineClamp: expanded ? undefined : 2,
            WebkitBoxOrient: "vertical" as const,
          }}
        >
          {entry.prompt}
        </div>

        {/* Denied reason */}
        {!granted && entry.reason && (
          <div style={{
            marginTop: 6, fontSize: 10, color: t.red,
            padding: "4px 8px", borderRadius: 4,
            background: `${t.red}10`,
          }}>
            {entry.reason}
          </div>
        )}
      </div>
    </div>
  );
}

/** Loading skeleton placeholder */
export function GenerationCardSkeleton() {
  const { t } = useContext(ThemeCtx);

  return (
    <div style={{
      borderRadius: 12, overflow: "hidden",
      border: `1.5px solid ${t.cardBorder}40`,
      background: `${t.card}80`,
    }}>
      <div style={{
        aspectRatio: "1", background: `${t.codeBg}`,
        animation: "skeletonPulse 1.5s ease-in-out infinite",
      }} />
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ width: "40%", height: 12, borderRadius: 4, background: `${t.cardBorder}60`, animation: "skeletonPulse 1.5s ease-in-out infinite" }} />
        <div style={{ width: "60%", height: 10, borderRadius: 4, background: `${t.cardBorder}40`, animation: "skeletonPulse 1.5s ease-in-out infinite" }} />
        <div style={{ width: "80%", height: 10, borderRadius: 4, background: `${t.cardBorder}40`, animation: "skeletonPulse 1.5s ease-in-out infinite" }} />
      </div>
    </div>
  );
}
