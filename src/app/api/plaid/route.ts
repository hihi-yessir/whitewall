import { NextRequest, NextResponse } from "next/server";

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_BASE = "https://sandbox.plaid.com";

/**
 * POST /api/plaid
 *   { action: "create-link" } → Plaid Link token
 */

export async function POST(request: NextRequest) {
  if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
    return NextResponse.json({ error: "Plaid credentials not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "create-link") {
      const res = await fetch(`${PLAID_BASE}/link/token/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: PLAID_CLIENT_ID,
          secret: PLAID_SECRET,
          user: { client_user_id: `demo-${Date.now()}` },
          client_name: "Whitewall",
          products: ["assets"],
          country_codes: ["US"],
          language: "en",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        return NextResponse.json({ error: err.error_message || "Plaid API error" }, { status: res.status });
      }

      const data = await res.json();

      return NextResponse.json({
        linkToken: data.link_token,
        expiration: data.expiration,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to process Plaid request" }, { status: 500 });
  }
}
