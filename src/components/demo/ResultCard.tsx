"use client";

import { useContext } from "react";
import { ThemeCtx } from "../shared/theme";
import type { GenerationResult } from "./types";

export function ResultCard({ result, generation }: {
  result: { granted: boolean; accountableHuman?: string; tier?: number; reason?: string };
  generation?: GenerationResult;
}) {
  const { t } = useContext(ThemeCtx);
  const color = result.granted ? t.green : t.red;

  return (
    <div style={{
      padding: "20px 24px",
      borderRadius: 10,
      borderLeft: `3px solid ${color}`,
      background: `${t.card}CC`,
      animation: "resultAppear .6s cubic-bezier(.16,1,.3,1)",
    }}>
      <div style={{
        fontSize: 15, fontWeight: 800, color,
        letterSpacing: 1, textTransform: "uppercase",
        marginBottom: result.granted ? 10 : 8,
      }}>
        {result.granted ? "Access Granted" : "Access Denied"}
      </div>

      {result.granted && result.accountableHuman && (
        <div style={{ fontSize: 12, color: t.inkMuted, lineHeight: 1.6 }}>
          <span style={{ fontWeight: 600 }}>Accountable Human</span>{" "}
          <code style={{
            fontFamily: "'SF Mono','Fira Code',monospace", fontSize: 11,
            color: t.ink, background: `${t.codeBg}CC`, padding: "2px 6px", borderRadius: 4,
          }}>
            {result.accountableHuman.slice(0, 6)}...{result.accountableHuman.slice(-4)}
          </code>
        </div>
      )}

      {result.granted && result.tier !== undefined && (
        <div style={{ fontSize: 12, color: t.inkMuted, marginTop: 4 }}>
          <span style={{ fontWeight: 600 }}>Tier</span>{" "}
          <span style={{ color: t.green, fontWeight: 700 }}>{result.tier}</span>
        </div>
      )}

      {/* Generated image inline */}
      {result.granted && generation && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            borderRadius: 8, overflow: "hidden",
            border: `1px solid ${t.cardBorder}40`,
          }}>
            <img
              src={generation.imageUrl}
              alt={generation.prompt}
              style={{ width: "100%", display: "block" }}
            />
          </div>
          <div style={{
            marginTop: 8, fontSize: 10, fontFamily: "'SF Mono','Fira Code',monospace",
            color: t.inkMuted, letterSpacing: 0.5,
          }}>
            <span style={{ color: t.blue }}>#{generation.agentId}</span>
            {" \u00B7 "}
            {generation.id.slice(0, 8)}
            {" \u00B7 "}
            {generation.prompt.slice(0, 40)}{generation.prompt.length > 40 ? "..." : ""}
          </div>
        </div>
      )}

      {!result.granted && result.reason && (
        <div style={{ fontSize: 12, color: t.inkMuted, lineHeight: 1.6 }}>
          <span style={{ fontWeight: 600 }}>Reason</span>{" "}
          <span style={{ color: t.red }}>{result.reason}</span>
        </div>
      )}

      {!result.granted && (
        <div style={{ fontSize: 11, color: t.inkMuted, opacity: 0.5, marginTop: 6 }}>
          Payment refunded
        </div>
      )}
    </div>
  );
}
