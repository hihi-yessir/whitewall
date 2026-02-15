"use client";

import { useContext } from "react";
import { ThemeCtx } from "../shared/theme";

export function ResultCard({ result }: {
  result: { granted: boolean; accountableHuman?: string; tier?: number; reason?: string };
}) {
  const { t } = useContext(ThemeCtx);

  if (result.granted) {
    return (
      <div style={{
        padding: 24, borderRadius: 14,
        border: `2px solid ${t.green}`,
        background: `${t.green}10`,
        textAlign: "center",
        animation: "resultAppear .5s cubic-bezier(.16,1,.3,1)",
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>{"\u2713"}</div>
        <div style={{
          fontSize: 18, fontWeight: 900, color: t.green,
          letterSpacing: -0.5, textTransform: "uppercase",
        }}>
          Access Granted
        </div>
        {result.accountableHuman && (
          <div style={{ marginTop: 12, fontSize: 12, color: t.inkMuted }}>
            <span style={{ fontWeight: 600 }}>Accountable Human:</span>{" "}
            <code style={{
              fontFamily: "'SF Mono','Fira Code',monospace", fontSize: 11,
              color: t.ink, background: `${t.card}CC`, padding: "2px 6px", borderRadius: 4,
            }}>
              {result.accountableHuman.slice(0, 6)}...{result.accountableHuman.slice(-4)}
            </code>
          </div>
        )}
        {result.tier !== undefined && (
          <div style={{ marginTop: 6, fontSize: 12, color: t.inkMuted }}>
            <span style={{ fontWeight: 600 }}>Tier:</span>{" "}
            <span style={{ color: t.green, fontWeight: 700 }}>{result.tier}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      padding: 24, borderRadius: 14,
      border: `2px solid ${t.red}`,
      background: `${t.red}10`,
      textAlign: "center",
      animation: "resultAppear .5s cubic-bezier(.16,1,.3,1)",
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{"\u2717"}</div>
      <div style={{
        fontSize: 18, fontWeight: 900, color: t.red,
        letterSpacing: -0.5, textTransform: "uppercase",
      }}>
        Access Denied
      </div>
      {result.reason && (
        <div style={{ marginTop: 12, fontSize: 12, color: t.inkMuted }}>
          <span style={{ fontWeight: 600 }}>Reason:</span>{" "}
          <span style={{ color: t.red }}>{result.reason}</span>
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 11, color: t.inkMuted, opacity: 0.7 }}>
        $0.50 USDC payment refunded
      </div>
    </div>
  );
}
