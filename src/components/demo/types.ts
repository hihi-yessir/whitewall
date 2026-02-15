export type StepStatus = 'idle' | 'active' | 'pass' | 'fail' | 'skipped';

export type ScenarioId = 'idle' | 'anon-bot' | 'registered-bot' | 'verified-agent' | 'try-it';

export interface PipelineStepState {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
  timing?: number;
}

export interface TerminalEntry {
  tag: string;
  message: string;
  status: 'info' | 'pass' | 'fail' | 'warn';
  timestamp: number;
}

export interface DemoState {
  act: 1 | 2 | 3 | 4;
  scenario: ScenarioId;
  pipeline: PipelineStepState[];
  terminal: TerminalEntry[];
  isRunning: boolean;
  wallet: { connected: boolean; address?: string };
  agent: { id?: bigint; isRegistered: boolean; isApproved: boolean; isHumanVerified: boolean };
  result?: { granted: boolean; accountableHuman?: string; tier?: number; reason?: string };
}

export const PIPELINE_STEPS: PipelineStepState[] = [
  { id: 'agent', label: 'Agent', status: 'idle' },
  { id: 'x402', label: 'x402', status: 'idle' },
  { id: 'gateway', label: 'Gateway', status: 'idle' },
  { id: 'cre', label: 'CRE', status: 'idle' },
  { id: 'gate1', label: 'G1: Identity', status: 'idle' },
  { id: 'gate2', label: 'G2: Verification', status: 'idle' },
  { id: 'gate3', label: 'G3: Liveness', status: 'idle' },
  { id: 'gate4', label: 'G4: Reputation', status: 'idle' },
  { id: 'don', label: 'DON', status: 'idle' },
  { id: 'ace', label: 'ACE', status: 'idle' },
  { id: 'result', label: 'Result', status: 'idle' },
];

export type DemoAction =
  | { type: 'SET_ACT'; act: 1 | 2 | 3 | 4 }
  | { type: 'SET_SCENARIO'; scenario: ScenarioId }
  | { type: 'RESET_PIPELINE' }
  | { type: 'UPDATE_STEP'; stepId: string; status: StepStatus; detail?: string; timing?: number }
  | { type: 'SKIP_REMAINING'; afterStepId: string }
  | { type: 'ADD_TERMINAL'; entry: TerminalEntry }
  | { type: 'CLEAR_TERMINAL' }
  | { type: 'SET_RUNNING'; isRunning: boolean }
  | { type: 'SET_WALLET'; wallet: DemoState['wallet'] }
  | { type: 'SET_AGENT'; agent: Partial<DemoState['agent']> }
  | { type: 'SET_RESULT'; result: DemoState['result'] };

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'SET_ACT':
      return { ...state, act: action.act };
    case 'SET_SCENARIO':
      return { ...state, scenario: action.scenario };
    case 'RESET_PIPELINE':
      return {
        ...state,
        pipeline: PIPELINE_STEPS.map(s => ({ ...s, status: 'idle' as StepStatus, detail: undefined, timing: undefined })),
        terminal: [],
        result: undefined,
        isRunning: false,
      };
    case 'UPDATE_STEP':
      return {
        ...state,
        pipeline: state.pipeline.map(s =>
          s.id === action.stepId
            ? { ...s, status: action.status, detail: action.detail ?? s.detail, timing: action.timing ?? s.timing }
            : s
        ),
      };
    case 'SKIP_REMAINING': {
      const idx = state.pipeline.findIndex(s => s.id === action.afterStepId);
      return {
        ...state,
        pipeline: state.pipeline.map((s, i) =>
          i > idx && s.status === 'idle' ? { ...s, status: 'skipped' as StepStatus } : s
        ),
      };
    }
    case 'ADD_TERMINAL':
      return { ...state, terminal: [...state.terminal, action.entry] };
    case 'CLEAR_TERMINAL':
      return { ...state, terminal: [] };
    case 'SET_RUNNING':
      return { ...state, isRunning: action.isRunning };
    case 'SET_WALLET':
      return { ...state, wallet: action.wallet };
    case 'SET_AGENT':
      return { ...state, agent: { ...state.agent, ...action.agent } };
    case 'SET_RESULT':
      return { ...state, result: action.result };
    default:
      return state;
  }
}

export const initialDemoState: DemoState = {
  act: 1,
  scenario: 'idle',
  pipeline: PIPELINE_STEPS.map(s => ({ ...s })),
  terminal: [],
  isRunning: false,
  wallet: { connected: false },
  agent: { isRegistered: false, isApproved: false, isHumanVerified: false },
};
