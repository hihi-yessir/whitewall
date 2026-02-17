"use client";

import { useState, useEffect, useRef, useCallback, useContext } from "react";
import { themes, ThemeCtx } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import { MeshBG } from "../shared/MeshBG";
import { FeedNav } from "./FeedNav";
import { FeedToolbar } from "./FeedToolbar";
import { FeedListItem, FeedListItemSkeleton } from "./FeedListItem";
import { FeedDetail } from "./FeedDetail";
import type { Generation, FeedStats, FeedResponse } from "./types";
import type { ThemeMode } from "../shared/theme";

export default function FeedPage() {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const toggle = () => setMode((m) => (m === "dark" ? "light" : "dark"));
  const t = themes[mode];
  const mobile = useIsMobile();

  const [entries, setEntries] = useState<Generation[]>([]);
  const [stats, setStats] = useState<FeedStats>({ total: 0, granted: 0, denied: 0, uniqueAgents: 0 });
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<Generation | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleOwnerClick = useCallback((address: string) => {
    setSearchInput(address);
    setOwnerFilter(address);
    setSelectedEntry(null);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const trimmed = searchInput.trim();
    if (trimmed && trimmed.startsWith("0x")) {
      setOwnerFilter(trimmed);
    } else if (!trimmed) {
      setOwnerFilter(null);
    }
  }, [searchInput]);

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setOwnerFilter(null);
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
            }));
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
  }, [ownerFilter]);

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

  const detailOpen = selectedEntry !== null;

  return (
    <ThemeCtx.Provider value={{ mode, toggle, t }}>
      <div style={{
        background: t.bg, minHeight: "100vh", color: t.ink,
        fontFamily: "'Inter',system-ui,-apple-system,sans-serif",
        display: "flex", flexDirection: "column",
        transition: "background .4s, color .4s",
      }}>
        <MeshBG />

        {/* Edge fade — matches demo page */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
          background: mobile
            ? `linear-gradient(90deg,${t.bg}AA 0%,transparent 25%,transparent 75%,${t.bg}AA 100%),linear-gradient(180deg,${t.bg} 0%,transparent 15%,transparent 90%,${t.bg} 100%)`
            : `linear-gradient(90deg,${t.bg} 0%,${t.bg}BB 12%,${t.bg}55 30%,transparent 50%,transparent 92%,${t.bg} 100%),linear-gradient(180deg,${t.bg} 0%,transparent 15%,transparent 90%,${t.bg} 100%)`,
          transition: "background .4s",
        }} />

        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <FeedNav />

          {/* Main content area — frosted panel matching demo */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            margin: mobile ? 8 : 16,
            background: `${t.card}B0`,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: `1px solid ${t.cardBorder}40`,
            borderRadius: 14,
            overflow: "hidden",
            transition: "background .4s, border-color .4s",
          }}>
            {/* Toolbar inside the frosted panel */}
            <div style={{
              padding: mobile ? "0 8px" : "0 20px",
              borderBottom: `1px solid ${t.cardBorder}30`,
            }}>
              <FeedToolbar
                stats={stats}
                searchValue={searchInput}
                onSearchChange={setSearchInput}
                onSearchSubmit={handleSearchSubmit}
                onClearSearch={handleClearSearch}
                isFiltering={ownerFilter !== null}
              />
            </div>

            {/* List + detail flex container */}
            <div style={{
              flex: 1, display: "flex", minHeight: 0,
              position: "relative",
            }}>
              {/* List area */}
              <div style={{
                flex: 1,
                maxWidth: !mobile && detailOpen ? "calc(100% - 400px)" : "100%",
                transition: "max-width .25s ease-out",
                overflowY: "auto",
                minHeight: 0,
              }}>
                {loading ? (
                  <div>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <FeedListItemSkeleton key={i} />
                    ))}
                  </div>
                ) : entries.length === 0 ? (
                  <div style={{
                    textAlign: "center", padding: "80px 20px",
                    color: t.inkMuted, fontSize: 14,
                  }}>
                    <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 12 }}>{"\u2205"}</div>
                    {ownerFilter
                      ? "No generations found for this owner."
                      : <>No generations yet. Be the first — try the{" "}<a href="/demo" style={{ color: t.blue, textDecoration: "none", fontWeight: 600 }}>demo</a>.</>
                    }
                  </div>
                ) : (
                  <div>
                    {entries.map((entry) => (
                      <FeedListItem
                        key={entry.id}
                        entry={entry}
                        isSelected={selectedEntry?.id === entry.id}
                        onSelect={() => setSelectedEntry(entry)}
                        onOwnerClick={handleOwnerClick}
                      />
                    ))}
                  </div>
                )}

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} style={{ height: 1 }} />

                {loadingMore && (
                  <div>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <FeedListItemSkeleton key={`more-${i}`} />
                    ))}
                  </div>
                )}

                {!hasMore && entries.length > 0 && (
                  <div style={{
                    textAlign: "center", padding: "24px 0 48px",
                    fontSize: 11, color: t.inkMuted, letterSpacing: 1, textTransform: "uppercase",
                  }}>
                    End of feed
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
          ::selection { background: ${t.blue}30; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: ${t.bg}; }
          ::-webkit-scrollbar-thumb { background: ${t.blue}; border-radius: 3px; }
        `}</style>
      </div>
    </ThemeCtx.Provider>
  );
}
