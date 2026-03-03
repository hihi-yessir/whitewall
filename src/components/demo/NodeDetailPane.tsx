"use client";

import { useContext, useEffect, useState, useRef } from "react";
import { ThemeCtx } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import type { PipelineStepState, ScenarioId } from "./types";
import {
  NODE_DETAILS,
  NODE_TOOLTIPS,
  SCENARIO_OVERVIEWS,
  type DetailLine,
} from "./graph";

interface NodeDetailPaneProps {
  scenario: ScenarioId;
  activeStepId: string | null;
  steps: PipelineStepState[];
}

function DetailLineView({ line, t, delay }: { line: DetailLine; t: Record<string, any>; delay: number }) {
  const color = (() => {
    switch (line.color) {
      case "green": return t.green;
      case "blue": return t.blue;
      case "red": return t.red;
      case "muted": return `${t.inkMuted}90`;
      default: return t.ink;
    }
  })();
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) { setVisible(true); return; }
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div style={{
      fontFamily: "'SF Mono','Fira Code',monospace",
      fontSize: 10,
      lineHeight: 1.7,
      color,
      paddingLeft: line.indent ? 12 : 0,
      opacity: visible ? 1 : 0,
      transform: visible ? "none" : "translateY(3px)",
      transition: "opacity .25s ease, transform .25s ease",
    }}>
      {line.text}
    </div>
  );
}

/** Render a single node's header + detail lines */
function NodeSection({ stepId, step, scenario, isActive, t }: {
  stepId: string;
  step: PipelineStepState;
  scenario: ScenarioId;
  isActive: boolean;
  t: Record<string, any>;
}) {
  const tooltip = NODE_TOOLTIPS[stepId];
  const details = NODE_DETAILS[scenario];
  const lines = details ? details[stepId] : null;

  if (!tooltip) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Node header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 4,
      }}>
        {isActive && (
          <div style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: t.blue,
            animation: "demoPulse 1s ease-in-out infinite",
            flexShrink: 0,
          }} />
        )}
        <span style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1,
          color: isActive ? t.blue
            : step.status === "pass" ? t.green
            : step.status === "fail" ? t.red
            : t.ink,
          textTransform: "uppercase",
        }}>
          {tooltip.title}
        </span>
        {step.timing !== undefined && (
          <span style={{
            fontSize: 8,
            fontFamily: "monospace",
            color: t.inkMuted,
            opacity: 0.6,
            marginLeft: "auto",
          }}>
            {step.timing}ms
          </span>
        )}
      </div>

      {/* Divider */}
      <div style={{
        height: 1,
        background: `${t.cardBorder}40`,
        marginBottom: 8,
      }} />

      {/* Detail lines — stagger only for the active node */}
      {lines && lines.map((line, i) => (
        <DetailLineView
          key={`${stepId}-${i}`}
          line={line}
          t={t}
          delay={isActive ? i * 120 : 0}
        />
      ))}
    </div>
  );
}

export function NodeDetailPane({ scenario, activeStepId, steps }: NodeDetailPaneProps) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);

  const overview = SCENARIO_OVERVIEWS[scenario] ?? SCENARIO_OVERVIEWS["idle"];

  // Collect all visited steps (not idle, not skipped) in pipeline order
  const visitedSteps = steps.filter(
    (s) => s.status === "active" || s.status === "pass" || s.status === "fail"
  );

  const hasVisited = visitedSteps.length > 0;

  // Auto-scroll to bottom when new steps appear or active step changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [activeStepId, visitedSteps.length]);

  if (mobile) return null;

  return (
    <div style={{
      width: 260,
      minHeight: 0,
      borderRight: `1px solid ${t.cardBorder}40`,
      display: "flex",
      flexDirection: "column",
      background: `${t.card}CC`,
      backdropFilter: "blur(8px)",
    }}>
      {/* Scrollable log content */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 16px",
        }}
      >
        {/* IDLE STATE: scenario overview */}
        {!hasVisited && (
          <div style={{ animation: "actFadeIn .3s ease" }}>
            <div style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 1,
              color: t.blue,
              textTransform: "uppercase",
              marginBottom: 4,
            }}>
              {overview.title}
            </div>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              color: t.inkMuted,
              marginBottom: 12,
            }}>
              {overview.subtitle}
            </div>
            <div style={{
              fontSize: 11,
              lineHeight: 1.6,
              color: t.inkMuted,
            }}>
              {overview.description}
            </div>
          </div>
        )}

        {/* ACCUMULATING LOG: all visited nodes stacked */}
        {hasVisited && visitedSteps.map((step) => (
          <NodeSection
            key={step.id}
            stepId={step.id}
            step={step}
            scenario={scenario}
            isActive={step.id === activeStepId && step.status === "active"}
            t={t}
          />
        ))}
      </div>

      {/* Try it yourself link */}
      <div style={{
        borderTop: `1px solid ${t.cardBorder}30`,
        padding: "10px 16px",
      }}>
        <a href="/tryout" style={{
          display: "block",
          textAlign: "center",
          padding: "8px 12px",
          borderRadius: 8,
          border: `1.5px solid ${t.blue}`,
          background: `${t.blue}15`,
          textDecoration: "none",
          fontSize: 11,
          fontWeight: 700,
          color: t.blue,
          transition: "all .2s",
        }}>
          Try It Yourself {"\u2192"}
        </a>
      </div>
    </div>
  );
}
