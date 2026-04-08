const HOLDED_BASE = "https://api.holded.com/api/invoicing/v1";

export class HoldedError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HoldedError";
  }
}

export async function holdedFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const apiKey = process.env.HOLDED_API_KEY;
  if (!apiKey) throw new Error("HOLDED_API_KEY is not configured");

  const res = await fetch(`${HOLDED_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      key: apiKey,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new HoldedError(res.status, `Holded API ${res.status}: ${body}`);
  }

  return res.json();
}

export async function holdedFetchRaw(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const apiKey = process.env.HOLDED_API_KEY;
  if (!apiKey) throw new Error("HOLDED_API_KEY is not configured");

  return fetch(`${HOLDED_BASE}${path}`, {
    ...options,
    headers: {
      key: apiKey,
      ...options?.headers,
    },
  });
}

export function isHoldedConfigured(): boolean {
  return !!process.env.HOLDED_API_KEY;
}
