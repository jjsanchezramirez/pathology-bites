// src/shared/utils/api/fetcher.ts
// Standard JSON fetcher for useSWR call sites. Throws a typed error on
// non-2xx responses (SWR surfaces it via the hook's `error`).

export class FetchError extends Error {
  status: number;
  info: unknown;

  constructor(message: string, status: number, info?: unknown) {
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.info = info;
  }
}

export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);

  if (!res.ok) {
    const info = await res.json().catch(() => undefined);
    const message =
      (info as { error?: string } | undefined)?.error || `Request failed with status ${res.status}`;
    throw new FetchError(message, res.status, info);
  }

  return res.json();
}
