"use client";

import { useState, useContext, createContext } from "react";

// ── Theme system ──

export const themes = {
  dark: {
    bg: "#0A0A0A",
    card: "#141414",
    cardBorder: "#222222",
    ink: "#EEEEEE",
    inkMuted: "#666666",
    blue: "#375BD2",
    blueDark: "#2A47A8",
    blueLight: "#5B7BF0",
    red: "#D94040",
    green: "#2EAD6B",
    meshLine: 0xffffff,
    dust: 0x444444,
    logoDots: [0.3, 0.6, 0.9],
    codeBg: "#0D0D0D",
    codeHeader: "#1A1A1A",
  },
  light: {
    bg: "#FAFAFA",
    card: "#FFFFFF",
    cardBorder: "#E0E0E0",
    ink: "#111111",
    inkMuted: "#999999",
    blue: "#375BD2",
    blueDark: "#2A47A8",
    blueLight: "#5B7BF0",
    red: "#D94040",
    green: "#2EAD6B",
    meshLine: 0x000000,
    dust: 0x999999,
    logoDots: [0.4, 0.6, 0.9],
    codeBg: "#F0F0F0",
    codeHeader: "#E8E8E8",
  },
};

export type ThemeMode = "dark" | "light";
export type Theme = (typeof themes)["dark"];

export interface ThemeContextValue {
  mode: ThemeMode;
  toggle: () => void;
  t: Theme;
}

export const ThemeCtx = createContext<ThemeContextValue>({
  mode: "dark",
  toggle: () => {},
  t: themes.dark,
});

// ── UI components ──

export function ThemeToggle() {
  const { mode, toggle, t } = useContext(ThemeCtx);
  const [h, setH] = useState(false);
  return (
    <button onClick={toggle} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${h ? t.blue : t.cardBorder}`,
        background: "transparent", cursor: "pointer", display: "flex", alignItems: "center",
        justifyContent: "center", transition: "all .2s", fontSize: 16, color: t.ink }}>
      {mode === "dark" ? "\u2600" : "\u263E"}
    </button>
  );
}

export function Btn({ children, primary, small, href, onClick, disabled, style: extraStyle }: {
  children: React.ReactNode; primary?: boolean; small?: boolean; href?: string;
  onClick?: () => void; disabled?: boolean; style?: React.CSSProperties;
}) {
  const { t } = useContext(ThemeCtx);
  const [h, setH] = useState(false);
  const pad = small ? "8px 18px" : "14px 32px";
  const fs = small ? 13 : 15;
  const bw = small ? 1.5 : 2;
  const base: React.CSSProperties = primary
    ? { padding: pad, borderRadius: 8, border: `${bw}px solid transparent`, background: h && !disabled ? t.blueLight : t.blue,
        color: "#fff", fontSize: fs, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
        transform: h && !disabled ? "translateY(-1px)" : "none", transition: "all .2s", textDecoration: "none",
        display: "inline-block", opacity: disabled ? 0.5 : 1, ...extraStyle }
    : { padding: pad, borderRadius: 8, border: `${bw}px solid ${h && !disabled ? t.ink : t.cardBorder}`,
        background: "transparent", color: t.ink, fontSize: fs, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer", transition: "all .2s", textDecoration: "none",
        display: "inline-block", opacity: disabled ? 0.5 : 1, ...extraStyle };
  const Tag = href ? "a" : "button";
  return (
    <Tag style={base} href={href} onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      {children}
    </Tag>
  );
}

export function NavLink({ children, href }: { children: React.ReactNode; href?: string }) {
  const { t } = useContext(ThemeCtx);
  const [h, setH] = useState(false);
  return (
    <a href={href || "#"} style={{ color: h ? t.ink : t.inkMuted, textDecoration: "none", fontSize: 14, fontWeight: 600, transition: "color .2s" }}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      {children}
    </a>
  );
}

interface CodeBlock {
  file: string;
  lines: { text: string; color?: string }[];
}

export function CodeViewer({ code, colorMap }: { code: CodeBlock; colorMap: Record<string, string> }) {
  const { t } = useContext(ThemeCtx);
  return (
    <div style={{
      borderRadius: 12, overflow: "hidden",
      border: `1.5px solid ${t.cardBorder}`, background: `${t.codeBg}CC`, backdropFilter: "blur(8px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: `${t.codeHeader}CC`, borderBottom: `1px solid ${t.cardBorder}` }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, background: t.red, opacity: 0.8 }} />
        <div style={{ width: 10, height: 10, borderRadius: 5, background: "#E8A317", opacity: 0.8 }} />
        <div style={{ width: 10, height: 10, borderRadius: 5, background: t.green, opacity: 0.8 }} />
        <span style={{ marginLeft: 8, fontSize: 12, color: t.inkMuted, fontFamily: "monospace" }}>{code.file}</span>
      </div>
      <div style={{ padding: "20px 24px", overflowX: "auto" }}>
        <pre style={{ margin: 0, fontFamily: "'SF Mono','Fira Code',monospace", fontSize: 13, lineHeight: 1.7 }}>
          {code.lines.map((line, i) => (
            <div key={i} style={{ color: colorMap[line.color || "default"], minHeight: "1.7em" }}>
              {line.text || "\u00A0"}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
