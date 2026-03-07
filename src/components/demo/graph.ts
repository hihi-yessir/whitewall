/**
 * Architecture graph layout: node positions, edges, tooltips, ACE checks.
 * Pure data + math — no React.
 */

// ─── Node Groups ─────────────────────────────────────────

export type NodeGroup = "entry" | "onchain" | "http" | "consensus" | "policy" | "result";

export interface NodeLayout {
  col: number;   // 0-based column
  row: number;   // fractional row (0 = center line, negative = up, positive = down)
  group: NodeGroup;
}

// ─── Edge Definition ─────────────────────────────────────

export interface EdgeDef {
  from: string;
  to: string;
  label?: string;
}

// ─── Tooltip ─────────────────────────────────────────────

export interface NodeTooltip {
  title: string;
  description: string;
}

// ─── ACE Check ───────────────────────────────────────────

export interface AceCheck {
  id: string;
  label: string;
  description: string;
  minTier: number;
}

// ─── Layout Constants ────────────────────────────────────

export const COL_WIDTH = 120;
export const ROW_HEIGHT = 100;
export const NODE_SIZE = 48;
export const GRAPH_PAD = { x: 50, y: 0 };

// Total columns: 0-7 → canvas width = 50 + 7*120 + 50 = 940
export const CANVAS_W = GRAPH_PAD.x * 2 + 7 * COL_WIDTH;
// Rows span from -1.5 to +1.5 → 3 * 100 = 300, plus padding
export const CANVAS_H = ROW_HEIGHT * 4 + 80;

// ─── Node Icons (unique per node) ───────────────────────

export const NODE_ICONS: Record<string, string> = {
  agent: "A",
  x402: "$",
  gateway: "G",
  cre: "C",
  gate1: "1",
  gate2: "2",
  gate3: "3",
  gate4: "4",
  don: "D",
  ace: "P",
  result: "R",
};

// ─── Node Positions (keyed by step id) ──────────────────

export const NODE_LAYOUT: Record<string, NodeLayout> = {
  agent:   { col: 0, row: 0,    group: "entry" },
  x402:    { col: 1, row: 0,    group: "entry" },
  gateway: { col: 2, row: 0,    group: "entry" },
  cre:     { col: 3, row: 0,    group: "entry" },
  gate1:   { col: 4, row: -1.5, group: "onchain" },
  gate2:   { col: 4, row: -0.5, group: "onchain" },
  gate3:   { col: 4, row: 0.5,  group: "http" },
  gate4:   { col: 4, row: 1.5,  group: "http" },
  don:     { col: 5, row: 0,    group: "consensus" },
  ace:     { col: 6, row: 0,    group: "policy" },
  result:  { col: 7, row: 0,    group: "result" },
};

// ─── Edges ───────────────────────────────────────────────

export const GRAPH_EDGES: EdgeDef[] = [
  { from: "agent",   to: "x402" },
  { from: "x402",    to: "gateway" },
  { from: "gateway", to: "cre" },
  { from: "cre",     to: "gate1", label: "On-Chain" },
  { from: "cre",     to: "gate2" },
  { from: "cre",     to: "gate3", label: "Conf. HTTP" },
  { from: "cre",     to: "gate4" },
  { from: "gate1",   to: "don" },
  { from: "gate2",   to: "don" },
  { from: "gate3",   to: "don" },
  { from: "gate4",   to: "don" },
  { from: "don",     to: "ace" },
  { from: "ace",     to: "result" },
];

// ─── Tooltips ────────────────────────────────────────────

export const NODE_TOOLTIPS: Record<string, NodeTooltip> = {
  agent:   { title: "AI Agent",          description: "Initiates a resource request via HTTP with ERC-8004 identity" },
  x402:    { title: "x402 Payment",      description: "HTTP 402 payment protocol — holds USDC escrow before verification" },
  gateway: { title: "ResourceGateway",   description: "Validates payment JWT and extracts agent metadata from the request" },
  cre:     { title: "CRE Workflow",      description: "Chainlink CRE orchestrates the full verification workflow off-chain" },
  gate1:   { title: "G1: Identity",      description: "On-chain read: checks ERC-8004 IdentityRegistry for agent registration" },
  gate2:   { title: "G2: Human",         description: "On-chain read: verifies World ID human bond via ValidationRegistry" },
  gate3:   { title: "G3: KYC",           description: "Confidential HTTP: calls Stripe Identity API inside TEE enclave" },
  gate4:   { title: "G4: Credit (TEE)",   description: "Credit score computed inside TEE enclave via Plaid — returns attested score, verified on-chain" },
  don:     { title: "DON Consensus",     description: "Decentralized Oracle Network: multi-node consensus on verification report" },
  ace:     { title: "ACE Pipeline",      description: "On-chain re-validation — Extractor + TieredPolicy with 8 checks. Click to expand." },
  result:  { title: "Result",            description: "Final access decision: granted with tier level, or denied with refund" },
};

// ─── ACE 8-Check Definitions ─────────────────────────────

export const ACE_CHECKS: AceCheck[] = [
  { id: "ace-1", label: "CRE Approved",     description: "CRE report: approved == true",                    minTier: 2 },
  { id: "ace-2", label: "Tier Sufficient",   description: "CRE report: tier >= requested tier",              minTier: 2 },
  { id: "ace-3", label: "Registered",        description: "IdentityRegistry: agent is registered",           minTier: 2 },
  { id: "ace-4", label: "Human Verified",    description: "IdentityRegistry: humanVerified metadata set",    minTier: 2 },
  { id: "ace-5", label: "World ID",          description: "WorldIDValidator: tamper-proof human verification", minTier: 2 },
  { id: "ace-6", label: "KYC Passed",        description: "StripeKYCValidator: tamper-proof KYC",            minTier: 3 },
  { id: "ace-7", label: "Credit Exists",     description: "PlaidCreditValidator: credit score exists",       minTier: 4 },
  { id: "ace-8", label: "Score >= 50",       description: "PlaidCreditValidator: score >= threshold",        minTier: 4 },
];

// ─── Coordinate Math ─────────────────────────────────────

/** Center of the canvas (vertical midpoint) */
const centerY = CANVAS_H / 2;

/** Pixel center of a node given its layout position */
export function nodeCenter(layout: NodeLayout): { x: number; y: number } {
  return {
    x: GRAPH_PAD.x + layout.col * COL_WIDTH,
    y: centerY + layout.row * ROW_HEIGHT,
  };
}

/** Right anchor point of a node (for outgoing edges) */
export function nodeRight(layout: NodeLayout): { x: number; y: number } {
  const c = nodeCenter(layout);
  return { x: c.x + NODE_SIZE / 2, y: c.y };
}

/** Left anchor point of a node (for incoming edges) */
export function nodeLeft(layout: NodeLayout): { x: number; y: number } {
  const c = nodeCenter(layout);
  return { x: c.x - NODE_SIZE / 2, y: c.y };
}

/** SVG cubic bezier path between two points (horizontal bias) */
export function bezierPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = (to.x - from.x) * 0.45;
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

/** SVG straight horizontal path between two points */
export function straightPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
}

// ─── Group Backgrounds ───────────────────────────────────

export interface GroupZone {
  label: string;
  subtitle?: string;
  group: NodeGroup;
  x: number;
  y: number;
  w: number;
  h: number;
  tee?: boolean;
}

export function computeGroupZones(): GroupZone[] {
  const hs = NODE_SIZE / 2;

  // Entry group: agent through cre (cols 0-3)
  const ePad = 22;
  const entryLeft = nodeCenter(NODE_LAYOUT.agent).x - hs - ePad;
  const entryRight = nodeCenter(NODE_LAYOUT.cre).x + hs + ePad;
  const entryY = centerY - hs - ePad;
  const entryH = NODE_SIZE + ePad * 2;

  // Vertical gate groups get more padding for breathing room
  const vPad = 28;

  // On-chain group: gate1 + gate2
  const g1 = nodeCenter(NODE_LAYOUT.gate1);
  const g2 = nodeCenter(NODE_LAYOUT.gate2);
  const onchainLeft = g1.x - hs - vPad;
  const onchainRight = g1.x + hs + vPad;
  const onchainTop = g1.y - hs - vPad;
  const onchainBottom = g2.y + hs + vPad;

  // HTTP/TEE group: gate3 + gate4
  const g3 = nodeCenter(NODE_LAYOUT.gate3);
  const g4 = nodeCenter(NODE_LAYOUT.gate4);
  const httpLeft = g3.x - hs - vPad;
  const httpRight = g3.x + hs + vPad;
  const httpTop = g3.y - hs - vPad;
  const httpBottom = g4.y + hs + vPad;

  // Single-node groups
  const sPad = 22;
  const donC = nodeCenter(NODE_LAYOUT.don);
  const aceC = nodeCenter(NODE_LAYOUT.ace);
  const resC = nodeCenter(NODE_LAYOUT.result);

  return [
    { label: "ENTRY", subtitle: "Request Pipeline", group: "entry",
      x: entryLeft, y: entryY, w: entryRight - entryLeft, h: entryH },
    { label: "ON-CHAIN", subtitle: "EVM State Read", group: "onchain",
      x: onchainLeft, y: onchainTop, w: onchainRight - onchainLeft, h: onchainBottom - onchainTop },
    { label: "TEE ENCLAVE", subtitle: "Confidential HTTP", group: "http", tee: true,
      x: httpLeft, y: httpTop, w: httpRight - httpLeft, h: httpBottom - httpTop },
    { label: "CONSENSUS", subtitle: "Oracle Network", group: "consensus",
      x: donC.x - hs - sPad, y: donC.y - hs - sPad,
      w: NODE_SIZE + sPad * 2, h: NODE_SIZE + sPad * 2 },
    { label: "POLICY", subtitle: "ACE Pipeline", group: "policy",
      x: aceC.x - hs - sPad, y: aceC.y - hs - sPad,
      w: NODE_SIZE + sPad * 2, h: NODE_SIZE + sPad * 2 },
    { label: "RESULT", subtitle: "Access Decision", group: "result",
      x: resC.x - hs - sPad, y: resC.y - hs - sPad,
      w: NODE_SIZE + sPad * 2, h: NODE_SIZE + sPad * 2 },
  ];
}

// ─── Scenario → Tier mapping ─────────────────────────────

export const SCENARIO_TIER: Record<string, number> = {
  "idle": 0,
  "anon-bot": 0,
  "registered-bot": 1,
  "verified-agent": 2,
  "kyc-agent": 3,
  "credit-agent": 4,
};

// ─── Scenario Overview (idle state of NodeDetailPane) ────

export interface ScenarioOverview {
  tier: number;
  title: string;
  subtitle: string;
  description: string;
}

export const SCENARIO_OVERVIEWS: Record<string, ScenarioOverview> = {
  "idle": {
    tier: 0, title: "Select a Tier",
    subtitle: "Pick a scenario from the nav bar above",
    description: "Each tier represents a different level of agent verification. Watch how the architecture responds to each level of trust.",
  },
  "anon-bot": {
    tier: 0, title: "T0: No Identity",
    subtitle: "Raw HTTP request with no ERC-8004",
    description: "An anonymous bot tries to access resources without any on-chain identity. The x402 payment layer rejects the request immediately — no valid agent JWT.",
  },
  "registered-bot": {
    tier: 1, title: "T1: Registered",
    subtitle: "ERC-8004 NFT but no human verification",
    description: "A registered agent has an on-chain identity but no proof of a human behind it. The Gateway accepts the payment, CRE checks pass for registration, but World ID verification fails.",
  },
  "verified-agent": {
    tier: 2, title: "T2: Human Verified",
    subtitle: "ERC-8004 + World ID human bond",
    description: "A human-backed agent with both registration and World ID proof. On-chain reads confirm identity and human bond. Unlocks Tier 2 resources — image generation.",
  },
  "kyc-agent": {
    tier: 3, title: "T3: KYC Verified",
    subtitle: "Stripe Identity via Confidential HTTP",
    description: "Beyond human verification, this agent's owner has passed KYC through Stripe Identity. The Confidential HTTP path protects sensitive API calls inside TEE enclaves. Unlocks video generation.",
  },
  "credit-agent": {
    tier: 4, title: "T4: Fully Verified",
    subtitle: "All 4 gates + Plaid credit scoring",
    description: "Maximum trust. Both on-chain reads and confidential HTTP paths activate. Plaid credit scoring runs inside the TEE. All 8 ACE checks pass. Premium resource access granted.",
  },
};

// ─── Node Detail Lines (per-scenario interior views) ─────

export interface DetailLine {
  text: string;
  color?: "green" | "blue" | "red" | "muted";
  indent?: boolean;
}

type NodeDetails = Record<string, DetailLine[]>;

/** Detail content for each node, parameterized by scenario tier */
function makeNodeDetails(tier: number): NodeDetails {
  const blocked = tier < 2;
  const hasKyc = tier >= 3;
  const hasCredit = tier >= 4;

  return {
    agent: [
      { text: "POST /api/resource", color: "blue" },
      { text: "Authorization: x402-jwt" },
      { text: `Agent-Id: ${tier === 0 ? "(none)" : "#42"}`, color: tier === 0 ? "red" : undefined },
      { text: `Resource: ${tier >= 4 ? "premium" : tier >= 3 ? "video" : "image"}` },
      { text: tier === 0 ? "No ERC-8004 identity attached" : "ERC-8004 identity in JWT", color: tier === 0 ? "red" : "muted" },
    ],
    x402: tier === 0 ? [
      { text: "Validating payment JWT...", color: "blue" },
      { text: "No agent identity found", color: "red" },
      { text: "402 Payment Required", color: "red" },
      { text: "Request rejected", color: "red" },
    ] : [
      { text: "Validating payment JWT...", color: "blue" },
      { text: "USDC escrow: 0.001", indent: true },
      { text: "Agent: #42", indent: true },
      { text: "Payment held in escrow", color: "green" },
    ],
    gateway: [
      { text: "ResourceGateway.request()", color: "blue" },
      { text: "Extracting agent metadata..." },
      { text: `agentId: 42`, indent: true },
      { text: `resource: ${tier >= 4 ? "premium" : tier >= 3 ? "video" : "image"}`, indent: true },
      { text: "Forwarding to CRE trigger...", color: "green" },
    ],
    cre: [
      { text: "CRE Workflow triggered", color: "blue" },
      { text: "Reading IdentityRegistry...", indent: true },
      { text: `  agent #42 → registered: ${tier >= 1 ? "true" : "false"}`, color: tier >= 1 ? "green" : "red" },
      ...(tier >= 1 ? [
        { text: "Querying WorldIDValidator...", indent: true } as DetailLine,
        { text: `  humanBond: ${tier >= 2 ? "verified (ZK)" : "not found"}`, color: (tier >= 2 ? "green" : "red") as DetailLine["color"] } as DetailLine,
      ] : []),
      ...(tier >= 2 ? [
        { text: "Evaluating tier requirement", indent: true } as DetailLine,
        { text: `  requested: ${tier >= 4 ? "Premium (T4)" : tier >= 3 ? "Video (T3)" : "Image (T2)"}`, indent: true } as DetailLine,
        { text: `  effective: T${tier} ${blocked ? "\u2717" : "\u2713"}`, color: (blocked ? "red" : "green") as DetailLine["color"] } as DetailLine,
      ] : []),
      { text: tier >= 2 ? "Building DON report..." : `Blocked — insufficient verification`, color: tier >= 2 ? "blue" : "red" },
    ],
    gate1: [
      { text: "IdentityRegistry.read()", color: "blue" },
      { text: `isRegistered(42): ${tier >= 1 ? "true" : "false"}`, indent: true, color: tier >= 1 ? "green" : "red" },
      { text: `owner: 0x5472...0603`, indent: true },
      { text: tier >= 1 ? "Registration confirmed" : "Agent not registered", color: tier >= 1 ? "green" : "red" },
    ],
    gate2: [
      { text: "ValidationRegistry.read()", color: "blue" },
      { text: `humanVerified(42): ${tier >= 2 ? "true" : "false"}`, indent: true, color: tier >= 2 ? "green" : "red" },
      ...(tier >= 2 ? [
        { text: "WorldID nullifier: 0x8a3f...valid", indent: true, color: "muted" as const },
        { text: "Human bond verified via ZK proof", color: "green" as const },
      ] : [
        { text: "No World ID bond found", color: "red" as const },
      ]),
    ],
    gate3: hasKyc ? [
      { text: "Confidential HTTP → Stripe", color: "blue" },
      { text: "TEE enclave active", indent: true, color: "muted" },
      { text: "Stripe Identity API...", indent: true },
      { text: "identity_verified: true", indent: true, color: "green" },
      { text: "API credentials never exposed", color: "muted" },
    ] : [
      { text: "Confidential HTTP → Stripe", color: "blue" },
      { text: "Skipped — T3+ required", color: "muted" },
    ],
    gate4: hasCredit ? [
      { text: "Confidential HTTP → Plaid", color: "blue" },
      { text: "TEE enclave active", indent: true, color: "muted" },
      { text: "Plaid Credit API...", indent: true },
      { text: "credit_score: 72", indent: true, color: "green" },
      { text: "score >= 50: true", indent: true, color: "green" },
    ] : [
      { text: "Confidential HTTP → Plaid", color: "blue" },
      { text: "Skipped — T4 required", color: "muted" },
    ],
    don: [
      { text: "DON Consensus", color: "blue" },
      { text: "Node 1  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u2713 signed", indent: true, color: "green" },
      { text: "Node 2  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u2713 signed", indent: true, color: "green" },
      { text: "Node 3  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u2713 signed", indent: true, color: "green" },
      { text: "Quorum: 3/3 reached", color: "green" },
      { text: `Report: {approved: ${!blocked}, tier: ${tier}}`, color: "muted" },
    ],
    ace: [
      { text: "WhitewallConsumer.report()", color: "blue" },
      { text: "Extractor: parsing...", indent: true },
      { text: `  {agentId: 42, approved: ${!blocked}, tier: ${tier}}`, color: "muted" },
      { text: "TieredPolicy — 8 checks:", color: "blue" },
      { text: `  \u2713 1. CRE approved`, indent: true, color: !blocked ? "green" : "red" },
      { text: `  ${!blocked ? "\u2713" : "\u2717"} 2. Tier \u2265 2`, indent: true, color: !blocked ? "green" : "red" },
      { text: `  ${tier >= 1 ? "\u2713" : "\u2717"} 3. Registered`, indent: true, color: tier >= 1 ? "green" : "red" },
      { text: `  ${tier >= 2 ? "\u2713" : "\u2717"} 4. Human verified`, indent: true, color: tier >= 2 ? "green" : "red" },
      { text: `  ${tier >= 2 ? "\u2713" : "\u2717"} 5. World ID valid`, indent: true, color: tier >= 2 ? "green" : "red" },
      { text: `  ${hasKyc ? "\u2713" : "\u2014"} 6. KYC${!hasKyc ? " (N/A)" : ""}`, indent: true, color: hasKyc ? "green" : "muted" },
      { text: `  ${hasCredit ? "\u2713" : "\u2014"} 7. Credit exists${!hasCredit ? " (N/A)" : ""}`, indent: true, color: hasCredit ? "green" : "muted" },
      { text: `  ${hasCredit ? "\u2713" : "\u2014"} 8. Score \u2265 50${!hasCredit ? " (N/A)" : ""}`, indent: true, color: hasCredit ? "green" : "muted" },
    ],
    result: blocked ? [
      { text: "ACCESS DENIED", color: "red" },
      { text: `Tier ${tier} < required Tier 2`, indent: true, color: "red" },
      { text: "Transaction reverted", indent: true, color: "muted" },
      { text: "USDC escrow refunded to agent", color: "muted" },
    ] : [
      { text: "ACCESS GRANTED", color: "green" },
      { text: `Tier: ${tier}`, indent: true, color: "green" },
      { text: "accountableHuman: 0x5472...0603", indent: true },
      { text: `Resource: ${tier >= 4 ? "premium" : tier >= 3 ? "video" : "image"} unlocked`, color: "green" },
      { text: "USDC released to provider", color: "muted" },
    ],
  };
}

/** Pre-computed detail maps for each scenario */
export const NODE_DETAILS: Record<string, NodeDetails> = {
  "idle": makeNodeDetails(0),
  "anon-bot": makeNodeDetails(0),
  "registered-bot": makeNodeDetails(1),
  "verified-agent": makeNodeDetails(2),
  "kyc-agent": makeNodeDetails(3),
  "credit-agent": makeNodeDetails(4),
};
