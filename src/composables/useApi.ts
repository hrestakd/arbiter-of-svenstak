/**
 * Tiny fetch wrapper that throws structured errors and sends/receives JSON.
 *
 * All requests are same-origin (Vercel serves /api/* from the same host).
 * Cookies ride automatically — no auth headers to set.
 */

export interface ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
}

function buildError(status: number, body: unknown): ApiError {
  const b = (body ?? {}) as { code?: string; message?: string; details?: unknown };
  const err = new Error(b.message ?? `HTTP ${status}`) as ApiError;
  err.status = status;
  err.code = b.code ?? 'HTTP_ERROR';
  err.details = b.details;
  return err;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };
  const res = await fetch(path, init);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const parsed = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) throw buildError(res.status, parsed);
  return parsed as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

export function useApi() {
  return api;
}
