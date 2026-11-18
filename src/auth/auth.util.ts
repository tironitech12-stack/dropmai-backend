import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import type { Response } from 'express';
import { DEMO_USER, SESSION_COOKIE, type SessionUser } from './auth.types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_TTL_MS = 60 * 60 * 24 * 14 * 1000;

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

export function toSessionUser(user: {
  id: string;
  email: string;
  name?: string | null;
}): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: (user.name ?? '').trim() || user.email.split('@')[0] || 'vendedor',
  };
}

function sessionSecret(): string {
  return (
    process.env.SESSION_SECRET?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    'dropmai-dev-session-secret'
  );
}

type SessionPayload = SessionUser & { exp: number; v: 1 };

export function encodeSession(user: SessionUser): string {
  const payload: SessionPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    exp: Date.now() + SESSION_TTL_MS,
    v: 1,
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
  const sig = createHmac('sha256', sessionSecret())
    .update(body)
    .digest('base64url');
  return `dm1.${body}.${sig}`;
}

export function decodeSession(raw: string | undefined | null): SessionUser | null {
  if (!raw) return null;

  // Legacy mock cookie
  if (raw === 'demo' || raw === DEMO_USER.id) {
    return { ...DEMO_USER };
  }

  // Legacy unsigned JSON cookie
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as SessionUser;
      if (parsed?.id && parsed?.email) {
        return {
          id: parsed.id,
          email: parsed.email,
          name: parsed.name || parsed.email.split('@')[0] || 'vendedor',
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  if (!raw.startsWith('dm1.')) return null;
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [, body, sig] = parts;
  const expected = createHmac('sha256', sessionSecret())
    .update(body)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as SessionPayload;
    if (!payload?.id || !payload?.email) return null;
    if (typeof payload.exp === 'number' && payload.exp < Date.now()) return null;
    return {
      id: payload.id,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0] || 'vendedor',
    };
  } catch {
    return null;
  }
}

function resolveCookieSecurity(): {
  sameSite: 'lax' | 'none';
  secure: boolean;
} {
  const frontend = process.env.FRONTEND_URL?.trim() || '';
  const api = process.env.PUBLIC_API_URL?.trim() || '';
  try {
    if (frontend && api) {
      const f = new URL(frontend);
      const a = new URL(api);
      const crossSite = f.hostname !== a.hostname;
      if (crossSite) {
        return { sameSite: 'none', secure: true };
      }
    }
  } catch {
    /* ignore bad URLs */
  }
  return {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
}

export function setSessionCookie(res: Response, user: SessionUser): string {
  const value = encodeSession(user);
  const { sameSite, secure } = resolveCookieSecurity();
  res.cookie(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite,
    path: '/',
    maxAge: SESSION_TTL_MS,
    secure,
  });
  return value;
}

export function clearSessionCookie(res: Response) {
  const { sameSite, secure } = resolveCookieSecurity();
  res.clearCookie(SESSION_COOKIE, { path: '/', sameSite, secure });
}

/** Format: scrypt$<salt_b64url>$<hash_b64url> */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('base64url');
  const hash = scryptSync(password, salt, 64).toString('base64url');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hash] = parts;
  const computed = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'base64url');
  if (computed.length !== expected.length) return false;
  return timingSafeEqual(computed, expected);
}

export function demoFallbackUser(): SessionUser {
  return { ...DEMO_USER };
}
