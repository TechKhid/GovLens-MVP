/**
 * api.ts – Authenticated fetch wrapper for GovLens MVP
 *
 * Automatically attaches the JWT Authorization header.
 * On 401 (token expired), attempts a token refresh and retries once.
 */

import { getToken, setToken, clearToken } from './auth';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

// ─── Core request helper ─────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const token = getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // Attempt silent token refresh on 401 (excluding auth endpoints themselves)
  const isAuthEndpoint = path.includes('/auth/login') || path.includes('/auth/register');
  if (res.status === 401 && retry && !isAuthEndpoint) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, options, false);
    // Refresh failed – clear credentials; page will be redirected by middleware
    clearToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const text = await res.text();
    let body: any = {};
    try {
      body = JSON.parse(text);
    } catch {
      // It's just plain text (like the Go http.Error responses)
      body = text;
    }
    
    let message = `HTTP ${res.status}`;
    if (typeof body === 'string' && body.trim() !== '') {
      message = body.trim();
    } else if (body && typeof body === 'object' && body.message) {
      message = body.message;
    }
    
    throw new Error(message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

/** POST /auth/refresh – expects the httpOnly refresh_token cookie to be sent. */
async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // sends the httpOnly cookie
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { access_token: string };
    setToken(data.access_token);
    return true;
  } catch {
    return false;
  }
}

// ─── Exported API methods ────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string) =>
    request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};
