import type { ApiError as ApiErrorBody, ErrorCode } from '@/protocol/types';

import { API_URL } from './config';

/** A server error code, or `network` when the server could not be reached at all. */
export type RequestErrorCode = ErrorCode | 'network';

export class RequestError extends Error {
  constructor(
    readonly code: RequestErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 8000;

export async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init?.method ?? 'GET',
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    throw new RequestError('network', String(e));
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new RequestError(body?.code ?? 'invalid_input', body?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
