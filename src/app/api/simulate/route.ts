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

async function* anonBotScenario(presentMode: boolean): AsyncGenerator<SimEvent> {
  const mult = presentMode ? 1.8 : 1;

  yield { type: "terminal", tag: "x402", message: "Payment hold: $0.50 USDC", termStatus: "info" };
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
  yield { type: "terminal", tag: "CRE", message: "Pipeline initialized, starting Gate 1", termStatus: "pass" };

  yield { type: "step", stepId: "gate1", status: "active" };
  yield { type: "terminal", tag: "GATE 1", message: "Identity check: ownerOf(agentId) -> ...", termStatus: "info" };
  await delay(600 * mult);
  yield { type: "step", stepId: "gate1", status: "fail", detail: "NOT REGISTERED", timing: 600 };
  yield { type: "terminal", tag: "GATE 1", message: "Identity: ownerOf(agentId) -> 0x0000...0000 (unregistered)", termStatus: "fail" };
  yield { type: "step", stepId: "gate1", status: "fail" };
  yield { type: "terminal", tag: "CRE", message: "Pipeline HALTED at Gate 1 -- agent not registered", termStatus: "fail" };

  yield { type: "skipAfter" as any, skipAfter: "gate1" } as any;
  await delay(200 * mult);

  yield { type: "terminal", tag: "x402", message: "$0.50 USDC refunded to agent wallet", termStatus: "warn" };
  yield { type: "result", result: { granted: false, reason: "Agent not registered (no ERC-8004 identity)" } };
}

async function* registeredBotScenario(presentMode: boolean): AsyncGenerator<SimEvent> {
  const mult = presentMode ? 1.8 : 1;

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

  yield { type: "step", stepId: "gate1", status: "active" };
  yield { type: "terminal", tag: "GATE 1", message: "Identity: ownerOf(42) -> ...", termStatus: "info" };
  await delay(600 * mult);
  yield { type: "step", stepId: "gate1", status: "pass", detail: "ownerOf(42) -> Alice", timing: 600 };
  yield { type: "terminal", tag: "GATE 1", message: "Identity: ownerOf(42) -> 0xAlice (registered)", termStatus: "pass" };

  yield { type: "step", stepId: "gate2", status: "active" };
  yield { type: "terminal", tag: "GATE 2", message: "Verification: getSummary(42, [WorldID], HUMAN_VERIFIED)", termStatus: "info" };
  await delay(600 * mult);
  yield { type: "step", stepId: "gate2", status: "fail", detail: "NOT VERIFIED", timing: 600 };
  yield { type: "terminal", tag: "GATE 2", message: "Verification: count=0, avgScore=0 -- no human bond", termStatus: "fail" };
  yield { type: "terminal", tag: "CRE", message: "Pipeline HALTED at Gate 2 -- agent not human-verified", termStatus: "fail" };

  yield { type: "skipAfter" as any, skipAfter: "gate2" } as any;
  await delay(200 * mult);

  yield { type: "terminal", tag: "x402", message: "$0.50 USDC refunded to agent wallet", termStatus: "warn" };
  yield { type: "result", result: { granted: false, reason: "Agent not human-verified (no World ID bond)" } };
}

async function* verifiedAgentScenario(presentMode: boolean): AsyncGenerator<SimEvent> {
  const mult = presentMode ? 1.8 : 1;

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

  // Gate 1
  yield { type: "step", stepId: "gate1", status: "active" };
  yield { type: "terminal", tag: "GATE 1", message: "Identity: ownerOf(42) -> ...", termStatus: "info" };
  await delay(600 * mult);
  yield { type: "step", stepId: "gate1", status: "pass", detail: "ownerOf(42) -> Alice", timing: 600 };
  yield { type: "terminal", tag: "GATE 1", message: "Identity: ownerOf(42) -> 0xAl1c3...cafe (registered)", termStatus: "pass" };

  // Gate 2
  yield { type: "step", stepId: "gate2", status: "active" };
  yield { type: "terminal", tag: "GATE 2", message: "Verification: getSummary(42, [WorldID], HUMAN_VERIFIED)", termStatus: "info" };
  await delay(600 * mult);
  yield { type: "step", stepId: "gate2", status: "pass", detail: "Human verified", timing: 600 };
  yield { type: "terminal", tag: "GATE 2", message: "Verification: count=1, avgScore=2 -- human bond active", termStatus: "pass" };

  // Gate 3
  yield { type: "step", stepId: "gate3", status: "active" };
  yield { type: "terminal", tag: "GATE 3", message: "Liveness: checking verification TTL...", termStatus: "info" };
  await delay(600 * mult);
  yield { type: "step", stepId: "gate3", status: "pass", detail: "TTL valid", timing: 600 };
  yield { type: "terminal", tag: "GATE 3", message: "Liveness: verification valid, expires in 29d", termStatus: "pass" };

  // Gate 4
  yield { type: "step", stepId: "gate4", status: "active" };
  yield { type: "terminal", tag: "GATE 4", message: "Reputation: checking tier >= required...", termStatus: "info" };
  await delay(600 * mult);
  yield { type: "step", stepId: "gate4", status: "pass", detail: "Tier 2 >= 2", timing: 600 };
  yield { type: "terminal", tag: "GATE 4", message: "Reputation: tier 2 >= requiredTier 2", termStatus: "pass" };

  // DON
  yield { type: "step", stepId: "don", status: "active" };
  yield { type: "terminal", tag: "DON", message: "Submitting verification report to DON consensus...", termStatus: "info" };
  await delay(800 * mult);
  yield { type: "terminal", tag: "DON", message: "Node 1/3 signed report", termStatus: "info" };
  await delay(400 * mult);
  yield { type: "terminal", tag: "DON", message: "Node 2/3 signed report", termStatus: "info" };
  await delay(300 * mult);
  yield { type: "terminal", tag: "DON", message: "Node 3/3 signed report -- consensus reached", termStatus: "pass" };
  yield { type: "step", stepId: "don", status: "pass", detail: "3/3 consensus", timing: 1500 };

  // ACE
  yield { type: "step", stepId: "ace", status: "active" };
  yield { type: "terminal", tag: "ACE", message: "Executing HumanVerifiedPolicy.runPolicy(42)...", termStatus: "info" };
  await delay(600 * mult);
  yield { type: "step", stepId: "ace", status: "pass", detail: "Policy approved", timing: 600 };
  yield { type: "terminal", tag: "ACE", message: "Policy executed -- AccessGranted(42, 0xAl1c3, tier=2)", termStatus: "pass" };

  // Result
  yield { type: "step", stepId: "result", status: "active" };
  await delay(200 * mult);
  yield { type: "step", stepId: "result", status: "pass", detail: "Granted" };
  yield { type: "terminal", tag: "RESULT", message: "Access GRANTED. accountableHuman: 0xAl1c3...cafe, tier: 2", termStatus: "pass" };
  yield { type: "terminal", tag: "x402", message: "$0.50 USDC payment finalized", termStatus: "pass" };

  yield { type: "result", result: { granted: true, accountableHuman: "0xAl1c3000000000000000000000000000000cafe", tier: 2 } };
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
