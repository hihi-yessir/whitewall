"use client";

import { useContext } from "react";
import { ThemeCtx } from "../shared/theme";
import type { PipelineStepState } from "./types";

export function PipelineStep({ step }: { step: PipelineStepState }) {
  const { t } = useContext(ThemeCtx);

  const borderColor = {
    idle: t.cardBorder,
    active: t.blue,
    pass: t.green,
    fail: t.red,
    skipped: `${t.cardBorder}60`,
  }[step.status];

  const bgColor = {
    idle: `${t.card}CC`,
    active: `${t.card}CC`,
    pass: `${t.card}CC`,
    fail: `${t.card}CC`,
    skipped: `${t.card}40`,
  }[step.status];

  const icon = {
    idle: null,
    active: null,
    pass: "\u2713",
    fail: "\u2717",
    skipped: "\u2014",
  }[step.status];

  const iconColor = step.status === 'pass' ? t.green : step.status === 'fail' ? t.red : t.inkMuted;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
      opacity: step.status === 'skipped' ? 0.35 : 1,
      transition: "all .4s cubic-bezier(.16,1,.3,1)",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        border: `2px solid ${borderColor}`,
        background: bgColor, backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", transition: "all .4s cubic-bezier(.16,1,.3,1)",
        boxShadow: step.status === 'active' ? `0 0 20px ${t.blue}40, 0 0 40px ${t.blue}20` : "none",
      }}>
        {step.status === 'active' && (
          <div style={{
            position: "absolute", inset: -4, borderRadius: 16,
            border: `2px solid ${t.blue}`,
            animation: "demoPulse 1.5s ease-in-out infinite",
            opacity: 0.5,
          }} />
        )}
        {icon ? (
          <span style={{ fontSize: 20, fontWeight: 800, color: iconColor }}>{icon}</span>
        ) : step.status === 'active' ? (
          <div style={{
            width: 8, height: 8, borderRadius: 4, background: t.blue,
            animation: "demoPulse 1s ease-in-out infinite",
          }} />
        ) : (
          <div style={{ width: 6, height: 6, borderRadius: 3, background: t.inkMuted, opacity: 0.4 }} />
        )}
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
        color: step.status === 'active' ? t.blue : step.status === 'pass' ? t.green : step.status === 'fail' ? t.red : t.inkMuted,
        textTransform: "uppercase", textAlign: "center", maxWidth: 72,
        transition: "color .3s",
      }}>
        {step.label}
      </span>
      {step.detail && (
        <span style={{
          fontSize: 9, color: step.status === 'fail' ? t.red : t.inkMuted,
          textAlign: "center", maxWidth: 90, lineHeight: 1.3,
          fontFamily: "'SF Mono','Fira Code',monospace",
        }}>
          {step.detail}
        </span>
      )}
      {step.timing !== undefined && (
        <span style={{ fontSize: 8, color: t.inkMuted, opacity: 0.5, fontFamily: "monospace" }}>
          {step.timing}ms
        </span>
      )}
    </div>
  );
}
