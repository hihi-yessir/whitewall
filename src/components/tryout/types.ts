// Re-export shared types from demo
export type { PipelineStepState, TerminalEntry, GenerationResult, StepStatus } from "../demo/types";
export { PIPELINE_STEPS } from "../demo/types";

/* ── Tryout-specific types ── */

export type TryoutPhase = 1 | 2 | 3;

export interface TierData {
  registered: boolean;
  humanVerified: boolean;
  kycVerified: boolean;
  hasCreditScore: boolean;
  creditScore: number;
  effectiveTier: number;
  txHashes: {
    register?: string;
    approve?: string;
    worldId?: string;
    kyc?: string;
    credit?: string;
  };
  kycData?: { verified: boolean; sessionHash: string; verifiedAt: number } | null;
  creditData?: { score: number; dataHash: string; verifiedAt: number; hasScore: boolean } | null;
}

export type KYCStatus = "idle" | "creating" | "verifying" | "submitting" | "done" | "error";
export type CreditStatus = "idle" | "creating" | "linking" | "submitting" | "done" | "error";

export interface TryoutState {
  phase: TryoutPhase;
  wallet: { connected: boolean; address?: string };
  agent: {
    id?: bigint;
    isRegistered: boolean;
    isApproved: boolean;
    isHumanVerified: boolean;
    agentWallet?: string;
    agentFunded?: boolean;
  };
  pipeline: import("../demo/types").PipelineStepState[];
  terminal: import("../demo/types").TerminalEntry[];
  isRunning: boolean;
  prompt: string;
  isGenerating: boolean;
  generation?: import("../demo/types").GenerationResult;
  videoGeneration?: import("../demo/types").GenerationResult;
  result?: { granted: boolean; accountableHuman?: string; tier?: number; reason?: string };
  tierData: TierData;
  kycStatus: KYCStatus;
  creditStatus: CreditStatus;
}

export type TryoutAction =
  | { type: "SET_PHASE"; phase: TryoutPhase }
  | { type: "SET_WALLET"; wallet: TryoutState["wallet"] }
  | { type: "SET_AGENT"; agent: Partial<TryoutState["agent"]> }
  | { type: "RESET_PIPELINE" }
  | { type: "UPDATE_STEP"; stepId: string; status: import("../demo/types").StepStatus; detail?: string; timing?: number }
  | { type: "SKIP_REMAINING"; afterStepId: string }
  | { type: "ADD_TERMINAL"; entry: import("../demo/types").TerminalEntry }
  | { type: "CLEAR_TERMINAL" }
  | { type: "SET_RUNNING"; isRunning: boolean }
  | { type: "SET_PROMPT"; prompt: string }
  | { type: "SET_GENERATING"; isGenerating: boolean }
  | { type: "SET_GENERATION"; generation: import("../demo/types").GenerationResult | undefined }
  | { type: "SET_VIDEO_GENERATION"; generation: import("../demo/types").GenerationResult | undefined }
  | { type: "SET_RESULT"; result: TryoutState["result"] }
  | { type: "SET_TIER_DATA"; tierData: Partial<TierData> }
  | { type: "SET_KYC_STATUS"; status: KYCStatus }
  | { type: "SET_CREDIT_STATUS"; status: CreditStatus }
  | { type: "RESET_ALL" };

import { PIPELINE_STEPS } from "../demo/types";
import type { StepStatus, PipelineStepState } from "../demo/types";

export const initialTierData: TierData = {
  registered: false,
  humanVerified: false,
  kycVerified: false,
  hasCreditScore: false,
  creditScore: 0,
  effectiveTier: 0,
  txHashes: {},
};

export const initialTryoutState: TryoutState = {
  phase: 1,
  wallet: { connected: false },
  agent: { isRegistered: false, isApproved: false, isHumanVerified: false },
  pipeline: PIPELINE_STEPS.map((s) => ({ ...s })),
  terminal: [],
  isRunning: false,
  prompt: "",
  isGenerating: false,
  tierData: { ...initialTierData },
  kycStatus: "idle",
  creditStatus: "idle",
};

export function tryoutReducer(state: TryoutState, action: TryoutAction): TryoutState {
  switch (action.type) {
    case "SET_PHASE":
      return { ...state, phase: action.phase };
    case "SET_WALLET":
      return { ...state, wallet: action.wallet };
    case "SET_AGENT":
      return { ...state, agent: { ...state.agent, ...action.agent } };
    case "RESET_PIPELINE":
      return {
        ...state,
        pipeline: PIPELINE_STEPS.map((s) => ({ ...s, status: "idle" as StepStatus, detail: undefined, timing: undefined })),
        terminal: [],
        result: undefined,
        isRunning: false,
        prompt: "",
        isGenerating: false,
        generation: undefined,
      };
    case "UPDATE_STEP":
      return {
        ...state,
        pipeline: state.pipeline.map((s) =>
          s.id === action.stepId
            ? { ...s, status: action.status, detail: action.detail ?? s.detail, timing: action.timing ?? s.timing }
            : s
        ),
      };
    case "SKIP_REMAINING": {
      const idx = state.pipeline.findIndex((s) => s.id === action.afterStepId);
      return {
        ...state,
        pipeline: state.pipeline.map((s, i) =>
          i > idx && s.status === "idle" ? { ...s, status: "skipped" as StepStatus } : s
        ),
      };
    }
    case "ADD_TERMINAL":
      return { ...state, terminal: [...state.terminal, action.entry] };
    case "CLEAR_TERMINAL":
      return { ...state, terminal: [] };
    case "SET_RUNNING":
      return { ...state, isRunning: action.isRunning };
    case "SET_PROMPT":
      return { ...state, prompt: action.prompt };
    case "SET_GENERATING":
      return { ...state, isGenerating: action.isGenerating };
    case "SET_GENERATION":
      return { ...state, generation: action.generation };
    case "SET_VIDEO_GENERATION":
      return { ...state, videoGeneration: action.generation };
    case "SET_RESULT":
      return { ...state, result: action.result };
    case "SET_TIER_DATA":
      return { ...state, tierData: { ...state.tierData, ...action.tierData } };
    case "SET_KYC_STATUS":
      return { ...state, kycStatus: action.status };
    case "SET_CREDIT_STATUS":
      return { ...state, creditStatus: action.status };
    case "RESET_ALL":
      return { ...initialTryoutState, pipeline: PIPELINE_STEPS.map((s) => ({ ...s })), tierData: { ...initialTierData } };
    default:
      return state;
  }
}
