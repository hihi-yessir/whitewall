import { NextRequest } from "next/server";

interface SimEvent {
  type: "step" | "terminal" | "result";
  stepId?: string;
  status?: string;
  detail?: string;
  timing?: number;
  tag?: string;
  message?: string;
  termStatus?: string;
  result?: { granted: boolean; accountableHuman?: string; tier?: number; reason?: string };
  skipAfter?: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Shared: common prefix (agent → x402 → gateway → cre) ──

async function* commonPrefix(mult: number): AsyncGenerator<SimEvent> {
  yield { type: "step", stepId: "agent", status: "active" };
  await delay(300 * mult);
  yield { type: "step", stepId: "agent", status: "pass", detail: "Request sent" };

  yield { type: "step", stepId: "x402", status: "active" };
  yield { type: "terminal", tag: "x402", message: "Payment hold: $0.50 USDC via x402 protocol", termStatus: "info" };
  await delay(400 * mult);
  yield { type: "step", stepId: "x402", status: "pass", detail: "$0.50 held", timing: 400 };
  yield { type: "terminal", tag: "x402", message: "Payment hold authorized", termStatus: "pass" };

  yield { type: "step", stepId: "gateway", status: "active" };
  yield { type: "terminal", tag: "GW", message: "HTTP request received, extracting agent metadata", termStatus: "info" };
  await delay(300 * mult);
  yield { type: "step", stepId: "gateway", status: "pass", detail: "JWT valid", timing: 300 };
  yield { type: "terminal", tag: "GW", message: "JWT verified, forwarding to CRE", termStatus: "pass" };

  yield { type: "step", stepId: "cre", status: "active" };
  yield { type: "terminal", tag: "CRE", message: "HTTP Trigger received, initiating 4-gate pipeline", termStatus: "info" };
  await delay(500 * mult);
  yield { type: "step", stepId: "cre", status: "pass", detail: "Pipeline started", timing: 500 };
  yield { type: "terminal", tag: "CRE", message: "Pipeline initialized", termStatus: "pass" };
}

// ── Shared: Gate 1 pass ──

async function* gate1Pass(mult: number): AsyncGenerator<SimEvent> {
  yield { type: "step", stepId: "gate1", status: "active" };
  yield { type: "terminal", tag: "GATE 1", message: "Identity: ownerOf(42) -> ...", termStatus: "info" };
  await delay(600 * mult);
  yield { type: "step", stepId: "gate1", status: "pass", detail: "ownerOf(42) -> Alice", timing: 600 };
  yield { type: "terminal", tag: "GATE 1", message: "Identity: ownerOf(42) -> 0xAl1c3...cafe (registered)", termStatus: "pass" };
}

// ── Shared: Gate 2 pass ──

async function* gate2Pass(mult: number): AsyncGenerator<SimEvent> {
  yield { type: "step", stepId: "gate2", status: "active" };
  yield { type: "terminal", tag: "GATE 2", message: "Human: isHumanVerified(42) via WorldIDValidator", termStatus: "info" };
  await delay(600 * mult);
  yield { type: "step", stepId: "gate2", status: "pass", detail: "Human verified", timing: 600 };
  yield { type: "terminal", tag: "GATE 2", message: "Human: isHumanVerified(42) -> true -- human bond active", termStatus: "pass" };
}

// ── Shared: DON consensus ──

async function* donConsensus(mult: number): AsyncGenerator<SimEvent> {
  yield { type: "step", stepId: "don", status: "active" };
  yield { type: "terminal", tag: "DON", message: "Submitting verification report to DON consensus...", termStatus: "info" };
  await delay(800 * mult);
  yield { type: "terminal", tag: "DON", message: "Node 1/3 signed report", termStatus: "info" };
  await delay(400 * mult);
  yield { type: "terminal", tag: "DON", message: "Node 2/3 signed report", termStatus: "info" };
  await delay(300 * mult);
  yield { type: "terminal", tag: "DON", message: "Node 3/3 signed report -- consensus reached", termStatus: "pass" };
  yield { type: "step", stepId: "don", status: "pass", detail: "3/3 consensus", timing: 1500 };
}

// ── Act 1: Anonymous Bot — fails at Gate 1 (Identity) ──

async function* anonBotScenario(presentMode: boolean): AsyncGenerator<SimEvent> {
  const mult = presentMode ? 1.8 : 1;

  yield { type: "terminal", tag: "x402", message: "Payment hold: $0.50 USDC", termStatus: "info" };
  yield* commonPrefix(mult);

  yield { type: "step", stepId: "gate1", status: "active" };
  yield { type: "terminal", tag: "GATE 1", message: "Identity check: ownerOf(agentId) -> ...", termStatus: "info" };
  await delay(600 * mult);
  yield { type: "step", stepId: "gate1", status: "fail", detail: "NOT REGISTERED", timing: 600 };
  yield { type: "terminal", tag: "GATE 1", message: "Identity: ownerOf(agentId) -> 0x0000...0000 (unregistered)", termStatus: "fail" };
  yield { type: "terminal", tag: "CRE", message: "Pipeline HALTED at Gate 1 -- agent not registered", termStatus: "fail" };

  yield { type: "skipAfter" as any, skipAfter: "gate1" } as any;
  await delay(200 * mult);

  yield { type: "terminal", tag: "x402", message: "$0.50 USDC refunded to agent wallet", termStatus: "warn" };
  yield { type: "result", result: { granted: false, reason: "Agent not registered (no ERC-8004 identity)" } };
}

// ── Act 2: Registered Bot — fails at Gate 2 (Human) ──

async function* registeredBotScenario(presentMode: boolean): AsyncGenerator<SimEvent> {
  const mult = presentMode ? 1.8 : 1;

  yield* commonPrefix(mult);
  yield* gate1Pass(mult);

  yield { type: "step", stepId: "gate2", status: "active" };
  yield { type: "terminal", tag: "GATE 2", message: "Human: isHumanVerified(42) via WorldIDValidator", termStatus: "info" };
  await delay(600 * mult);
  yield { type: "step", stepId: "gate2", status: "fail", detail: "NOT VERIFIED", timing: 600 };
  yield { type: "terminal", tag: "GATE 2", message: "Human: isHumanVerified(42) -> false -- no human bond", termStatus: "fail" };
  yield { type: "terminal", tag: "CRE", message: "Pipeline HALTED at Gate 2 -- agent not human-verified", termStatus: "fail" };

  yield { type: "skipAfter" as any, skipAfter: "gate2" } as any;
  await delay(200 * mult);

  yield { type: "terminal", tag: "x402", message: "$0.50 USDC refunded to agent wallet", termStatus: "warn" };
  yield { type: "result", result: { granted: false, reason: "Agent not human-verified (no World ID bond)" } };
}

// ── Act 3: Verified Agent — passes G1+G2, skips G3+G4 → Image gen (Tier 2) ──

async function* verifiedAgentScenario(presentMode: boolean): AsyncGenerator<SimEvent> {
  const mult = presentMode ? 1.8 : 1;

  yield* commonPrefix(mult);
  yield* gate1Pass(mult);
  yield* gate2Pass(mult);

  // Gate 3 — KYC not required for Tier 2, skip
  yield { type: "step", stepId: "gate3", status: "active" };
  yield { type: "terminal", tag: "GATE 3", message: "KYC: not required for Tier 2 request, skipping", termStatus: "info" };
  await delay(200 * mult);
  yield { type: "step", stepId: "gate3", status: "pass", detail: "Not required", timing: 200 };

  // Gate 4 — Credit not required for Tier 2, skip
  yield { type: "step", stepId: "gate4", status: "active" };
  yield { type: "terminal", tag: "GATE 4", message: "Credit: not required for Tier 2 request, skipping", termStatus: "info" };
  await delay(200 * mult);
  yield { type: "step", stepId: "gate4", status: "pass", detail: "Not required", timing: 200 };

  yield* donConsensus(mult);

  // ACE
  yield { type: "step", stepId: "ace", status: "active" };
  yield { type: "terminal", tag: "ACE", message: "Executing TieredPolicy.runPolicy(42)...", termStatus: "info" };
  await delay(600 * mult);
  yield { type: "step", stepId: "ace", status: "pass", detail: "Policy approved", timing: 600 };
  yield { type: "terminal", tag: "ACE", message: "Policy executed -- AccessGranted(42, 0xAl1c3, tier=2)", termStatus: "pass" };

  // Result
  yield { type: "step", stepId: "result", status: "active" };
  await delay(200 * mult);
  yield { type: "step", stepId: "result", status: "pass", detail: "Tier 2: Image Gen" };
  yield { type: "terminal", tag: "RESULT", message: "Access GRANTED. Tier 2 -> Image generation unlocked", termStatus: "pass" };
  yield { type: "terminal", tag: "x402", message: "$0.50 USDC payment finalized", termStatus: "pass" };

  yield { type: "result", result: { granted: true, accountableHuman: "0xAl1c3000000000000000000000000000000cafe", tier: 2 } };
}

// ── Shared: Gate 3 pass (KYC via Confidential HTTP) ──

async function* gate3Pass(mult: number): AsyncGenerator<SimEvent> {
  yield { type: "step", stepId: "gate3", status: "active" };
  yield { type: "terminal", tag: "GATE 3", message: "KYC: Stripe Identity via Confidential HTTP", termStatus: "info" };
  await delay(400 * mult);
  yield { type: "terminal", tag: "CRE", message: "TEE enclave initialized — secrets isolated from DON nodes", termStatus: "info" };
  await delay(300 * mult);
  yield { type: "terminal", tag: "CRE", message: "Loading STRIPE_SECRET_KEY from DON vault (never exposed to nodes)", termStatus: "info" };
  await delay(300 * mult);
  yield { type: "terminal", tag: "CRE", message: "Calling Stripe API inside enclave: GET /v1/identity/verification_sessions/vs_1N...", termStatus: "info" };
  await delay(500 * mult);
  yield { type: "terminal", tag: "CRE", message: "Response AES-GCM encrypted end-to-end", termStatus: "info" };
  await delay(200 * mult);
  yield { type: "terminal", tag: "GATE 3", message: 'status="verified" -> KYC passed', termStatus: "pass" };
  yield { type: "step", stepId: "gate3", status: "pass", detail: "KYC verified", timing: 1700 };
}

// ── Shared: Gate 4 pass (Credit via Confidential HTTP) ──

async function* gate4Pass(mult: number): AsyncGenerator<SimEvent> {
  yield { type: "step", stepId: "gate4", status: "active" };
  yield { type: "terminal", tag: "GATE 4", message: "Credit: Plaid via Confidential HTTP", termStatus: "info" };
  await delay(400 * mult);
  yield { type: "terminal", tag: "CRE", message: "Loading PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ACCESS_TOKEN from DON vault", termStatus: "info" };
  await delay(300 * mult);
  yield { type: "terminal", tag: "CRE", message: "Calling Plaid API inside enclave: POST /accounts/balance/get", termStatus: "info" };
  await delay(600 * mult);
  yield { type: "terminal", tag: "CRE", message: "Response AES-GCM encrypted end-to-end", termStatus: "info" };
  await delay(200 * mult);
  yield { type: "terminal", tag: "GATE 4", message: "12 accounts -> score: 95/100 -> Credit passed", termStatus: "pass" };
  yield { type: "step", stepId: "gate4", status: "pass", detail: "Score: 95/100", timing: 1500 };
}

// ── Act 4: KYC Agent — passes G1+G2+G3, skips G4 → Video gen (Tier 3) ──

async function* kycAgentScenario(presentMode: boolean): AsyncGenerator<SimEvent> {
  const mult = presentMode ? 1.8 : 1;

  yield* commonPrefix(mult);
  yield* gate1Pass(mult);
  yield* gate2Pass(mult);
  yield* gate3Pass(mult);

  // Gate 4 — Credit not required for Tier 3, skip
  yield { type: "step", stepId: "gate4", status: "active" };
  yield { type: "terminal", tag: "GATE 4", message: "Credit: not required for Tier 3 request, skipping", termStatus: "info" };
  await delay(200 * mult);
  yield { type: "step", stepId: "gate4", status: "pass", detail: "Not required", timing: 200 };

  yield* donConsensus(mult);

  // ACE
  yield { type: "step", stepId: "ace", status: "active" };
  yield { type: "terminal", tag: "ACE", message: "Executing TieredPolicy.runPolicy(42)...", termStatus: "info" };
  await delay(600 * mult);
  yield { type: "terminal", tag: "ACE", message: "6 checks passed: CRE + tier + identity + human + worldID + KYC", termStatus: "info" };
  yield { type: "step", stepId: "ace", status: "pass", detail: "Policy approved", timing: 600 };
  yield { type: "terminal", tag: "ACE", message: "Policy executed -- AccessGranted(42, 0xAl1c3, tier=3)", termStatus: "pass" };

  // Result
  yield { type: "step", stepId: "result", status: "active" };
  await delay(200 * mult);
  yield { type: "step", stepId: "result", status: "pass", detail: "Tier 3: Video Gen" };
  yield { type: "terminal", tag: "RESULT", message: "Access GRANTED. Tier 3 -> Video generation unlocked", termStatus: "pass" };
  yield { type: "terminal", tag: "x402", message: "$1.00 USDC payment finalized", termStatus: "pass" };

  yield { type: "result", result: { granted: true, accountableHuman: "0xAl1c3000000000000000000000000000000cafe", tier: 3 } };
}

// ── Act 5: Credit Agent — passes all 4 gates → Premium gen (Tier 4) ──

async function* creditAgentScenario(presentMode: boolean): AsyncGenerator<SimEvent> {
  const mult = presentMode ? 1.8 : 1;

  yield* commonPrefix(mult);
  yield* gate1Pass(mult);
  yield* gate2Pass(mult);
  yield* gate3Pass(mult);
  yield* gate4Pass(mult);

  yield* donConsensus(mult);

  // ACE
  yield { type: "step", stepId: "ace", status: "active" };
  yield { type: "terminal", tag: "ACE", message: "Executing TieredPolicy.runPolicy(42)...", termStatus: "info" };
  await delay(600 * mult);
  yield { type: "terminal", tag: "ACE", message: "8 checks passed: CRE + tier + identity + human + worldID + KYC + hasCredit + score>=50", termStatus: "info" };
  yield { type: "step", stepId: "ace", status: "pass", detail: "Policy approved", timing: 600 };
  yield { type: "terminal", tag: "ACE", message: "Policy executed -- AccessGranted(42, 0xAl1c3, tier=4)", termStatus: "pass" };

  // Result
  yield { type: "step", stepId: "result", status: "active" };
  await delay(200 * mult);
  yield { type: "step", stepId: "result", status: "pass", detail: "Tier 4: Premium" };
  yield { type: "terminal", tag: "RESULT", message: "Access GRANTED. Tier 4 -> Premium/unrestricted generation unlocked", termStatus: "pass" };
  yield { type: "terminal", tag: "x402", message: "$2.00 USDC payment finalized", termStatus: "pass" };

  yield { type: "result", result: { granted: true, accountableHuman: "0xAl1c3000000000000000000000000000000cafe", tier: 4 } };
}

export async function GET(request: NextRequest) {
  const scenario = request.nextUrl.searchParams.get("scenario") || "anon-bot";
  const presentMode = request.nextUrl.searchParams.get("mode") === "present";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const generator =
        scenario === "registered-bot" ? registeredBotScenario(presentMode) :
        scenario === "verified-agent" ? verifiedAgentScenario(presentMode) :
        scenario === "kyc-agent" ? kycAgentScenario(presentMode) :
        scenario === "credit-agent" ? creditAgentScenario(presentMode) :
        anonBotScenario(presentMode);

      try {
        for await (const event of generator) {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }
        controller.enqueue(encoder.encode("data: {\"type\":\"done\"}\n\n"));
      } catch {
        controller.enqueue(encoder.encode("data: {\"type\":\"error\"}\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
