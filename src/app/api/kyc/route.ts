import { NextRequest, NextResponse } from "next/server";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

/**
 * POST /api/kyc — Create a Stripe Identity VerificationSession (sandbox)
 * GET  /api/kyc?sessionId=vs_... — Check session status
 */

export async function POST() {
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY not configured" }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.stripe.com/v1/identity/verification_sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ type: "document" }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message || "Stripe API error" }, { status: res.status });
    }

    const session = await res.json();

    return NextResponse.json({
      sessionId: session.id,
      clientSecret: session.client_secret,
      status: session.status,
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

  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.stripe.com/v1/identity/verification_sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message || "Stripe API error" }, { status: res.status });
    }

    const session = await res.json();

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
    });
  } catch {
    return NextResponse.json({ error: "Failed to check KYC status" }, { status: 500 });
  }
}
