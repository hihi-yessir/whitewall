const API_BASE = "https://demo-api.whitewall.network/v1";
const API_KEY = process.env.WHITEWALL_GEN_API_KEY;

function authHeaders(): Record<string, string> {
  if (!API_KEY) throw new Error("Missing WHITEWALL_GEN_API_KEY");
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

interface JobResponse {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  poll_url: string;
}

interface JobStatus {
  job_id: string;
  type: "image" | "video";
  status: "queued" | "processing" | "completed" | "failed";
  error?: string;
  artifact_url?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface GenResult {
  buffer: Buffer;
  contentType: string;
}

/** Submit an image generation job. */
async function submitImage(prompt: string): Promise<string> {
  const res = await fetch(`${API_BASE}/gen/image`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ prompt, width: 1024, height: 1024, steps: 30 }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Image submit failed (${res.status})`);
  }
  const data = (await res.json()) as JobResponse;
  return data.job_id;
}

/** Submit a video generation job. */
async function submitVideo(prompt: string): Promise<string> {
  const res = await fetch(`${API_BASE}/gen/video`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      prompt,
      width: 512,
      height: 320,
      frames: 25,
      steps: 20,
      cfg: 4.0,
      fps: 25,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Video submit failed (${res.status})`);
  }
  const data = (await res.json()) as JobResponse;
  return data.job_id;
}

/** Poll a job until completed or failed. */
async function pollJob(
  jobId: string,
  onStatus?: (status: string) => void,
  maxWait = 180_000,
): Promise<JobStatus> {
  const start = Date.now();
  const interval = 3_000;

  while (Date.now() - start < maxWait) {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (!res.ok) throw new Error(`Job poll failed (${res.status})`);

    const data = (await res.json()) as JobStatus;
    onStatus?.(data.status);

    if (data.status === "completed") return data;
    if (data.status === "failed") throw new Error(data.error || "Generation failed");

    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Generation timed out");
}

/** Download artifact as Buffer. */
async function downloadArtifact(jobId: string): Promise<GenResult> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/artifact`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error(`Artifact download failed (${res.status})`);

  const contentType = res.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

/**
 * Generate an image: submit → poll → download.
 * Returns raw buffer + content type.
 */
export async function generateImage(
  prompt: string,
  onStatus?: (status: string) => void,
): Promise<GenResult> {
  const jobId = await submitImage(prompt);
  onStatus?.("queued");
  await pollJob(jobId, onStatus);
  return downloadArtifact(jobId);
}

/**
 * Generate a video: submit → poll → download.
 * Returns raw buffer + content type (animated webp).
 */
export async function generateVideo(
  prompt: string,
  onStatus?: (status: string) => void,
): Promise<GenResult> {
  const jobId = await submitVideo(prompt);
  onStatus?.("queued");
  await pollJob(jobId, onStatus);
  return downloadArtifact(jobId);
}
