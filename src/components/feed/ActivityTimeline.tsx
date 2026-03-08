"use client";

import { useContext, useState, useEffect, useRef, useCallback } from "react";
import { ThemeCtx } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";

interface ActivityEvent {
  id: string;
  type: string;
  agentId: string;
  ownerAddress: string;
  txHash?: string;
  detail?: string;
  timestamp: number;
}

const BASESCAN = "https://sepolia.basescan.org";

const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  register: { label: "Registered", color: "#3b82f6", icon: "+" },
  approve: { label: "Approved", color: "#6366f1", icon: "\u2713" },
  worldid: { label: "Human Verified", color: "#22c55e", icon: "\u2022" },
  kyc: { label: "KYC Submitted", color: "#14b8a6", icon: "K" },
  credit: { label: "Credit Submitted", color: "#f59e0b", icon: "C" },
  generation: { label: "Generated", color: "#ec4899", icon: "\u25CF" },
};

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

function useTimeAgo(ts: number): string {
  const [, setTick] = useState(0);
  useEffect(() => subscribeTick(() => setTick((t) => t + 1)), []);

  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function ActivityPill({ ev, isNew }: { ev: ActivityEvent; isNew: boolean }) {
  const { t } = useContext(ThemeCtx);
  const meta = TYPE_META[ev.type] || TYPE_META.register;
  const ago = useTimeAgo(ev.timestamp);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 7px",
        borderRadius: 5,
        background: `${meta.color}06`,
        border: `1px solid ${meta.color}${isNew ? "40" : "15"}`,
        flexShrink: 0,
        animation: isNew ? "activitySlideIn .4s ease-out" : undefined,
        boxShadow: isNew ? `0 0 10px ${meta.color}20` : "none",
        transition: "border-color .6s, box-shadow .6s",
      }}
    >
      <span style={{
        width: 14, height: 14, borderRadius: 3,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${meta.color}12`,
        color: meta.color,
        fontSize: 8, fontWeight: 900,
        fontFamily: "'SF Mono','Fira Code',monospace",
        flexShrink: 0,
      }}>
        {meta.icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 8, fontWeight: 700,
          color: meta.color,
          whiteSpace: "nowrap",
          lineHeight: "12px",
        }}>
          {meta.label}
        </div>
        <div style={{
          fontSize: 7, color: t.inkMuted,
          fontFamily: "'SF Mono','Fira Code',monospace",
          display: "flex", alignItems: "center", gap: 3,
          lineHeight: "10px",
        }}>
          <span style={{ color: t.blue, fontWeight: 700 }}>#{ev.agentId}</span>
          <span style={{ opacity: 0.4 }}>{ago}</span>
          {ev.txHash && (
            <a
              href={`${BASESCAN}/tx/${ev.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: t.blue, textDecoration: "none",
                opacity: 0.5, fontSize: 7,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              tx{"\u2197"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/** Sparkline — 24 bars for the last 24h (1h buckets) */
function Sparkline({ events, color }: { events: ActivityEvent[]; color: string }) {
  const bucketCount = 24;
  const bucketMs = 60 * 60 * 1000; // 1 hour
  const now = Date.now();
  const buckets = new Array(bucketCount).fill(0);

  for (const ev of events) {
    const age = now - ev.timestamp;
    if (age > bucketCount * bucketMs) continue;
    const idx = bucketCount - 1 - Math.floor(age / bucketMs);
    if (idx >= 0 && idx < bucketCount) buckets[idx]++;
  }

  const max = Math.max(...buckets, 1);
  const w = 72;
  const h = 14;
  const gap = 1;
  const barW = (w - (bucketCount - 1) * gap) / bucketCount;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
      <svg width={w} height={h} style={{ opacity: 0.6 }}>
        {buckets.map((count, i) => {
          const barH = Math.max((count / max) * h, count > 0 ? 1.5 : 0.5);
          return (
            <rect
              key={i}
              x={i * (barW + gap)}
              y={h - barH}
              width={barW}
              height={barH}
              rx={0.5}
              fill={count > 0 ? color : `${color}18`}
              style={{ transition: "height .4s ease, y .4s ease" }}
            />
          );
        })}
      </svg>
      <span style={{
        fontSize: 7, color: `${color}80`,
        fontFamily: "'SF Mono','Fira Code',monospace",
        whiteSpace: "nowrap",
      }}>
        24h
      </span>
    </div>
  );
}

export function ActivityTimeline() {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  const markNew = useCallback((id: string) => {
    setNewIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 3000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const resp = await fetch("/api/activity?limit=50");
        if (!resp.ok) return;
        const data = await resp.json();
        if (!cancelled) {
          setEvents(data.events || []);
          initialLoadDone.current = true;
        }
      } catch {}
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!initialLoadDone.current) return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      eventSource = new EventSource("/api/activity?stream=true");

      eventSource.onmessage = (msg) => {
        try {
          const ev: ActivityEvent = JSON.parse(msg.data);
          setEvents((prev) => {
            if (prev.some((e) => e.id === ev.id)) return prev;
            return [ev, ...prev].slice(0, 50);
          });
          markNew(ev.id);

          if (scrollRef.current) {
            scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
          }
        } catch { /* ignore keepalive */ }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimer);
    };
  }, [loading, markNew]);

  if (loading && events.length === 0) return null;
  if (events.length === 0) return null;

  return (
    <div style={{
      padding: mobile ? "6px 8px" : "8px 20px",
      borderBottom: `1px solid ${t.cardBorder}15`,
    }}>
      {/* Header + sparkline */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        marginBottom: 6,
      }}>
        <span style={{
          width: 4, height: 4, borderRadius: "50%",
          background: "#22c55e",
          animation: "demoPulse 2s ease-in-out infinite",
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 8, fontWeight: 800, letterSpacing: 1.5,
          textTransform: "uppercase", color: `${t.inkMuted}90`,
        }}>
          Activity
        </span>
        <Sparkline events={events} color={t.blue} />
      </div>

      {/* Horizontal scrollable pills */}
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          gap: 4,
          overflowX: "auto",
          paddingBottom: 2,
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
          maskImage: "linear-gradient(90deg, black 0%, black 92%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(90deg, black 0%, black 92%, transparent 100%)",
        } as React.CSSProperties}
      >
        {events.map((ev) => (
          <ActivityPill key={ev.id} ev={ev} isNew={newIds.has(ev.id)} />
        ))}
      </div>

      <style>{`
        @keyframes activitySlideIn {
          from { opacity: 0; transform: translateX(-16px) scale(0.96); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
