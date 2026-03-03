"use client";

import { useContext } from "react";
import { ThemeCtx } from "../shared/theme";
import type { NodeTooltip } from "./graph";

interface TooltipProps {
  visible: boolean;
  tooltip: NodeTooltip | null;
  anchorRect: DOMRect | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function Tooltip({ visible, tooltip, anchorRect, containerRef }: TooltipProps) {
  const { t } = useContext(ThemeCtx);

  if (!tooltip || !anchorRect || !containerRef.current) return null;

  const containerRect = containerRef.current.getBoundingClientRect();
  const x = anchorRect.left + anchorRect.width / 2 - containerRect.left;
  const y = anchorRect.top - containerRect.top - 10;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -100%)",
        zIndex: 20,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity .2s ease",
      }}
    >
      <div
        style={{
          background: `${t.card}F0`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: `1px solid ${t.cardBorder}50`,
          borderRadius: 8,
          padding: "8px 12px",
          maxWidth: 220,
          boxShadow: `0 4px 20px ${t.bg}80`,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.5,
            color: t.ink,
            marginBottom: 3,
          }}
        >
          {tooltip.title}
        </div>
        <div
          style={{
            fontSize: 9,
            lineHeight: 1.4,
            color: t.inkMuted,
          }}
        >
          {tooltip.description}
        </div>
      </div>
    </div>
  );
}
