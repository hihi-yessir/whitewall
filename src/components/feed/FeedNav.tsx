"use client";

import { useContext, useState } from "react";
import { ThemeCtx, ThemeToggle } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";

export function FeedNav() {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();

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
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase",
          color: t.blue, padding: "3px 8px", borderRadius: 4,
          background: `${t.blue}15`, border: `1px solid ${t.blue}30`,
        }}>
          Public Feed
        </span>
      </div>

      {/* Right: demo link + theme toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/demo" style={{
          fontSize: 13, fontWeight: 600, color: t.inkMuted,
          textDecoration: "none", transition: "color .2s",
        }}>
          Demo
        </a>
        <ThemeToggle />
      </div>
    </nav>
  );
}
