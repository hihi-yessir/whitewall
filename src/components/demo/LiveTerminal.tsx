"use client";

import { useContext, useEffect, useRef } from "react";
import { ThemeCtx } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import type { TerminalEntry } from "./types";

export function LiveTerminal({ entries }: { entries: TerminalEntry[] }) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  const tagColor = (status: TerminalEntry['status']) => {
    switch (status) {
      case 'pass': return t.green;
      case 'fail': return t.red;
      case 'warn': return "#E8A317";
      default: return t.blue;
    }
  };

  const statusIcon = (status: TerminalEntry['status']) => {
    switch (status) {
      case 'pass': return '\u2713';
      case 'fail': return '\u2717';
      case 'warn': return '!';
      default: return '\u203A';
    }
  };

  return (
    <div style={{
      background: `${t.codeBg}80`,
      borderTop: `1px solid ${t.cardBorder}30`,
      height: mobile ? 200 : 220,
      display: "flex", flexDirection: "column",
      marginTop: "auto",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 16px", background: `${t.codeHeader}CC`,
        borderBottom: `1px solid ${t.cardBorder}`,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: 4, background: entries.some(e => e.status === 'fail') ? t.red : t.green, opacity: 0.8 }} />
        <span style={{ fontSize: 11, color: t.inkMuted, fontFamily: "monospace", fontWeight: 600 }}>LIVE TERMINAL</span>
      </div>
      <div ref={scrollRef} style={{
        flex: 1, overflowY: "auto", padding: mobile ? "8px 12px" : "12px 16px",
      }}>
        {entries.length === 0 ? (
          <div style={{ color: t.inkMuted, fontSize: 12, fontFamily: "monospace", opacity: 0.5 }}>
            Waiting for pipeline execution...
          </div>
        ) : (
          entries.map((entry, i) => (
            <div key={i} style={{
              fontFamily: "'SF Mono','Fira Code',monospace", fontSize: mobile ? 11 : 12,
              lineHeight: 1.8, display: "flex", gap: 8, alignItems: "baseline",
              opacity: 0, animation: "termFadeIn .3s forwards",
              animationDelay: `${i * 0.05}s`,
            }}>
              <span style={{
                color: tagColor(entry.status), fontWeight: 700, fontSize: 10,
                minWidth: 14, textAlign: "center",
              }}>
                {statusIcon(entry.status)}
              </span>
              <span style={{
                color: tagColor(entry.status), fontWeight: 700, fontSize: 10,
                background: `${tagColor(entry.status)}15`,
                padding: "1px 6px", borderRadius: 3, whiteSpace: "nowrap",
              }}>
                {entry.tag}
              </span>
              <span style={{ color: t.ink }}>{entry.message}</span>
              {entry.status === 'pass' && (
                <span style={{ color: t.green, fontSize: 10, opacity: 0.6 }}>(pass)</span>
              )}
              {entry.status === 'fail' && (
                <span style={{ color: t.red, fontSize: 10, fontWeight: 700 }}>REJECTED</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
