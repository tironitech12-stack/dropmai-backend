import type { Response } from 'express';
import { DEMO_USER, SESSION_COOKIE, type SessionUser } from './auth.types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 254;
}

export function sessionUserFromEmail(
  email: string,
  name?: string,
): SessionUser {
  const local = email.split('@')[0] || 'vendedor';
  return {
    id: `user-${Buffer.from(email).toString('base64url').slice(0, 16)}`,
    email,
    name: (name ?? '').trim() || local,
  };
}

export function setSessionCookie(res: Response, user: SessionUser) {
  // Stub: cookie value "demo" keeps AuthGuard happy; email is in response body.
  // Future: encode JWT / signed session with user id.
  void user;
  res.cookie(SESSION_COOKIE, 'demo', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14 * 1000,
    secure: process.env.NODE_ENV === 'production',
  });
}

export function demoFallbackUser(): SessionUser {
  return { ...DEMO_USER };
}
