import { put } from "@vercel/blob";

/**
 * Upload a base64 image to Vercel Blob and return the public URL.
 */
export async function uploadImage(base64: string, filename: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const blob = await put(filename, buffer, {
    access: "public",
    contentType: "image/png",
  });
  return blob.url;
}
