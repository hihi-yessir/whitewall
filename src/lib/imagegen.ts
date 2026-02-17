import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const key = process.env.GOOGLE_AI_API_KEY;
    if (!key) throw new Error("Missing GOOGLE_AI_API_KEY");
    client = new GoogleGenAI({ apiKey: key });
  }
  return client;
}

export interface ImageGenResult {
  base64: string;
  mimeType: string;
}

/**
 * Generate an image from a text prompt.
 * Provider-agnostic wrapper — currently uses Google Imagen via Gemini API.
 * Swap internals to Together AI / Replicate if needed.
 */
export async function generateImage(prompt: string): Promise<ImageGenResult> {
  const ai = getClient();

  const response = await ai.models.generateImages({
    model: "imagen-4.0-fast-generate-001",
    prompt,
    config: {
      numberOfImages: 1,
    },
  });

  const image = response.generatedImages?.[0];
  if (!image?.image?.imageBytes) {
    throw new Error("No image returned from Imagen");
  }

  return {
    base64: image.image.imageBytes,
    mimeType: "image/png",
  };
}
