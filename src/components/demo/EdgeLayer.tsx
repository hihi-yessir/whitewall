"use client";

import { useContext } from "react";
import { ThemeCtx } from "../shared/theme";
import type { PipelineStepState } from "./types";
import {
  GRAPH_EDGES,
  NODE_LAYOUT,
  nodeRight,
  nodeLeft,
  bezierPath,
  straightPath,
  CANVAS_W,
  CANVAS_H,
} from "./graph";

/** Derive edge visual status from connected node statuses */
function edgeStatus(fromStep: PipelineStepState | undefined, toStep: PipelineStepState | undefined): string {
  if (!fromStep || !toStep) return "idle";
  if (toStep.status === "skipped") return "skipped";
  if (toStep.status === "active") return "active";
  if (fromStep.status === "pass" && toStep.status !== "idle") return "pass";
  if (fromStep.status === "fail") return "fail";
  return "idle";
}

/** Is this a branching edge (needs bezier)? */
function isBranching(from: string, to: string): boolean {
  const fl = NODE_LAYOUT[from];
  const tl = NODE_LAYOUT[to];
  return fl.row !== tl.row;
}

export function EdgeLayer({ steps }: { steps: PipelineStepState[] }) {
  const { t } = useContext(ThemeCtx);
  const stepMap = new Map(steps.map((s) => [s.id, s]));

  const statusStyle = (status: string) => {
    switch (status) {
      case "pass":    return { stroke: t.green, width: 2, opacity: 0.8, dash: "none" };
      case "fail":    return { stroke: t.red,   width: 2, opacity: 0.8, dash: "none" };
      case "active":  return { stroke: t.blue,  width: 2, opacity: 0.9, dash: "6 4" };
      case "skipped": return { stroke: t.cardBorder, width: 1.5, opacity: 0.12, dash: "none" };
      default:        return { stroke: t.cardBorder, width: 1.5, opacity: 0.25, dash: "none" };
    }
  };

  return (
    <svg
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
    >
      {GRAPH_EDGES.map((edge, i) => {
        const fromLayout = NODE_LAYOUT[edge.from];
        const toLayout = NODE_LAYOUT[edge.to];
        const from = nodeRight(fromLayout);
        const to = nodeLeft(toLayout);
        const branching = isBranching(edge.from, edge.to);
        const d = branching ? bezierPath(from, to) : straightPath(from, to);
        const status = edgeStatus(stepMap.get(edge.from), stepMap.get(edge.to));
        const st = statusStyle(status);

        return (
          <g key={`${edge.from}-${edge.to}`}>
            <path
              d={d}
              fill="none"
              stroke={st.stroke}
              strokeWidth={st.width}
              strokeDasharray={st.dash}
              opacity={st.opacity}
              style={{ transition: "stroke .4s, opacity .4s" }}
            >
              {status === "active" && (
                <animate
                  attributeName="stroke-dashoffset"
                  values="10;0"
                  dur="0.8s"
                  repeatCount="indefinite"
                />
              )}
            </path>

            {/* Branch labels */}
            {edge.label && (
              <text
                x={(from.x + to.x) / 2}
                y={edge.label === "On-Chain"
                  ? Math.min(from.y, to.y) - 8
                  : Math.max(from.y, to.y) + 14}
                textAnchor="middle"
                fill={status === "idle" || status === "skipped" ? `${t.inkMuted}60` : t.inkMuted}
                fontSize={8}
                fontWeight={700}
                fontFamily="'SF Mono','Fira Code',monospace"
                letterSpacing={0.5}
                style={{ transition: "fill .4s", textTransform: "uppercase" } as React.CSSProperties}
              >
                {edge.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
