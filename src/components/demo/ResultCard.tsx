"use client";

import { useContext } from "react";
import { ThemeCtx } from "../shared/theme";

export function ResultCard({ result }: {
  result: { granted: boolean; accountableHuman?: string; tier?: number; reason?: string };
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

      {!result.granted && result.reason && (
        <div style={{ fontSize: 12, color: t.inkMuted, lineHeight: 1.6 }}>
          <span style={{ fontWeight: 600 }}>Reason</span>{" "}
          <span style={{ color: t.red }}>{result.reason}</span>
        </div>
      )}

      {!result.granted && (
        <div style={{ fontSize: 11, color: t.inkMuted, opacity: 0.5, marginTop: 6 }}>
          $0.50 USDC payment refunded
        </div>
      )}
    </div>
  );
}
