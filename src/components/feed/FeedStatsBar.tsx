"use client";

import { useContext } from "react";
import { ThemeCtx } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import type { FeedStats } from "./types";

export function FeedStatsBar({ stats }: { stats: FeedStats }) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();

  const items = [
    { label: "Total", value: stats.total, color: t.ink },
    { label: "Approved", value: stats.granted, color: t.green },
    { label: "Denied", value: stats.denied, color: t.red },
    { label: "Agents", value: stats.uniqueAgents, color: t.blue },
  ];

  return (
    <div style={{
      display: "flex", gap: mobile ? 12 : 24,
      padding: mobile ? "12px 16px" : "16px 32px",
      justifyContent: "center", flexWrap: "wrap",
    }}>
      {items.map((item) => (
        <div key={item.label} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          minWidth: 60,
        }}>
          <span style={{ fontSize: mobile ? 20 : 24, fontWeight: 900, color: item.color }}>{item.value}</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: t.inkMuted }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
