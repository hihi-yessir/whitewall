"use client";

import { useContext, useState, useEffect } from "react";
import { ThemeCtx } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import type { Generation } from "./types";
import { TIER_META } from "./types";
import { proxyMedia } from "@/lib/media";

let tickListeners = new Set<() => void>();
let tickInterval: ReturnType<typeof setInterval> | null = null;

function subscribeTick(cb: () => void) {
  tickListeners.add(cb);
  if (!tickInterval) {
    tickInterval = setInterval(() => tickListeners.forEach((fn) => fn()), 1000);
  }
  return () => {
    tickListeners.delete(cb);
    if (tickListeners.size === 0 && tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  };
}

function LiveTimeAgo({ timestamp }: { timestamp: number }) {
  const { t } = useContext(ThemeCtx);
  const [, setTick] = useState(0);
  useEffect(() => subscribeTick(() => setTick((n) => n + 1)), []);

  const diff = Date.now() - timestamp;
  const secs = Math.floor(diff / 1000);
  let label: string;
  if (secs < 60) label = `${secs}s`;
  else if (secs < 3600) label = `${Math.floor(secs / 60)}m`;
  else if (secs < 86400) label = `${Math.floor(secs / 3600)}h`;
  else label = `${Math.floor(secs / 86400)}d`;

  return <span style={{ fontSize: 9, color: `${t.inkMuted}80` }}>{label}</span>;
}

export interface AgentGroup {
  agentId: string;
  ownerAddress: string;
  tier: number;
  humanVerified: boolean;
  entries: Generation[];
  latestTimestamp: number;
}

export function groupByAgent(entries: Generation[]): AgentGroup[] {
  const map = new Map<string, AgentGroup>();
  for (const entry of entries) {
    let group = map.get(entry.agentId);
    if (!group) {
      group = {
        agentId: entry.agentId,
        ownerAddress: entry.ownerAddress,
        tier: entry.tier,
        humanVerified: entry.humanVerified,
        entries: [],
        latestTimestamp: entry.timestamp,
      };
      map.set(entry.agentId, group);
    }
    group.entries.push(entry);
    if (entry.tier > group.tier) group.tier = entry.tier;
    if (entry.humanVerified) group.humanVerified = true;
    if (entry.timestamp > group.latestTimestamp) group.latestTimestamp = entry.timestamp;
  }
  return Array.from(map.values()).sort((a, b) => b.latestTimestamp - a.latestTimestamp);
}

function Thumbnail({ entry, size, onSelect }: {
  entry: Generation;
  size: number;
  onSelect: () => void;
}) {
  const { t } = useContext(ThemeCtx);
  const granted = entry.status === "granted";
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: size, height: size,
        borderRadius: 6,
        overflow: "hidden",
        cursor: "pointer",
        border: `1px solid ${hovered ? t.blue : granted ? `${t.cardBorder}20` : `${t.red}20`}`,
        position: "relative",
        transition: "border-color .15s, transform .12s",
        transform: hovered ? "scale(1.03)" : "scale(1)",
      }}
      title={entry.prompt}
    >
      {granted && entry.imageUrl ? (
        <img
          src={proxyMedia(entry.imageUrl)}
          alt=""
          style={{
            width: "100%", height: "100%",
            objectFit: "cover", display: "block",
            background: t.codeBg,
          }}
          loading="lazy"
        />
      ) : (
        <div style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${t.red}04`, color: t.red,
          fontSize: 12, fontWeight: 900, opacity: 0.25,
        }}>
          {"\u2715"}
        </div>
      )}
      {hovered && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "2px 4px",
          background: `${t.bg}DD`,
          fontSize: 7, color: t.ink,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {entry.prompt.slice(0, 36)}
        </div>
      )}
    </div>
  );
}

export function FeedAgentCard({ group, isNew, onSelectEntry, onOwnerClick }: {
  group: AgentGroup;
  isNew?: boolean;
  onSelectEntry: (entry: Generation) => void;
  onOwnerClick: (address: string) => void;
}) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();
  const tier = TIER_META[group.tier] || TIER_META[1];
  const thumbSize = mobile ? 52 : 64;

  return (
    <div style={{
      margin: mobile ? "4px 4px" : "6px 12px",
      padding: mobile ? "10px 10px" : "12px 14px",
      borderRadius: 10,
      background: `${t.card}50`,
      border: `1px solid ${isNew ? `${t.blue}25` : `${t.cardBorder}15`}`,
      animation: isNew ? "feedEntryHighlight 2.5s ease-out" : undefined,
      transition: "border-color .6s",
    }}>
      {/* Agent row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: group.entries.length > 0 ? 10 : 0,
      }}>
        {/* Agent ID — compact inline badge */}
        <span style={{
          fontSize: 11, fontWeight: 800, color: t.blue,
          fontFamily: "'SF Mono','Fira Code',monospace",
          padding: "2px 8px",
          borderRadius: 6,
          background: `${t.blue}08`,
          border: `1px solid ${t.blue}15`,
          lineHeight: "18px",
          flexShrink: 0,
        }}>
          #{group.agentId}
        </span>

        {/* Tier + verification badges */}
        <span style={{
          fontSize: 9, fontWeight: 800, color: tier.color,
          padding: "1px 5px", borderRadius: 3,
          background: `${tier.color}08`, border: `1px solid ${tier.color}15`,
          letterSpacing: 0.5, textTransform: "uppercase",
          lineHeight: "14px",
        }}>
          {tier.label}
        </span>
        {group.humanVerified && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: t.green,
            padding: "1px 5px", borderRadius: 3,
            background: `${t.green}08`, border: `1px solid ${t.green}15`,
            lineHeight: "14px", textTransform: "uppercase",
          }}>
            Human
          </span>
        )}
        {group.tier >= 4 && (
          <span style={{
            fontSize: 9, fontWeight: 800, color: "#f59e0b",
            padding: "1px 5px", borderRadius: 3,
            background: "#f59e0b08", border: "1px solid #f59e0b15",
            lineHeight: "14px", textTransform: "uppercase",
          }}>
            TEE
          </span>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Owner */}
        <span
          onClick={() => onOwnerClick(group.ownerAddress)}
          style={{
            fontSize: 10, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 3,
            transition: "color .15s",
            color: `${t.inkMuted}99`,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = t.blue; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = `${t.inkMuted}99`; }}
          title={group.ownerAddress}
        >
          <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.6 }}>Owner</span>
          <span style={{ fontFamily: "'SF Mono','Fira Code',monospace" }}>
            {group.ownerAddress.slice(0, 6)}...{group.ownerAddress.slice(-4)}
          </span>
        </span>

        {/* Count + time */}
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          fontSize: 9, color: `${t.inkMuted}90`,
        }}>
          <span style={{ fontWeight: 600 }}>
            {group.entries.length} gen{group.entries.length !== 1 ? "s" : ""}
          </span>
          <span style={{ opacity: 0.3 }}>{"\u00B7"}</span>
          <LiveTimeAgo timestamp={group.latestTimestamp} />
        </div>
      </div>

      {/* Thumbnails grid */}
      {group.entries.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, ${thumbSize}px)`,
          gap: mobile ? 4 : 6,
        }}>
          {group.entries.map((entry) => (
            <Thumbnail
              key={entry.id}
              entry={entry}
              size={thumbSize}
              onSelect={() => onSelectEntry(entry)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FeedAgentCardSkeleton() {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();
  const thumbSize = mobile ? 52 : 64;

  return (
    <div style={{
      margin: mobile ? "4px 4px" : "6px 12px",
      padding: mobile ? "10px 10px" : "12px 14px",
      borderRadius: 10,
      background: `${t.card}30`,
      border: `1px solid ${t.cardBorder}10`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 52, height: 18, borderRadius: 6,
          background: `${t.cardBorder}20`,
          animation: "skeletonPulse 1.5s ease-in-out infinite",
        }} />
        <div style={{
          width: 28, height: 14, borderRadius: 3,
          background: `${t.cardBorder}18`,
          animation: "skeletonPulse 1.5s ease-in-out infinite",
        }} />
        <div style={{ flex: 1 }} />
        <div style={{
          width: 80, height: 12, borderRadius: 3,
          background: `${t.cardBorder}15`,
          animation: "skeletonPulse 1.5s ease-in-out infinite",
        }} />
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, ${thumbSize}px)`,
        gap: mobile ? 4 : 6,
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: thumbSize, height: thumbSize,
            borderRadius: 6, background: `${t.cardBorder}12`,
            animation: "skeletonPulse 1.5s ease-in-out infinite",
          }} />
        ))}
      </div>
    </div>
  );
}
