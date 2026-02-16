"use client";

import { useContext } from "react";
import { ThemeCtx } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import { PipelineStep } from "./PipelineStep";
import type { PipelineStepState } from "./types";

export function PipelineViz({ steps }: { steps: PipelineStepState[] }) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();

  return (
    <div style={{
      flex: 1, padding: mobile ? "20px 0" : "32px 24px",
      display: "flex", flexDirection: "column", justifyContent: "center",
      position: "relative",
    }}>
      {/* Scroll fade hints on mobile */}
      {mobile && (
        <>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 24, zIndex: 1,
            background: `linear-gradient(90deg, ${t.card}B0, transparent)`,
            pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 0, width: 24, zIndex: 1,
            background: `linear-gradient(270deg, ${t.card}B0, transparent)`,
            pointerEvents: "none",
          }} />
        </>
      )}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 0,
        overflowX: mobile ? "auto" : "hidden",
        minWidth: mobile ? steps.length * 80 : "auto",
        justifyContent: mobile ? "flex-start" : "center",
        padding: mobile ? "0 16px" : 0,
      }}>
        {steps.map((step, i) => (
          <div key={step.id} style={{ display: "flex", alignItems: "flex-start" }}>
            <PipelineStep step={step} />
            {i < steps.length - 1 && (
              <div style={{
                display: "flex", alignItems: "center", height: 56,
                padding: "0 4px",
              }}>
                <svg width={mobile ? 20 : 28} height="2" style={{ overflow: "visible" }}>
                  <line
                    x1="0" y1="1" x2={mobile ? 20 : 28} y2="1"
                    stroke={
                      steps[i + 1].status === 'skipped' ? `${t.cardBorder}40` :
                      step.status === 'pass' ? t.green :
                      step.status === 'fail' ? t.red :
                      step.status === 'active' ? t.blue :
                      t.cardBorder
                    }
                    strokeWidth="2"
                    strokeDasharray={step.status === 'active' ? "4 4" : "none"}
                    style={{ transition: "stroke .3s" }}
                  >
                    {step.status === 'active' && (
                      <animate attributeName="stroke-dashoffset" values="8;0" dur="0.8s" repeatCount="indefinite" />
                    )}
                  </line>
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
