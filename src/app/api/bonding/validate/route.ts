import { NextRequest, NextResponse } from "next/server";
import { keccak256, encodePacked } from "viem";
import { getRedis } from "@/lib/redis";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;

/**
 * POST /api/bonding/validate
 *
 * Creates a validation request after Stripe/Plaid verification.
 * Stores in Redis for CRE to pick up and write on-chain.
 *
 * Body:
 *   { type: "kyc", agentId, sessionId }
 *   { type: "credit", agentId, publicToken }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, agentId } = body;

    if (!agentId) {
      return NextResponse.json({ error: "agentId required" }, { status: 400 });
    }

    if (type === "kyc") {
      return handleKYC(body.sessionId, agentId);
    }

    if (type === "credit") {
      return handleCredit(body.publicToken, agentId);
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (e) {
    console.error("Bonding validate error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function handleKYC(sessionId: string, agentId: string) {
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY not configured" }, { status: 500 });
  }

  // 1. Verify session status with Stripe
  const res = await fetch(
    `https://api.stripe.com/v1/identity/verification_sessions/${sessionId}`,
    { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to verify session with Stripe" }, { status: 400 });
  }

  const session = await res.json();
  const verified = session.status === "verified";

  // 2. Compute request hash (same scheme as on-chain)
  const sessionHash = keccak256(encodePacked(["string"], [sessionId]));
  const requestHash = keccak256(
    encodePacked(["string", "uint256", "bytes32"], ["KYC", BigInt(agentId), sessionHash])
  );

  // 3. Store validation request in Redis for CRE pickup
  const redis = getRedis();
  await redis.hset(`bonding:kyc:${agentId}`, {
    sessionId,
    sessionHash,
    requestHash,
    verified,
    status: verified ? "pending_cre" : "not_verified",
    createdAt: Date.now(),
  });

  // Also add to CRE queue
  if (verified) {
    await redis.lpush("cre:queue:kyc", JSON.stringify({
      agentId,
      sessionId,
      sessionHash,
      requestHash,
      timestamp: Date.now(),
    }));
  }

  return NextResponse.json({
    requestHash,
    sessionHash,
    verified,
    status: verified ? "pending_cre" : "not_verified",
    // Explain what happens next
    next: verified
      ? "CRE will verify with Stripe → call StripeKYCValidator.onReport() on-chain"
      : "Session not verified yet — complete the Stripe Identity flow first",
  });
}

async function handleCredit(publicToken: string, agentId: string) {
  if (!publicToken) {
    return NextResponse.json({ error: "publicToken required" }, { status: 400 });
  }

  if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
    return NextResponse.json({ error: "Plaid credentials not configured" }, { status: 500 });
  }

  // 1. Exchange public token for access token (server-side only)
  const exchangeRes = await fetch("https://sandbox.plaid.com/item/public_token/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      public_token: publicToken,
    }),
  });

  if (!exchangeRes.ok) {
    return NextResponse.json({ error: "Failed to exchange Plaid token" }, { status: 400 });
  }

  const exchangeData = await exchangeRes.json();
  const accessToken = exchangeData.access_token;
  const itemId = exchangeData.item_id;

  // 2. Compute hashes
  const dataHash = keccak256(encodePacked(["string"], [itemId]));
  const requestHash = keccak256(
    encodePacked(["string", "uint256", "bytes32"], ["CREDIT", BigInt(agentId), dataHash])
  );

  // 3. Store in Redis — access_token stays server-side (never exposed)
  const redis = getRedis();
  await redis.hset(`bonding:credit:${agentId}`, {
    itemId,
    dataHash,
    requestHash,
    accessToken, // encrypted in production — TEE-only
    status: "pending_cre",
    createdAt: Date.now(),
  });

  // Add to CRE queue
  await redis.lpush("cre:queue:credit", JSON.stringify({
    agentId,
    itemId,
    dataHash,
    requestHash,
    accessToken,
    timestamp: Date.now(),
  }));

  return NextResponse.json({
    requestHash,
    dataHash,
    itemId,
    status: "pending_cre",
    next: "CRE will fetch asset report via Plaid → compute score → call PlaidCreditValidator.onReport() on-chain",
  });
}
