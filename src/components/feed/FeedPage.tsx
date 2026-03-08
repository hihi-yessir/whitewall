"use client";

import { useState, useEffect, useRef, useCallback, useContext, useMemo } from "react";
import { ThemeCtx } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import { FeedNav } from "./FeedNav";
import { FeedToolbar } from "./FeedToolbar";
import { FeedAgentCard, FeedAgentCardSkeleton, groupByAgent } from "./FeedAgentCard";
import { FeedDetail } from "./FeedDetail";
import { ActivityTimeline } from "./ActivityTimeline";
import type { Generation, FeedStats, FeedResponse } from "./types";

export default function FeedPage() {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();

  const [entries, setEntries] = useState<Generation[]>([]);
  const [stats, setStats] = useState<FeedStats>({ total: 0, granted: 0, denied: 0, uniqueAgents: 0, teeVerified: 0 });
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [agentIdFilter, setAgentIdFilter] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<Generation | null>(null);
  const [newEntryIds, setNewEntryIds] = useState<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);

  const markEntryNew = useCallback((id: string) => {
    setNewEntryIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setNewEntryIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 3000);
  }, []);

  const handleOwnerClick = useCallback((address: string) => {
    setSearchInput(address);
    setOwnerFilter(address);
    setAgentIdFilter(null);
    setSelectedEntry(null);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const trimmed = searchInput.trim().replace(/^#/, "");
    if (!trimmed) {
      setOwnerFilter(null);
      setAgentIdFilter(null);
    } else if (trimmed.startsWith("0x")) {
      setOwnerFilter(trimmed);
      setAgentIdFilter(null);
    } else if (/^\d+$/.test(trimmed)) {
      setAgentIdFilter(trimmed);
      setOwnerFilter(null);
    } else {
      setOwnerFilter(null);
      setAgentIdFilter(trimmed);
    }
  }, [searchInput]);

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setOwnerFilter(null);
    setAgentIdFilter(null);
  }, []);

  // Initial load + reload when owner filter changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setSelectedEntry(null);
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (ownerFilter) params.set("owner", ownerFilter);
        const resp = await fetch(`/api/feed?${params}`);
        if (!resp.ok) throw new Error("Feed unavailable");
        const data: FeedResponse = await resp.json();
        if (cancelled) return;
        setEntries(data.entries);
        setStats(data.stats);
        setCursor(data.nextCursor);
        setHasMore(data.nextCursor !== null);
      } catch {
        // Feed unavailable (no env vars, etc.)
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [ownerFilter]);

  // SSE subscription for real-time updates (global feed only, not owner-filtered)
  useEffect(() => {
    if (ownerFilter) return;
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      eventSource = new EventSource("/api/feed?stream=true");

      eventSource.onmessage = (event) => {
        try {
          const entry: Generation = JSON.parse(event.data);
          setEntries((prev) => {
            if (prev.some(e => e.id === entry.id)) return prev;
            setStats((s) => ({
              total: s.total + 1,
              granted: s.granted + (entry.status === "granted" ? 1 : 0),
              denied: s.denied + (entry.status === "denied" ? 1 : 0),
              uniqueAgents: s.uniqueAgents,
              teeVerified: s.teeVerified + (entry.tier >= 4 ? 1 : 0),
            }));
            markEntryNew(entry.id);
            return [entry, ...prev];
          });
        } catch {
          // Ignore keepalive or malformed
        }
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
  }, [ownerFilter, markEntryNew]);

  // Infinite scroll via IntersectionObserver
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: "20", cursor });
      if (ownerFilter) params.set("owner", ownerFilter);
      const resp = await fetch(`/api/feed?${params}`);
      const data: FeedResponse = await resp.json();
      setEntries((prev) => {
        const existingIds = new Set(prev.map(e => e.id));
        const newEntries = data.entries.filter(e => !existingIds.has(e.id));
        return [...prev, ...newEntries];
      });
      setCursor(data.nextCursor);
      setHasMore(data.nextCursor !== null);
    } catch {
      // Ignore
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, cursor, ownerFilter]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleAdminReset = useCallback(async () => {
    setEntries([]);
    setStats({ total: 0, granted: 0, denied: 0, uniqueAgents: 0, teeVerified: 0 });
    setCursor(null);
    setHasMore(false);
    setSelectedEntry(null);
  }, []);

  const detailOpen = selectedEntry !== null;
  const isFiltering = ownerFilter !== null || agentIdFilter !== null;
  const filteredEntries = useMemo(() => {
    if (!agentIdFilter) return entries;
    return entries.filter((e) => e.agentId === agentIdFilter);
  }, [entries, agentIdFilter]);
  const agentGroups = useMemo(() => groupByAgent(filteredEntries), [filteredEntries]);

  return (
    <>
      {/* Edge fade — matches demo page */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
          background: mobile
            ? `linear-gradient(90deg,${t.bg}AA 0%,transparent 25%,transparent 75%,${t.bg}AA 100%),linear-gradient(180deg,${t.bg} 0%,transparent 15%,transparent 90%,${t.bg} 100%)`
            : `linear-gradient(90deg,${t.bg} 0%,${t.bg}BB 12%,${t.bg}55 30%,transparent 50%,transparent 92%,${t.bg} 100%),linear-gradient(180deg,${t.bg} 0%,transparent 15%,transparent 90%,${t.bg} 100%)`,
          transition: "background .4s",
        }} />

        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <FeedNav onAdminReset={handleAdminReset} />

          {/* Main content area — frosted panel */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            margin: mobile ? "8px 4px" : "12px 16px",
            background: `${t.card}A0`,
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            border: `1px solid ${t.cardBorder}30`,
            borderRadius: mobile ? 12 : 14,
            overflow: "hidden",
            transition: "background .4s, border-color .4s",
          }}>
            {/* Toolbar */}
            <div style={{
              padding: mobile ? "0 8px" : "0 20px",
              borderBottom: `1px solid ${t.cardBorder}20`,
            }}>
              <FeedToolbar
                stats={stats}
                searchValue={searchInput}
                onSearchChange={setSearchInput}
                onSearchSubmit={handleSearchSubmit}
                onClearSearch={handleClearSearch}
                isFiltering={isFiltering}
              />
            </div>

            {/* Activity timeline */}
            <ActivityTimeline />

            {/* Agent list + detail */}
            <div style={{
              flex: 1, display: "flex", minHeight: 0,
              position: "relative",
            }}>
              <div style={{
                flex: 1,
                maxWidth: !mobile && detailOpen ? "calc(100% - 400px)" : "100%",
                transition: "max-width .25s ease-out",
                overflowY: "auto",
                minHeight: 0,
              }}>
                {/* Section label */}
                {!loading && entries.length > 0 && (
                  <div style={{
                    padding: mobile ? "10px 12px 2px" : "14px 20px 2px",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <span style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
                      textTransform: "uppercase", color: `${t.inkMuted}70`,
                    }}>
                      Registered Agents
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: `${t.inkMuted}50`,
                    }}>
                      {agentGroups.length}
                    </span>
                  </div>
                )}

                {loading ? (
                  <div style={{ paddingTop: 4 }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <FeedAgentCardSkeleton key={i} />
                    ))}
                  </div>
                ) : entries.length === 0 ? (
                  <div style={{
                    textAlign: "center", padding: "80px 20px",
                    color: t.inkMuted, fontSize: 13,
                  }}>
                    <div style={{ fontSize: 28, opacity: 0.2, marginBottom: 10 }}>{"\u2205"}</div>
                    {ownerFilter
                      ? "No generations found for this owner."
                      : <>No agents registered yet.{" "}<a href="/tryout" style={{ color: t.blue, textDecoration: "none", fontWeight: 600 }}>Register yours</a>.</>
                    }
                  </div>
                ) : (
                  <div style={{ paddingBottom: 8 }}>
                    {agentGroups.map((group) => (
                      <FeedAgentCard
                        key={group.agentId}
                        group={group}
                        isNew={group.entries.some((e) => newEntryIds.has(e.id))}
                        onSelectEntry={setSelectedEntry}
                        onOwnerClick={handleOwnerClick}
                      />
                    ))}
                  </div>
                )}

                <div ref={sentinelRef} style={{ height: 1 }} />

                {loadingMore && (
                  <div>
                    {Array.from({ length: 2 }).map((_, i) => (
                      <FeedAgentCardSkeleton key={`more-${i}`} />
                    ))}
                  </div>
                )}

                {!hasMore && entries.length > 0 && (
                  <div style={{
                    textAlign: "center", padding: "20px 0 40px",
                    fontSize: 10, color: `${t.inkMuted}60`,
                    letterSpacing: 1, textTransform: "uppercase",
                  }}>
                    End of registry
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Detail panel — renders outside the frosted panel for proper fixed positioning */}
        {selectedEntry && (
          <FeedDetail
            entry={selectedEntry}
            onClose={() => setSelectedEntry(null)}
            onOwnerClick={handleOwnerClick}
          />
        )}

        <style>{`
          @keyframes demoPulse {
            0%, 100% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.1); }
          }
          @keyframes resultAppear {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: none; }
          }
          @keyframes skeletonPulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.8; }
          }
          @keyframes detailSlideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          @keyframes feedEntryHighlight {
            0% { background: ${t.blue}18; box-shadow: inset 0 0 0 1px ${t.blue}30; }
            100% { background: transparent; box-shadow: inset 0 0 0 1px transparent; }
          }
          ::selection { background: ${t.blue}30; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: ${t.bg}; }
          ::-webkit-scrollbar-thumb { background: ${t.blue}; border-radius: 3px; }
        `}</style>
    </>
  );
}
