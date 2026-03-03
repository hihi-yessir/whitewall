"use client";

import { useState, useReducer, useCallback, useEffect, useMemo, useContext } from "react";
import { ThemeCtx } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import { DemoNav } from "./DemoNav";
import { NodeDetailPane } from "./NodeDetailPane";
import { ArchitectureViz } from "./ArchitectureViz";
import { LiveTerminal } from "./LiveTerminal";
import { demoReducer, initialDemoState } from "./types";
import type { ScenarioId, ActNumber } from "./types";

const SCENARIO_ORDER: ScenarioId[] = [
  "anon-bot", "registered-bot", "verified-agent", "kyc-agent", "credit-agent",
];

export default function DemoPage() {
  const { t } = useContext(ThemeCtx);
  const mobile = useIsMobile();

  const [state, dispatch] = useReducer(demoReducer, initialDemoState);

  // Derive active step from pipeline
  const activeStepId = useMemo(
    () => state.pipeline.find((s) => s.status === "active")?.id ?? null,
    [state.pipeline],
  );

  // Check for presentation mode
  const [presentMode, setPresentMode] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPresentMode(params.get("mode") === "present");
  }, []);

  // Run simulation via SSE
  const runScenario = useCallback(async (scenario: ScenarioId) => {
    dispatch({ type: "RESET_PIPELINE" });
    dispatch({ type: "SET_SCENARIO", scenario });
    dispatch({ type: "SET_RUNNING", isRunning: true });

    const actMap: Record<string, ActNumber> = {
      "anon-bot": 1, "registered-bot": 2, "verified-agent": 3,
      "kyc-agent": 4, "credit-agent": 5,
    };
    dispatch({ type: "SET_ACT", act: actMap[scenario] || 1 });

    try {
      const modeParam = presentMode ? "&mode=present" : "";
      const resp = await fetch(`/api/simulate?scenario=${scenario}${modeParam}`);
      const reader = resp.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "done") {
            dispatch({ type: "SET_RUNNING", isRunning: false });
            return;
          }
          if (data.type === "step") {
            dispatch({ type: "UPDATE_STEP", stepId: data.stepId, status: data.status, detail: data.detail, timing: data.timing });
          }
          if (data.type === "terminal") {
            dispatch({ type: "ADD_TERMINAL", entry: { tag: data.tag, message: data.message, status: data.termStatus, timestamp: Date.now() } });
          }
          if (data.type === "result") {
            dispatch({ type: "SET_RESULT", result: data.result });
          }
          if (data.skipAfter) {
            dispatch({ type: "SKIP_REMAINING", afterStepId: data.skipAfter });
          }
        }
      }
    } catch (err) {
      console.error("Simulation error:", err);
      dispatch({ type: "ADD_TERMINAL", entry: {
        tag: "SYSTEM", message: "Connection lost — simulation interrupted.",
        status: "fail" as const, timestamp: Date.now(),
      }});
    }
    dispatch({ type: "SET_RUNNING", isRunning: false });
  }, [presentMode]);

  const handleScenario = useCallback((scenario: ScenarioId) => {
    if (!state.isRunning) runScenario(scenario);
  }, [runScenario, state.isRunning]);

  // Keyboard shortcuts for presentation mode
  useEffect(() => {
    if (!presentMode) return;
    const handler = (e: KeyboardEvent) => {
      const idx = SCENARIO_ORDER.indexOf(state.scenario);
      if (e.key === "ArrowRight" && idx < SCENARIO_ORDER.length - 1) {
        handleScenario(SCENARIO_ORDER[idx + 1]);
      } else if (e.key === "ArrowLeft" && idx > 0) {
        handleScenario(SCENARIO_ORDER[idx - 1]);
      } else if (e.key === " " && !state.isRunning) {
        e.preventDefault();
        if (state.scenario !== "idle") runScenario(state.scenario);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [presentMode, state.scenario, state.isRunning, handleScenario, runScenario]);

  return (
    <>
      {/* Edge fade overlay */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
          background: mobile
            ? `linear-gradient(90deg,${t.bg}AA 0%,transparent 25%,transparent 75%,${t.bg}AA 100%),linear-gradient(180deg,${t.bg} 0%,transparent 15%,transparent 90%,${t.bg} 100%)`
            : `linear-gradient(90deg,${t.bg} 0%,${t.bg}BB 12%,${t.bg}55 30%,transparent 50%,transparent 92%,${t.bg} 100%),linear-gradient(180deg,${t.bg} 0%,transparent 15%,transparent 90%,${t.bg} 100%)`,
          transition: "background .4s",
        }} />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
          <DemoNav
            currentScenario={state.scenario}
            isRunning={state.isRunning}
            onScenario={handleScenario}
          />

          <div style={{
            flex: 1, display: "flex",
            flexDirection: mobile ? "column" : "row",
            overflow: "hidden",
            animation: "actFadeIn .25s ease-out",
          }}>
            {/* Left: Node Detail Pane */}
            <NodeDetailPane
              scenario={state.scenario}
              activeStepId={activeStepId}
              steps={state.pipeline}
            />

            {/* Center: Architecture Viz + Terminal — frosted panel */}
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              minHeight: 0,
              margin: mobile ? 8 : 16,
              marginLeft: mobile ? 8 : 0,
              background: `${t.card}B0`,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: `1px solid ${t.cardBorder}40`,
              borderRadius: 14,
              overflow: "hidden",
              transition: "background .4s, border-color .4s",
            }}>
              <ArchitectureViz
                steps={state.pipeline}
                scenario={state.scenario}
                aceExpanded={state.aceExpanded}
                onToggleAce={() => dispatch({ type: "TOGGLE_ACE_PANEL" })}
                result={state.result}
                generation={state.generation}
              />

              <LiveTerminal entries={state.terminal} />
            </div>
          </div>
        </div>

        {/* Global styles */}
        <style>{`
          @keyframes actFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes demoPulse {
            0%, 100% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.1); }
          }
          @keyframes termFadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: none; }
          }
          @keyframes edgeFlow {
            from { stroke-dashoffset: 10; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes resultAppear {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: none; }
          }
          ::selection { background: ${t.blue}30; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: ${t.bg}; }
          ::-webkit-scrollbar-thumb { background: ${t.blue}; border-radius: 3px; }
        `}</style>
    </>
  );
}
