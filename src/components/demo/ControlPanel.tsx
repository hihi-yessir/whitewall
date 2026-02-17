"use client";

import { useContext, useState } from "react";
import { ThemeCtx, Btn } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import type { ScenarioId } from "./types";

const scenarios: { id: ScenarioId; label: string; desc: string; act: 1 | 2 | 3 }[] = [
  { id: "anon-bot", label: "Anonymous Bot", desc: "No ERC-8004. Blocked at Gate 1.", act: 1 },
  { id: "registered-bot", label: "Registered Bot", desc: "ERC-8004 but unverified. Blocked at Gate 2.", act: 2 },
  { id: "verified-agent", label: "Verified Agent", desc: "ERC-8004 + World ID. All gates pass.", act: 3 },
];

export function ControlPanel({ currentAct, isRunning, onScenario, onTryIt }: {
  currentAct: 1 | 2 | 3 | 4;
  isRunning: boolean;
  onScenario: (scenario: ScenarioId) => void;
  onTryIt: () => void;
}) {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();

  if (mobile) {
    return (
      <div style={{
        display: "flex", gap: 8, padding: "12px 16px",
        overflowX: "auto", borderBottom: `1px solid ${t.cardBorder}40`,
      }}>
        {scenarios.map((s) => (
          <Btn key={s.id} small onClick={() => onScenario(s.id)}
            disabled={isRunning}
            primary={currentAct === s.act}>
            {s.label}
          </Btn>
        ))}
        <Btn small primary={currentAct === 4} onClick={onTryIt} disabled={isRunning}>
          Try It
        </Btn>
      </div>
    );
  }

  return (
    <div style={{
      width: 220, borderRight: `1px solid ${t.cardBorder}40`,
      padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16,
      background: `${t.card}CC`, backdropFilter: "blur(8px)",
    }}>
      <span style={{
        fontSize: 12, fontWeight: 700, letterSpacing: 2,
        color: t.blue, textTransform: "uppercase",
      }}>
        Scenarios
      </span>

      {scenarios.map((s) => (
        <ScenarioButton
          key={s.id}
          label={s.label}
          desc={s.desc}
          active={currentAct === s.act}
          disabled={isRunning}
          onClick={() => onScenario(s.id)}
        />
      ))}

      <div style={{ height: 1, background: `${t.cardBorder}40`, margin: "4px 0" }} />

      <ScenarioButton
        label="Try It Yourself"
        desc="Register, verify, run the full pipeline."
        active={currentAct === 4}
        disabled={isRunning}
        onClick={onTryIt}
        primary
      />
    </div>
  );
}

function ScenarioButton({ label, desc, active, disabled, onClick, primary }: {
  label: string; desc: string; active: boolean; disabled: boolean;
  onClick: () => void; primary?: boolean;
}) {
  const { t } = useContext(ThemeCtx);
  const [h, setH] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        textAlign: "left", padding: "14px 16px", borderRadius: 14,
        border: `1.5px solid ${active ? (primary ? t.blue : t.ink) : h && !disabled ? `${t.inkMuted}60` : t.cardBorder}`,
        background: active ? (primary ? `${t.blue}15` : `${t.ink}08`) : "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all .2s",
      }}
    >
      <div style={{
        fontSize: 13, fontWeight: 700,
        color: active ? (primary ? t.blue : t.ink) : t.inkMuted,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 11, color: t.inkMuted, marginTop: 4, lineHeight: 1.4,
      }}>
        {desc}
      </div>
    </button>
  );
}
