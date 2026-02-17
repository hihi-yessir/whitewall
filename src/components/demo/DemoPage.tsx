"use client";

import { useState, useReducer, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { themes, ThemeCtx } from "../shared/theme";
import { useIsMobile } from "../shared/hooks";
import { MeshBG } from "../shared/MeshBG";
import { DemoNav } from "./DemoNav";
import { ControlPanel } from "./ControlPanel";
import { PipelineViz } from "./PipelineViz";
import { LiveTerminal } from "./LiveTerminal";
import { ResultCard } from "./ResultCard";
import { demoReducer, initialDemoState } from "./types";
import type { ThemeMode } from "../shared/theme";
import type { ScenarioId } from "./types";

// Lazy-load TryItFlow (heavy: viem + idkit) — only compiled when Act 4 is active
const TryItFlow = dynamic(() => import("./TryItFlow").then(m => ({ default: m.TryItFlow })), {
  ssr: false,
  loading: () => <div style={{ padding: 24, opacity: 0.5 }}>Loading wallet tools...</div>,
});

export default function DemoPage() {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const toggle = () => setMode((m) => (m === "dark" ? "light" : "dark"));
  const t = themes[mode];
  const mobile = useIsMobile();

  const [state, dispatch] = useReducer(demoReducer, initialDemoState);

  // Check for presentation mode
  const [presentMode, setPresentMode] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPresentMode(params.get("mode") === "present");
  }, []);

  // Run simulation via SSE
  const runScenario = useCallback(async (scenario: ScenarioId) => {
    // Reset pipeline
    dispatch({ type: "RESET_PIPELINE" });
    dispatch({ type: "SET_SCENARIO", scenario });
    dispatch({ type: "SET_RUNNING", isRunning: true });

    // Set act based on scenario
    const actMap: Record<string, 1 | 2 | 3 | 4> = {
      "anon-bot": 1, "registered-bot": 2, "verified-agent": 3, "try-it": 4,
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

  const handleActChange = useCallback((act: 1 | 2 | 3 | 4) => {
    dispatch({ type: "SET_ACT", act });
    if (presentMode) {
      // In presentation mode, auto-run scenario when switching acts
      const scenarioMap: Record<number, ScenarioId> = {
        1: "anon-bot", 2: "registered-bot", 3: "verified-agent",
      };
      if (act <= 3) {
        runScenario(scenarioMap[act]);
      }
    }
  }, [presentMode, runScenario]);

  const handleScenario = useCallback((scenario: ScenarioId) => {
    runScenario(scenario);
  }, [runScenario]);

  const handleTryIt = useCallback(() => {
    dispatch({ type: "RESET_PIPELINE" });
    dispatch({ type: "SET_ACT", act: 4 });
    dispatch({ type: "SET_SCENARIO", scenario: "try-it" });
  }, []);

  // Keyboard shortcuts for presentation mode
  useEffect(() => {
    if (!presentMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && state.act < 4) {
        handleActChange((state.act + 1) as 1 | 2 | 3 | 4);
      } else if (e.key === "ArrowLeft" && state.act > 1) {
        handleActChange((state.act - 1) as 1 | 2 | 3 | 4);
      } else if (e.key === " " && !state.isRunning) {
        e.preventDefault();
        const scenarioMap: Record<number, ScenarioId> = {
          1: "anon-bot", 2: "registered-bot", 3: "verified-agent",
        };
        if (state.act <= 3) runScenario(scenarioMap[state.act]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [presentMode, state.act, state.isRunning, handleActChange, runScenario]);

  return (
    <ThemeCtx.Provider value={{ mode, toggle, t }}>
      <div style={{
        background: t.bg, minHeight: "100vh", color: t.ink,
        fontFamily: "'Inter',system-ui,-apple-system,sans-serif",
        display: "flex", flexDirection: "column",
        transition: "background .4s, color .4s",
      }}>
        {/* Mesh background — brand requirement: always present */}
        <MeshBG />

        {/* Edge fade overlay — matches landing page */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
          background: mobile
            ? `linear-gradient(90deg,${t.bg}AA 0%,transparent 25%,transparent 75%,${t.bg}AA 100%),linear-gradient(180deg,${t.bg} 0%,transparent 15%,transparent 90%,${t.bg} 100%)`
            : `linear-gradient(90deg,${t.bg} 0%,${t.bg}BB 12%,${t.bg}55 30%,transparent 50%,transparent 92%,${t.bg} 100%),linear-gradient(180deg,${t.bg} 0%,transparent 15%,transparent 90%,${t.bg} 100%)`,
          transition: "background .4s",
        }} />

        {/* All content above mesh */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <DemoNav currentAct={state.act} onActChange={handleActChange} />

        <div key={state.act} style={{
          flex: 1, display: "flex",
          flexDirection: mobile ? "column" : "row",
          overflow: "hidden",
          animation: "actFadeIn .25s ease-out",
        }}>
          {/* Left: Control Panel or Try It */}
          {state.act === 4 ? (
            <div style={{
              width: mobile ? "100%" : 280,
              borderRight: mobile ? "none" : `1px solid ${t.cardBorder}40`,
              borderBottom: mobile ? `1px solid ${t.cardBorder}40` : "none",
              overflowY: "auto",
              maxHeight: mobile ? 400 : "none",
            }}>
              <TryItFlow dispatch={dispatch} wallet={state.wallet} agent={state.agent} prompt={state.prompt} isGenerating={state.isGenerating} generation={state.generation} />
            </div>
          ) : (
            <ControlPanel
              currentAct={state.act}
              isRunning={state.isRunning}
              onScenario={handleScenario}
              onTryIt={handleTryIt}
            />
          )}

          {/* Center: Pipeline Viz + Result + Terminal — frosted panel */}
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
            <PipelineViz steps={state.pipeline} />

            {/* Result card */}
            {state.result && (
              <div style={{
                padding: mobile ? "0 16px 16px" : "0 32px 24px",
                maxWidth: 440, alignSelf: "center", width: "100%",
              }}>
                <ResultCard result={state.result} generation={state.generation} />
              </div>
            )}

            {/* Terminal inside the panel */}
            <LiveTerminal entries={state.terminal} />
          </div>
        </div>
        </div>{/* end content wrapper */}

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
          @keyframes resultAppear {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: none; }
          }
          ::selection { background: ${t.blue}30; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: ${t.bg}; }
          ::-webkit-scrollbar-thumb { background: ${t.blue}; border-radius: 3px; }
        `}</style>
      </div>
    </ThemeCtx.Provider>
  );
}
