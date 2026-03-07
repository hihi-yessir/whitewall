"use client";

import { useContext, useState, useEffect, useCallback, useRef } from "react";
import { ThemeCtx, ThemeToggle } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";

const ADMIN_ADDRESS = "0x0d10F69243B8A2FE4299FA4cC115c3023F4011CF";

export function FeedNav({ onAdminReset }: { onAdminReset?: () => void }) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();
  const [isAdmin, setIsAdmin] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Check if already-connected wallet is the admin address (passive, no prompt)
  useEffect(() => {
    async function check() {
      try {
        const eth = (window as any).ethereum;
        if (!eth) return;
        const accounts: string[] = await eth.request({ method: "eth_accounts" });
        if (accounts.length > 0 && accounts[0].toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
          setIsAdmin(true);
        }
      } catch {}
    }
    check();

    const eth = (window as any).ethereum;
    if (eth?.on) {
      const handler = (accounts: string[]) => {
        setIsAdmin(accounts.length > 0 && accounts[0].toLowerCase() === ADMIN_ADDRESS.toLowerCase());
        if (!accounts.length || accounts[0].toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
          setPanelOpen(false);
        }
      };
      eth.on("accountsChanged", handler);
      return () => eth.removeListener("accountsChanged", handler);
    }
  }, []);

  // Active wallet connect — triggered by clicking the "Public Feed" badge
  const handleBadgeClick = useCallback(async () => {
    if (isAdmin) { setPanelOpen((p) => !p); return; }
    try {
      const eth = (window as any).ethereum;
      if (!eth) return;
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      if (accounts.length > 0 && accounts[0].toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
        setIsAdmin(true);
        setPanelOpen(true);
      }
    } catch {}
  }, [isAdmin]);

  // Close panel on outside click
  useEffect(() => {
    if (!panelOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [panelOpen]);

  const handleReset = useCallback(async () => {
    if (resetting) return;
    setResetting(true);
    try {
      const resp = await fetch("/api/admin/reset-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: process.env.NEXT_PUBLIC_ADMIN_SECRET || "" }),
      });
      // Fallback: prompt for secret if env var not set
      if (resp.status === 401) {
        const secret = prompt("Admin secret:");
        if (!secret) { setResetting(false); return; }
        const retry = await fetch("/api/admin/reset-feed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secret }),
        });
        const data = await retry.json();
        if (retry.ok && data.success) {
          onAdminReset?.();
          setPanelOpen(false);
        } else {
          alert(data.error || "Reset failed");
        }
      } else {
        const data = await resp.json();
        if (resp.ok && data.success) {
          onAdminReset?.();
          setPanelOpen(false);
        } else {
          alert(data.error || "Reset failed");
        }
      }
    } catch {
      alert("Reset request failed");
    } finally {
      setResetting(false);
    }
  }, [resetting, onAdminReset]);

  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: mobile ? "12px 16px" : "14px 32px",
      borderBottom: `1px solid ${t.cardBorder}40`,
      background: `${t.bg}B0`, backdropFilter: "blur(12px)",
      position: "sticky", top: 0, zIndex: 20,
    }}>
      {/* Left: logo + label */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/" style={{
          display: "flex", alignItems: "center", gap: 6,
          textDecoration: "none", color: t.ink,
        }}>
          <div style={{ display: "flex", gap: 2 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 4, height: 22, borderRadius: 1, background: t.ink, opacity: t.logoDots[i], transition: "background .4s" }} />
            ))}
          </div>
          {!mobile && <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: 1, textTransform: "uppercase" }}>Whitewall</span>}
        </a>
        <div ref={panelRef} style={{ position: "relative" }}>
          <button
            onClick={handleBadgeClick}
            style={{
              fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase",
              color: isAdmin ? t.red : t.blue, padding: "6px 10px", borderRadius: 4,
              minHeight: 44, display: "flex", alignItems: "center",
              background: isAdmin ? `${t.red}15` : `${t.blue}15`,
              border: `1px solid ${isAdmin ? `${t.red}30` : `${t.blue}30`}`,
              cursor: "pointer",
              transition: "all .2s",
            }}
            title={isAdmin ? "Admin — click to toggle panel" : "Public Feed"}
          >
            {isAdmin ? "\u2699 Admin" : "Public Feed"}
          </button>

          {/* Admin dropdown panel — anchored below the badge */}
          {panelOpen && isAdmin && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              minWidth: 200,
              maxWidth: "calc(100vw - 32px)",
              background: t.card,
              border: `1px solid ${t.cardBorder}60`,
              borderRadius: 10,
              padding: 16,
              boxShadow: `0 8px 32px ${t.bg}80`,
              zIndex: 30,
              animation: "resultAppear .2s ease",
            }}>
              <div style={{
                fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
                textTransform: "uppercase", color: t.inkMuted, marginBottom: 8,
              }}>
                Admin Panel
              </div>
              <div style={{
                fontSize: 10, color: t.inkMuted, marginBottom: 12, lineHeight: 1.5,
                fontFamily: "'SF Mono','Fira Code',monospace",
              }}>
                {ADMIN_ADDRESS.slice(0, 6)}...{ADMIN_ADDRESS.slice(-4)}
              </div>
              <button
                onClick={handleReset}
                disabled={resetting}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: `1.5px solid ${t.red}50`,
                  background: `${t.red}10`,
                  color: t.red,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: resetting ? "not-allowed" : "pointer",
                  opacity: resetting ? 0.5 : 1,
                  transition: "all .2s",
                }}
              >
                {resetting ? "Resetting..." : "Reset Feed DB"}
              </button>
              <div style={{
                fontSize: 8, color: `${t.inkMuted}80`, marginTop: 8,
                lineHeight: 1.4,
              }}>
                Flushes all generations and stats from Redis.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: nav links + theme toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/demo" style={{
          fontSize: 13, fontWeight: 600, color: t.inkMuted,
          textDecoration: "none", transition: "color .2s",
        }}>
          Demo
        </a>
        <a href="https://github.com/hihi-yessir/whitewall-os" target="_blank" rel="noopener noreferrer" style={{
          fontSize: 13, fontWeight: 600, color: t.inkMuted,
          textDecoration: "none", transition: "color .2s",
        }}>
          GitHub
        </a>
        <a href="/tryout" style={{
          fontSize: 12, fontWeight: 700, color: t.ink,
          textDecoration: "none", letterSpacing: 1, textTransform: "uppercase",
          padding: "4px 10px", borderRadius: 4,
          background: `${t.blue}15`, border: `1px solid ${t.blue}30`,
          transition: "all .2s",
        }}>
          Register {"\u2192"}
        </a>
        <ThemeToggle />
      </div>
    </nav>
  );
}
