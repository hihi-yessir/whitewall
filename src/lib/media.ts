const GATEWAY = process.env.NEXT_PUBLIC_X402_GATEWAY_URL || "https://x402-auth-gateway.onrender.com";

/**
 * Rewrite gateway artifact URLs to go through /api/proxy-media
 * so the browser never directly fetches from the gateway domain
 * (avoids DNS-level blocks like Cisco Umbrella).
 */
export function proxyMedia(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith(GATEWAY)) {
    return `/api/proxy-media?url=${encodeURIComponent(url)}`;
  }
  return url;
}
