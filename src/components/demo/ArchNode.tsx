"use client";

import { useContext } from "react";
import { ThemeCtx } from "../shared/theme";
import type { PipelineStepState } from "./types";
import { NODE_SIZE, NODE_ICONS } from "./graph";

interface ArchNodeProps {
  step: PipelineStepState;
  x: number;
  y: number;
  isAce?: boolean;
  aceExpanded?: boolean;
  onHover?: (rect: DOMRect) => void;
  onLeave?: () => void;
  onClick?: () => void;
}

export function ArchNode({ step, x, y, isAce, aceExpanded, onHover, onLeave, onClick }: ArchNodeProps) {
  const { t } = useContext(ThemeCtx);

  const borderColor: Record<string, string> = {
    idle: t.cardBorder,
    active: t.blue,
    pass: t.green,
    fail: t.red,
    skipped: `${t.cardBorder}60`,
  };

  const icon: Record<string, string | null> = {
    idle: null,
    active: null,
    pass: "\u2713",
    fail: "\u2717",
    skipped: "\u2014",
  };

  const iconColor = step.status === "pass" ? t.green : step.status === "fail" ? t.red : t.inkMuted;

  return (
    <div
      style={{
        position: "absolute",
        left: x - NODE_SIZE / 2,
        top: y - NODE_SIZE / 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        opacity: step.status === "skipped" ? 0.3 : 1,
        transition: "all .4s cubic-bezier(.16,1,.3,1)",
        cursor: isAce ? "pointer" : "default",
        zIndex: 2,
      }}
      onMouseEnter={(e) => onHover?.(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => onLeave?.()}
      onClick={isAce ? onClick : undefined}
    >
      {/* Node box */}
      <div
        style={{
          width: NODE_SIZE,
          height: NODE_SIZE,
          borderRadius: 13,
          border: `2px solid ${borderColor[step.status] ?? t.cardBorder}`,
          background: step.status === "skipped" ? `${t.card}40` : `${t.card}CC`,
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          transition: "all .4s cubic-bezier(.16,1,.3,1)",
          boxShadow: step.status === "active"
            ? `0 0 20px ${t.blue}40, 0 0 40px ${t.blue}20`
            : "none",
        }}
      >
        {/* Active pulse ring */}
        {step.status === "active" && (
          <div
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: 15,
              border: `2px solid ${t.blue}`,
              animation: "demoPulse 1.5s ease-in-out infinite",
              opacity: 0.5,
            }}
          />
        )}

        {/* Icon */}
        {icon[step.status] ? (
          <span style={{ fontSize: 18, fontWeight: 800, color: iconColor }}>{icon[step.status]}</span>
        ) : (
          <span style={{
            fontSize: 16,
            fontWeight: 900,
            fontFamily: "'SF Mono','Fira Code',monospace",
            color: step.status === "active" ? t.blue : t.inkMuted,
            opacity: step.status === "active" ? 1 : 0.4,
            animation: step.status === "active" ? "demoPulse 1.5s ease-in-out infinite" : "none",
          }}>
            {NODE_ICONS[step.id] ?? "?"}
          </span>
        )}

        {/* ACE expand affordance */}
        {isAce && step.status !== "idle" && step.status !== "skipped" && (
          <span
            style={{
              position: "absolute",
              bottom: 3,
              right: 5,
              fontSize: 8,
              color: t.inkMuted,
              opacity: 0.6,
              transition: "transform .2s",
              transform: aceExpanded ? "rotate(180deg)" : "none",
            }}
          >
            {"\u25BC"}
          </span>
        )}
      </div>

      {/* Label */}
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.5,
          color:
            step.status === "active" ? t.blue
            : step.status === "pass" ? t.green
            : step.status === "fail" ? t.red
            : t.inkMuted,
          textTransform: "uppercase",
          textAlign: "center",
          maxWidth: 68,
          lineHeight: 1.2,
          transition: "color .3s",
          whiteSpace: "nowrap",
        }}
      >
        {step.label}
      </span>

      {/* Detail */}
      {step.detail && (
        <span
          style={{
            fontSize: 8,
            color: step.status === "fail" ? t.red : t.inkMuted,
            textAlign: "center",
            maxWidth: 80,
            lineHeight: 1.2,
            fontFamily: "'SF Mono','Fira Code',monospace",
          }}
        >
          {step.detail}
        </span>
      )}

      {/* Timing */}
      {step.timing !== undefined && (
        <span style={{ fontSize: 7, color: t.inkMuted, opacity: 0.5, fontFamily: "monospace" }}>
          {step.timing}ms
        </span>
      )}
    </div>
  );
}
