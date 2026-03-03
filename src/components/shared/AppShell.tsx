"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { themes, ThemeCtx } from "./theme";
import { MeshBG } from "./MeshBG";
import type { ThemeMode } from "./theme";

// Read theme from localStorage — called on client only
function getStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem("ww-theme");
    if (v === "light") return "light";
  } catch {}
  return "dark";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  // Start hidden on server, show immediately on client with correct theme
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,   // client
    () => false,   // server
  );

  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") return getStoredTheme();
    return "dark";
  });

  const toggle = useCallback(() => {
    setMode((m) => {
      const next = m === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("ww-theme", next);
        document.documentElement.setAttribute("data-theme", next);
      } catch {}
      return next;
    });
  }, []);

  const t = themes[mode];

  // On server render, return nothing — the blocking CSS handles the background
  // On client, render immediately with the correct theme from localStorage
  if (!isClient) return null;

  return (
    <ThemeCtx.Provider value={{ mode, toggle, t }}>
      <div style={{
        background: t.bg, minHeight: "100vh", color: t.ink,
        fontFamily: "'Inter',system-ui,-apple-system,sans-serif",
        transition: "background .4s, color .4s",
      }}>
        <MeshBG />
        {children}
      </div>
    </ThemeCtx.Provider>
  );
}
