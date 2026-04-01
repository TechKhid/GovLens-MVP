/**
 * Next.js Edge Middleware – Route protection for GovLens MVP.
 *
 * Reads the `govlens_token` cookie (set by AuthContext on login alongside
 * localStorage) and enforces role-based access before the page renders.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ─── Route config ─────────────────────────────────────────────────────────────

/** Routes that don't require authentication */
const PUBLIC_ROUTES = ['/login', '/api/auth'];

/** Routes accessible only to mp or sysadmin — note the trailing slash to avoid matching /mp-profile */
const MP_ROUTES = ['/mp/'];

/** Routes accessible only to sysadmin */
const ADMIN_ROUTES = ['/admin'];

// ─── JWT decode (Edge-safe, no crypto) ────────────────────────────────────────

interface TokenPayload {
  sub: string;
  role: 'citizen' | 'mp' | 'sysadmin';
  exp: number;
}

function decodeJwt(token: string): TokenPayload | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
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

function isExpired(payload: TokenPayload): boolean {
  return payload.exp * 1000 < Date.now();
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and static assets unconditionally
  if (
    PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('govlens_token')?.value ?? null;
  const payload = token ? decodeJwt(token) : null;

  // No valid token → redirect to login
  if (!payload || isExpired(payload)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  const { role } = payload;

  // Admin-only routes
  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r)) && role !== 'sysadmin') {
    return NextResponse.redirect(
      new URL(role === 'mp' ? '/mp/dashboard' : '/', request.url)
    );
  }

  // MP-only routes
  if (MP_ROUTES.some((r) => pathname.startsWith(r)) && role === 'citizen') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
