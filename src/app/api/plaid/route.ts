import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/plaid — Create Plaid Link token or exchange public token
 *
 * Actions:
 *   { action: "create-link", agentId } → returns link_token
 *   { action: "exchange", publicToken } → returns access_token (stored server-side)
 *
 * In production, these would call Plaid API.
 * In sandbox/demo mode, we simulate the response.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "create-link") {
      const { agentId } = body;
      if (!agentId) {
        return NextResponse.json({ error: "agentId required" }, { status: 400 });
      }

      // Sandbox: simulate Plaid Link token
      return NextResponse.json({
        linkToken: `link-sandbox-${agentId}-${Date.now()}`,
        expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
    }

    if (action === "exchange") {
      const { publicToken } = body;
      if (!publicToken) {
        return NextResponse.json({ error: "publicToken required" }, { status: 400 });
      }

      // Sandbox: simulate token exchange
      // In production, this stores the access_token in DON vault
      return NextResponse.json({
        success: true,
        accountsConnected: 3,
        institutionName: "Chase",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to process Plaid request" }, { status: 500 });
  }
}
