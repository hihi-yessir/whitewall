import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return new Response("Missing url param", { status: 400 });

  // Only allow proxying from the gateway
  const GATEWAY = process.env.X402_GATEWAY_URL || "https://x402-auth-gateway.onrender.com";
  if (!url.startsWith(GATEWAY)) return new Response("Forbidden", { status: 403 });

  const upstream = await fetch(url);
  if (!upstream.ok) return new Response("Upstream error", { status: upstream.status });

  const blob = await upstream.blob();
  const contentType = upstream.headers.get("content-type") || "application/octet-stream";

  return new Response(blob, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
