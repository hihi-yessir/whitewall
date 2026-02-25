import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/kyc — Create a Stripe Identity verification session (sandbox)
 * GET  /api/kyc?sessionId=vs_... — Check session status
 *
 * In production, these would call Stripe Identity API.
 * In sandbox/demo mode, we simulate the response.
 */

export async function POST(request: NextRequest) {
  try {
    const { agentId } = await request.json();

    if (!agentId) {
      return NextResponse.json({ error: "agentId required" }, { status: 400 });
    }

    // Sandbox: simulate Stripe Identity session creation
    const sessionId = `vs_sandbox_${agentId}_${Date.now()}`;

    return NextResponse.json({
      sessionId,
      url: `https://verify.stripe.com/start/${sessionId}`,
      status: "requires_input",
    });
  } catch {
    return NextResponse.json({ error: "Failed to create KYC session" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  // Sandbox: all sessions auto-verify after creation
  return NextResponse.json({
    sessionId,
    status: "verified",
    type: "document",
    lastVerificationReport: {
      documentType: "id_card",
      issuingCountry: "US",
    },
  });
}
