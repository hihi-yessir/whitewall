"use client";

import { useContext, useState, useRef, useEffect } from "react";
import { ThemeCtx } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import type { TerminalEntry } from "./types";

const TX_HASH_RE = /(0x[a-fA-F0-9]{8,64})/g;
const BASESCAN = "https://sepolia.basescan.org/tx/";

function linkifyTxHashes(message: string, linkColor: string): React.ReactNode {
  const parts = message.split(TX_HASH_RE);
  if (parts.length === 1) return message;
  return parts.map((part, i) =>
    TX_HASH_RE.test(part) ? (
      <a
        key={i}
        href={`${BASESCAN}${part}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: linkColor, textDecoration: "underline", textUnderlineOffset: 2 }}
        onClick={(e) => e.stopPropagation()}
      >
        {part.slice(0, 10)}...
      </a>
    ) : part
  );
}

export function BottomTerminal({ entries }: { entries: TerminalEntry[] }) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  // Collapse consecutive duplicate entries (same tag + message)
  const collapsed = entries.reduce<{ entry: TerminalEntry; count: number; firstIdx: number }[]>((acc, entry, i) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : null;
    if (prev && prev.entry.tag === entry.tag && prev.entry.message === entry.message && prev.entry.status === entry.status) {
      prev.count++;
    } else {
      acc.push({ entry, count: 1, firstIdx: i });
    }
    return acc;
  }, []);

  const latest = entries.length > 0 ? entries[entries.length - 1] : null;
  const hasError = entries.some((e) => e.status === "fail");
  const bodyHeight = mobile ? 140 : 180;

  const tagColor = (status: TerminalEntry["status"]) => {
    switch (status) {
      case "pass": return t.green;
      case "fail": return t.red;
      case "warn": return "#E8A317";
      default: return t.blue;
    }
  };

  const statusIcon = (status: TerminalEntry["status"]) => {
    switch (status) {
      case "pass": return "\u2713";
      case "fail": return "\u2717";
      case "warn": return "!";
      default: return "\u203A";
    }
  };

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 30,
      transition: "transform .3s ease",
    }}>
      {/* Header bar — always visible */}
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: mobile ? "7px 12px" : "7px 24px",
          background: t.codeBg,
          borderTop: `1px solid ${t.cardBorder}60`,
          borderBottom: expanded ? `1px solid ${t.cardBorder}30` : "none",
          border: "none",
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          cursor: "pointer",
          borderTopWidth: 1,
          borderTopStyle: "solid",
          borderTopColor: `${t.cardBorder}60`,
        }}
      >
        {/* Status dot */}
        <div style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: entries.length === 0 ? `${t.cardBorder}60` : hasError ? t.red : t.green,
          opacity: 0.9,
          flexShrink: 0,
        }} />

        <span style={{
          fontSize: 10,
          fontWeight: 800,
          fontFamily: "'SF Mono','Fira Code',monospace",
          color: t.inkMuted,
          letterSpacing: 1.5,
        }}>
          TERMINAL
        </span>

        {entries.length > 0 && (
          <span style={{
            fontSize: 9,
            fontWeight: 800,
            color: t.blue,
            background: `${t.blue}15`,
            padding: "1px 6px",
            borderRadius: 4,
            flexShrink: 0,
          }}>
            {entries.length}
          </span>
        )}

        {/* Latest message preview when collapsed */}
        {!expanded && latest && (
          <span style={{
            fontSize: 11,
            fontFamily: "'SF Mono','Fira Code',monospace",
            color: `${t.inkMuted}AA`,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            textAlign: "left",
          }}>
            <span style={{ color: tagColor(latest.status), fontWeight: 700 }}>
              {statusIcon(latest.status)}
            </span>
            {" "}
            {latest.message}
          </span>
        )}

        {/* Chevron */}
        <span style={{
          marginLeft: "auto",
          fontSize: 10,
          color: t.inkMuted,
          transition: "transform .3s",
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          display: "inline-block",
          flexShrink: 0,
        }}>
          {"\u25B2"}
        </span>
      </button>

      {/* Expanded body */}
      <div style={{
        maxHeight: expanded ? bodyHeight : 0,
        overflow: "hidden",
        transition: "max-height 0.3s ease",
        background: `${t.codeBg}F5`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>
        <div
          ref={scrollRef}
          style={{
            height: bodyHeight,
            overflowY: "auto",
            padding: mobile ? "8px 12px" : "10px 24px",
          }}
        >
          {entries.length === 0 ? (
            <div style={{
              fontFamily: "'SF Mono','Fira Code',monospace",
              fontSize: 11,
              lineHeight: 1.8,
              color: t.inkMuted,
            }}>
              <span style={{ color: t.blue, opacity: 0.6 }}>{"\u203A"}</span>
              {" "}
              <span style={{ opacity: 0.5 }}>Connect wallet to start...</span>
            </div>
          ) : (
            collapsed.map((row, i) => {
              const { entry, count, firstIdx } = row;
              const isLast = i === collapsed.length - 1;
              const isRepeating = count > 1 && isLast && entry.status === "info";
              return (
                <div
                  key={firstIdx}
                  style={{
                    fontFamily: "'SF Mono','Fira Code',monospace",
                    fontSize: mobile ? 10 : 11,
                    lineHeight: 1.8,
                    display: "flex",
                    gap: 8,
                    alignItems: "baseline",
                    opacity: 0,
                    animation: "termFadeIn .3s forwards",
                    animationDelay: `${Math.min(firstIdx, 30) * 0.03}s`,
                  }}
                >
                  <span style={{
                    color: tagColor(entry.status),
                    fontWeight: 700,
                    fontSize: 10,
                    minWidth: 12,
                    textAlign: "center",
                  }}>
                    {isRepeating ? (
                      <span style={{ display: "inline-block", animation: "demoPulse 1.2s infinite" }}>
                        {"\u25CF"}
                      </span>
                    ) : statusIcon(entry.status)}
                  </span>
                  <span style={{
                    color: tagColor(entry.status),
                    fontWeight: 700,
                    fontSize: 9,
                    background: `${tagColor(entry.status)}15`,
                    padding: "1px 5px",
                    borderRadius: 3,
                    whiteSpace: "nowrap",
                  }}>
                    {entry.tag}
                  </span>
                  <span style={{ color: t.ink, flex: 1 }}>
                    {linkifyTxHashes(entry.message, t.blue)}
                  </span>
                  {count > 1 && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: t.inkMuted,
                      opacity: 0.6,
                    }}>
                      x{count}
                    </span>
                  )}
                  {entry.status === "pass" && count === 1 && (
                    <span style={{ color: t.green, fontSize: 9, opacity: 0.5 }}>(pass)</span>
                  )}
                  {entry.status === "fail" && (
                    <span style={{ color: t.red, fontSize: 9, fontWeight: 700 }}>REJECTED</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
