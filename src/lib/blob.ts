import { put } from "@vercel/blob";

/**
 * Download a URL and re-upload to Vercel Blob for permanent, CDN-backed storage.
 * Returns the public Blob URL.
 */
export async function uploadFromUrl(sourceUrl: string, filename: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Failed to fetch artifact: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "application/octet-stream";

  const blob = await put(filename, buffer, {
    access: "public",
    contentType,
  });
  return blob.url;
}
