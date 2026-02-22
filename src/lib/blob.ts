import { put } from "@vercel/blob";

/**
 * Upload a buffer to Vercel Blob and return the public URL.
 */
export async function uploadBuffer(
  buffer: Buffer,
  filename: string,
  contentType = "image/png",
): Promise<string> {
  const blob = await put(filename, buffer, {
    access: "public",
    contentType,
  });
  return blob.url;
}

/**
 * Upload a base64 image to Vercel Blob and return the public URL.
 * @deprecated Use uploadBuffer instead.
 */
export async function uploadImage(base64: string, filename: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  return uploadBuffer(buffer, filename);
}
