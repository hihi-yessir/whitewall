"use client";

import { useContext, useRef, useState, useCallback } from "react";
import { ThemeCtx } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import { proxyMedia } from "@/lib/media";
import type { PipelineStepState, ScenarioId, GenerationResult } from "./types";
import {
  NODE_LAYOUT,
  NODE_TOOLTIPS,
  CANVAS_W,
  CANVAS_H,
  nodeCenter,
  computeGroupZones,
  type NodeTooltip,
} from "./graph";
import { EdgeLayer } from "./EdgeLayer";
import { ArchNode } from "./ArchNode";
import { AcePanel } from "./AcePanel";
import { Tooltip } from "./Tooltip";

interface ArchitectureVizProps {
  steps: PipelineStepState[];
  scenario: ScenarioId;
  aceExpanded: boolean;
  onToggleAce: () => void;
  result?: { granted: boolean; accountableHuman?: string; tier?: number; reason?: string };
  generation?: GenerationResult;
}

// ─── Result overlay strip (absolutely positioned, no layout shift) ───

function ResultStrip({ result, generation }: {
  result: { granted: boolean; accountableHuman?: string; tier?: number; reason?: string };
  generation?: GenerationResult;
}) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();
  const color = result.granted ? t.green : t.red;
  const shorten = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div style={{
      position: mobile ? "relative" : "absolute",
      bottom: mobile ? undefined : 0,
      left: 0,
      right: 0,
      zIndex: 8,
      animation: "resultAppear .5s cubic-bezier(.16,1,.3,1)",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: mobile ? 8 : 12,
        padding: mobile ? "10px 12px" : "10px 20px",
        background: `${t.card}E8`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderTop: `1px solid ${t.cardBorder}30`,
        borderLeft: `3px solid ${color}`,
        flexWrap: "wrap",
      }}>
        {/* Status */}
        <span style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: 0.5,
          color,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}>
          {result.granted ? "Access Granted" : "Access Denied"}
        </span>

        {/* Tier */}
        {result.granted && result.tier !== undefined && (
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: t.inkMuted,
            whiteSpace: "nowrap",
          }}>
            {"\u00B7"} Tier {result.tier}
          </span>
        )}

        {/* Accountable human */}
        {result.granted && result.accountableHuman && (
          <code style={{
            fontFamily: "'SF Mono','Fira Code',monospace",
            fontSize: 10,
            color: t.ink,
            background: `${t.codeBg}CC`,
            padding: "2px 6px",
            borderRadius: 4,
          }}>
            {shorten(result.accountableHuman)}
          </code>
        )}

        {/* Denied reason */}
        {!result.granted && result.reason && (
          <span style={{ fontSize: 10, color: t.inkMuted }}>
            {"\u00B7"} {result.reason}
          </span>
        )}

        {!result.granted && (
          <span style={{ fontSize: 9, color: `${t.inkMuted}60`, marginLeft: "auto" }}>
            Payment refunded
          </span>
        )}

        {/* Generated image thumbnail */}
        {result.granted && generation && (
          <div style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 6,
              overflow: "hidden",
              border: `1px solid ${t.cardBorder}40`,
              flexShrink: 0,
            }}>
              <img
                src={proxyMedia(generation.imageUrl)}
                alt={generation.prompt}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
            <span style={{
              fontSize: 8,
              fontFamily: "'SF Mono','Fira Code',monospace",
              color: t.inkMuted,
              maxWidth: 120,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              <span style={{ color: t.blue }}>#{generation.agentId}</span>
              {" \u00B7 "}
              {generation.prompt.slice(0, 20)}...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mobile vertical layout ─────────────────────────────

const MOBILE_ORDER = ["agent", "x402", "gateway", "cre"];
const MOBILE_FORK_ONCHAIN = ["gate1", "gate2"];
const MOBILE_FORK_HTTP = ["gate3", "gate4"];
const MOBILE_AFTER = ["don", "ace", "result"];

function MobileViz({ steps, scenario, aceExpanded, onToggleAce, result, generation }: ArchitectureVizProps) {
  const { t } = useContext(ThemeCtx);
  const stepMap = new Map(steps.map((s) => [s.id, s]));

  const aceStep = stepMap.get("ace");

  const MobileNode = ({ id }: { id: string }) => {
    const step = stepMap.get(id)!;
    const borderColor =
      step.status === "active" ? t.blue
      : step.status === "pass" ? t.green
      : step.status === "fail" ? t.red
      : step.status === "skipped" ? `${t.cardBorder}50`
      : t.cardBorder;
    const labelColor =
      step.status === "active" ? t.blue
      : step.status === "pass" ? t.green
      : step.status === "fail" ? t.red
      : t.inkMuted;
    const icon =
      step.status === "pass" ? "\u2713"
      : step.status === "fail" ? "\u2717"
      : step.status === "active" ? "\u25CF"
      : step.status === "skipped" ? "\u2014"
      : "\u25CB";

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 0",
          opacity: step.status === "skipped" ? 0.3 : 1,
          transition: "opacity .3s",
        }}
        onClick={id === "ace" ? onToggleAce : undefined}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: `2px solid ${borderColor}`,
            background: `${t.card}CC`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: step.status === "active" ? `0 0 12px ${t.blue}30` : "none",
            transition: "all .3s",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: labelColor,
              animation: step.status === "active" ? "demoPulse 1s ease-in-out infinite" : "none",
            }}
          >
            {icon}
          </span>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: labelColor, letterSpacing: 0.5, textTransform: "uppercase" }}>
            {step.label}
          </div>
          {step.detail && (
            <div style={{ fontSize: 8, color: step.status === "fail" ? t.red : t.inkMuted, fontFamily: "monospace" }}>
              {step.detail}
            </div>
          )}
        </div>
        {step.timing !== undefined && (
          <span style={{ fontSize: 7, color: t.inkMuted, opacity: 0.5, fontFamily: "monospace", marginLeft: "auto" }}>
            {step.timing}ms
          </span>
        )}
      </div>
    );
  };

  const ForkGroup = ({ label, ids }: { label: string; ids: string[] }) => (
    <div
      style={{
        marginLeft: 16,
        paddingLeft: 12,
        borderLeft: `2px solid ${t.cardBorder}30`,
        marginTop: 2,
        marginBottom: 2,
      }}
    >
      <div
        style={{
          fontSize: 7,
          fontWeight: 800,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: `${t.inkMuted}80`,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      {ids.map((id) => (
        <MobileNode key={id} id={id} />
      ))}
    </div>
  );

  return (
    <div style={{ padding: "16px 12px" }}>
      {MOBILE_ORDER.map((id) => (
        <MobileNode key={id} id={id} />
      ))}
      <ForkGroup label="On-Chain Read" ids={MOBILE_FORK_ONCHAIN} />
      <ForkGroup label="Confidential HTTP" ids={MOBILE_FORK_HTTP} />
      {MOBILE_AFTER.map((id) => (
        <MobileNode key={id} id={id} />
      ))}

      {/* Mobile ACE panel */}
      {aceExpanded && aceStep && aceStep.status !== "idle" && (
        <div style={{ marginLeft: 16, marginTop: 4 }}>
          <AcePanel
            expanded={aceExpanded}
            aceStatus={aceStep.status}
            scenario={scenario}
            x={130}
            y={-16}
          />
        </div>
      )}

      {/* Result strip (relative on mobile, just below the graph) */}
      {result && (
        <div style={{ marginTop: 8 }}>
          <ResultStrip result={result} generation={generation} />
        </div>
      )}
    </div>
  );
}

// ─── Desktop graph layout ────────────────────────────────

function DesktopViz({ steps, scenario, aceExpanded, onToggleAce, result, generation }: ArchitectureVizProps) {
  const { t } = useContext(ThemeCtx);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltipData, setTooltipData] = useState<{
    visible: boolean;
    tooltip: NodeTooltip | null;
    anchorRect: DOMRect | null;
  }>({ visible: false, tooltip: null, anchorRect: null });

  const handleHover = useCallback((id: string, rect: DOMRect) => {
    setTooltipData({ visible: true, tooltip: NODE_TOOLTIPS[id] ?? null, anchorRect: rect });
  }, []);

  const handleLeave = useCallback(() => {
    setTooltipData((prev) => ({ ...prev, visible: false }));
  }, []);

  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const aceStep = stepMap.get("ace");
  const aceCenter = nodeCenter(NODE_LAYOUT.ace);
  const groupZones = computeGroupZones();

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: CANVAS_W,
        height: CANVAS_H,
        maxWidth: "100%",
        margin: "0 auto",
      }}
    >
      {/* Group background zones */}
      <svg
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        {groupZones.map((zone) => (
          <g key={zone.group}>
            <rect
              x={zone.x}
              y={zone.y}
              width={zone.w}
              height={zone.h}
              rx={12}
              fill={zone.tee ? "#f59e0b06" : `${t.cardBorder}08`}
              stroke={zone.tee ? "#f59e0b25" : `${t.cardBorder}15`}
              strokeWidth={zone.tee ? 1.5 : 1}
              strokeDasharray={zone.tee ? "5 3" : "none"}
            />
            {/* Zone label at top */}
            <text
              x={zone.x + zone.w / 2}
              y={zone.y + 12}
              textAnchor="middle"
              fill={zone.tee ? "#f59e0b90" : `${t.inkMuted}60`}
              fontSize={7}
              fontWeight={800}
              fontFamily="'SF Mono','Fira Code',monospace"
              letterSpacing={1.2}
            >
              {zone.label}
            </text>
            {/* Zone subtitle */}
            {zone.subtitle && (
              <text
                x={zone.x + zone.w / 2}
                y={zone.y + zone.h - 5}
                textAnchor="middle"
                fill={zone.tee ? "#f59e0b50" : `${t.inkMuted}35`}
                fontSize={6}
                fontFamily="'SF Mono','Fira Code',monospace"
                letterSpacing={0.5}
              >
                {zone.subtitle}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Edge layer */}
      <EdgeLayer steps={steps} />

      {/* Nodes */}
      {steps.map((step) => {
        const layout = NODE_LAYOUT[step.id];
        if (!layout) return null;
        const center = nodeCenter(layout);
        return (
          <ArchNode
            key={step.id}
            step={step}
            x={center.x}
            y={center.y}
            isAce={step.id === "ace"}
            aceExpanded={aceExpanded}
            onHover={(rect) => handleHover(step.id, rect)}
            onLeave={handleLeave}
            onClick={step.id === "ace" ? onToggleAce : undefined}
          />
        );
      })}

      {/* ACE expandable panel */}
      {aceStep && aceStep.status !== "idle" && (
        <AcePanel
          expanded={aceExpanded}
          aceStatus={aceStep.status}
          scenario={scenario}
          x={aceCenter.x}
          y={aceCenter.y}
        />
      )}

      {/* Result overlay strip — pinned to bottom of graph, no layout shift */}
      {result && (
        <ResultStrip result={result} generation={generation} />
      )}

      {/* Tooltip */}
      <Tooltip
        visible={tooltipData.visible}
        tooltip={tooltipData.tooltip}
        anchorRect={tooltipData.anchorRect}
        containerRef={containerRef}
      />
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────

export function ArchitectureViz(props: ArchitectureVizProps) {
  const mobile = useIsMobile();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {mobile ? <MobileViz {...props} /> : <DesktopViz {...props} />}
    </div>
  );
}
