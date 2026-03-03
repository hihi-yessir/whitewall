"use client";

import { useContext } from "react";
import { ThemeCtx } from "../shared/theme";
import { ACE_CHECKS, SCENARIO_TIER, NODE_SIZE } from "./graph";
import type { StepStatus, ScenarioId } from "./types";

interface AcePanelProps {
  expanded: boolean;
  aceStatus: StepStatus;
  scenario: ScenarioId;
  x: number;
  y: number;
}

function checkStatus(aceStatus: StepStatus, minTier: number, scenarioTier: number): StepStatus {
  if (aceStatus === "idle" || aceStatus === "skipped") return "idle";
  if (aceStatus === "active") return minTier <= scenarioTier ? "active" : "idle";
  if (aceStatus === "fail") return "fail";
  // aceStatus === "pass"
  return minTier <= scenarioTier ? "pass" : "skipped";
}

export function AcePanel({ expanded, aceStatus, scenario, x, y }: AcePanelProps) {
  const { t } = useContext(ThemeCtx);
  const tier = SCENARIO_TIER[scenario] ?? 0;

  const panelWidth = 260;

  return (
    <div
      style={{
        position: "absolute",
        left: x - panelWidth / 2,
        top: y + NODE_SIZE / 2 + 32, // below node + label
        width: panelWidth,
        maxHeight: expanded ? 340 : 0,
        overflow: "hidden",
        opacity: expanded ? 1 : 0,
        transition: "max-height .35s cubic-bezier(.16,1,.3,1), opacity .25s ease",
        zIndex: 10,
        pointerEvents: expanded ? "auto" : "none",
      }}
    >
      <div
        style={{
          background: `${t.card}E8`,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: `1px solid ${t.cardBorder}40`,
          borderRadius: 10,
          padding: "8px 10px",
        }}
      >
        <div
          style={{
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: t.inkMuted,
            marginBottom: 6,
          }}
        >
          TieredPolicy — 8 Checks
        </div>
        {ACE_CHECKS.map((check) => {
          const status = checkStatus(aceStatus, check.minTier, tier);
          const color =
            status === "pass" ? t.green
            : status === "fail" ? t.red
            : status === "active" ? t.blue
            : `${t.inkMuted}60`;
          const icon =
            status === "pass" ? "\u2713"
            : status === "fail" ? "\u2717"
            : status === "active" ? "\u25CF"
            : status === "skipped" ? "\u2014"
            : "\u25CB";

          return (
            <div
              key={check.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 0",
                borderBottom: `1px solid ${t.cardBorder}15`,
                transition: "opacity .3s",
                opacity: status === "skipped" ? 0.35 : 1,
              }}
            >
              <span
                style={{
                  width: 14,
                  fontSize: 10,
                  fontWeight: 700,
                  color,
                  textAlign: "center",
                  flexShrink: 0,
                  animation: status === "active" ? "demoPulse 1s ease-in-out infinite" : "none",
                }}
              >
                {icon}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 9,
                  fontWeight: 600,
                  color: status === "idle" || status === "skipped" ? t.inkMuted : t.ink,
                  transition: "color .3s",
                }}
              >
                {check.label}
              </span>
              {check.minTier >= 3 && (
                <span
                  style={{
                    fontSize: 7,
                    fontWeight: 800,
                    color: `${t.inkMuted}80`,
                    background: `${t.cardBorder}20`,
                    padding: "1px 4px",
                    borderRadius: 3,
                    letterSpacing: 0.3,
                  }}
                >
                  T{check.minTier}+
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
