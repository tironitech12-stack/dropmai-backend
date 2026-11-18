import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SESSION_COOKIE, type SessionUser } from './auth.types';
import { decodeSession } from './auth.util';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      cookies?: Record<string, string>;
      headers: Record<string, string | undefined>;
      user?: SessionUser;
    }>();

    const cookie = req.cookies?.[SESSION_COOKIE];
    const header = req.headers['x-dropmai-user'];
    const auth = req.headers.authorization;
    const bearer =
      auth && /^Bearer\s+/i.test(auth)
        ? auth.replace(/^Bearer\s+/i, '').trim()
        : undefined;

    const fromCookie = decodeSession(cookie);
    if (fromCookie) {
      req.user = fromCookie;
      return true;
    }

    // Cross-origin clients (Vercel → Render) forward the mirrored dm1 session
    // via X-Dropmai-User or Authorization: Bearer (not a bare "demo" string).
    for (const token of [header, bearer]) {
      const user = decodeSession(token);
      if (user) {
        req.user = user;
        return true;
      }
    }

    throw new UnauthorizedException('Não autenticado');
  }
}
