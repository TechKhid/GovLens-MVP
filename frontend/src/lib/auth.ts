/**
 * auth.ts – JWT token utilities for GovLens MVP
 *
 * The access token is stored in localStorage under `govlens_token`.
 * It is ALSO mirrored to document.cookie so that Next.js Edge Middleware
 * (which cannot read localStorage) can enforce route protection.
 */

export type Role = 'citizen' | 'mp' | 'sysadmin';

export interface TokenPayload {
  sub: string;           // user UUID
  name: string;
  email: string;
  role: Role;
  constituency?: string;
  iat: number;
  exp: number;
}

const TOKEN_KEY = 'govlens_token';
const COOKIE_MAX_AGE = 60 * 60; // 1 hour – matches access token expiry

// ─── Storage helpers ────────────────────────────────────────────────────────

/** Persist the JWT in localStorage AND a first-party cookie for middleware. */
export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  // Cookie used by Edge Middleware (no httpOnly so JS can set it)
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Strict`;
}

/** Read the JWT from localStorage. */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/** Remove the JWT from localStorage and expire the cookie. */
export function clearToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; SameSite=Strict`;
}

// ─── JWT decode (client-side only, no signature verification) ───────────────

/**
 * Decode the base64url-encoded payload of a JWT.
 * Does NOT verify the signature – verification happens on the server.
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // atob requires standard base64; replace URL-safe chars
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const parsed = JSON.parse(json) as TokenPayload;
    // Normalise backend role "admin" → frontend "sysadmin"
    if ((parsed.role as string) === 'admin') {
      parsed.role = 'sysadmin';
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Returns true if the token is present and its `exp` claim is in the future. */
export function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  const payload = decodeToken(token);
  if (!payload) return false;
  return payload.exp * 1000 > Date.now();
}

/** Convenience: decode the currently stored token. */
export function getCurrentUser(): TokenPayload | null {
  const token = getToken();
  if (!isTokenValid(token)) return null;
  return decodeToken(token!);
}
