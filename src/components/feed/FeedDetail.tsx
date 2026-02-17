"use client";

import { useContext, useEffect, useState } from "react";
import { ThemeCtx, Btn } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import type { Generation } from "./types";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function FeedDetail({ entry, onClose, onOwnerClick }: {
  entry: Generation;
  onClose: () => void;
  onOwnerClick: (address: string) => void;
}) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();
  const [copied, setCopied] = useState(false);
  const granted = entry.status === "granted";

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const copyAddress = () => {
    navigator.clipboard.writeText(entry.ownerAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      {/* Backdrop on mobile */}
      {mobile && (
        <div
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, zIndex: 29,
            background: `${t.bg}CC`,
          }}
        />
      )}

      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: mobile ? "100%" : 400,
        zIndex: 30,
        background: `${t.card}F0`,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderLeft: mobile ? "none" : `1px solid ${t.cardBorder}40`,
        display: "flex", flexDirection: "column",
        overflowY: "auto",
        animation: "detailSlideIn .25s ease-out",
      }}>
        {/* Header bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: `1px solid ${t.cardBorder}30`,
          position: "sticky", top: 0, zIndex: 1,
          background: `${t.card}F0`,
          backdropFilter: "blur(16px)",
        }}>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: t.inkMuted, fontSize: 18, padding: "4px 8px",
              display: "flex", alignItems: "center", gap: 6,
              transition: "color .2s",
            }}
          >
            {mobile ? "\u2190" : "\u2715"}
            {mobile && <span style={{ fontSize: 13, fontWeight: 600 }}>Back</span>}
          </button>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
            color: t.inkMuted,
          }}>
            Generation Detail
          </span>
          <div style={{ width: 40 }} />
        </div>

        {/* Image */}
        <div style={{ padding: "16px 16px 0" }}>
          {granted && entry.imageUrl ? (
            <img
              src={entry.imageUrl}
              alt={entry.prompt}
              style={{
                width: "100%", maxHeight: 400, objectFit: "contain",
                borderRadius: 10, background: t.codeBg, display: "block",
              }}
            />
          ) : (
            <div style={{
              width: "100%", height: 200, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `${t.red}08`, color: t.red,
              fontSize: 48, fontWeight: 900, opacity: 0.3,
            }}>
              {"\u2715"}
            </div>
          )}
        </div>

        {/* Prompt */}
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
            color: t.inkMuted, marginBottom: 6,
          }}>
            Prompt
          </div>
          <div style={{ fontSize: 13, color: t.ink, lineHeight: 1.5 }}>
            {entry.prompt}
          </div>
        </div>

        {/* Metadata card */}
        <div style={{
          margin: "16px 16px 0",
          padding: 14, borderRadius: 10,
          background: `${t.codeBg}CC`,
          border: `1px solid ${t.cardBorder}30`,
        }}>
          {[
            { label: "Agent ID", value: `#${entry.agentId}`, color: t.blue },
            {
              label: "Owner",
              value: (
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: "'SF Mono','Fira Code',monospace", fontSize: 11 }}>
                    {entry.ownerAddress.slice(0, 8)}...{entry.ownerAddress.slice(-6)}
                  </span>
                  <button
                    onClick={copyAddress}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: t.inkMuted, fontSize: 11, padding: "1px 4px",
                      borderRadius: 3, transition: "color .2s",
                    }}
                    title="Copy full address"
                  >
                    {copied ? "\u2713" : "\u2398"}
                  </button>
                </span>
              ),
            },
            {
              label: "Status",
              value: granted ? "Approved" : "Denied",
              color: granted ? t.green : t.red,
            },
            {
              label: "Verified",
              value: entry.humanVerified ? "Yes (Human)" : "No",
              color: entry.humanVerified ? t.green : t.inkMuted,
            },
            { label: "Tier", value: String(entry.tier) },
            { label: "Time", value: `${formatTimestamp(entry.timestamp)} (${timeAgo(entry.timestamp)})` },
            ...(!granted && entry.reason ? [{ label: "Reason", value: entry.reason, color: t.red }] : []),
          ].map((row) => (
            <div key={row.label} style={{
              display: "flex",
              flexDirection: mobile && (row.label === "Time" || row.label === "Reason") ? "column" : "row",
              justifyContent: "space-between",
              alignItems: mobile && (row.label === "Time" || row.label === "Reason") ? "flex-start" : "center",
              gap: mobile && (row.label === "Time" || row.label === "Reason") ? 2 : 0,
              padding: "6px 0",
              borderBottom: `1px solid ${t.cardBorder}20`,
              fontSize: mobile ? 11 : 12,
            }}>
              <span style={{ color: t.inkMuted, fontWeight: 600, flexShrink: 0, marginRight: 12 }}>
                {row.label}
              </span>
              <span style={{
                color: "color" in row ? row.color : t.ink,
                fontWeight: 600,
                textAlign: mobile && (row.label === "Time" || row.label === "Reason") ? "left" : "right",
                wordBreak: "break-word",
              }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* View by owner button */}
        <div style={{ padding: "16px 16px 24px" }}>
          <Btn
            small
            primary
            onClick={() => { onOwnerClick(entry.ownerAddress); onClose(); }}
            style={{ width: "100%" }}
          >
            View all by this owner
          </Btn>
        </div>
      </div>
    </>
  );
}
