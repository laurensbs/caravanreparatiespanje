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

/**
 * Fetch all pages of a paginated Holded endpoint.
 * Holded returns ~500 items per page for contacts, less for other endpoints.
 */
export async function holdedFetchAll<T>(
  path: string,
  pageSize = 500,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  while (true) {
    const separator = path.includes("?") ? "&" : "?";
    const batch = await holdedFetch<T[]>(`${path}${separator}page=${page}`);
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    page++;
    if (batch.length < pageSize) break;
  }
  return all;
}
