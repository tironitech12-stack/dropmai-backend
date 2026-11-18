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

    const fromCookie = decodeSession(cookie);
    if (fromCookie) {
      req.user = fromCookie;
      return true;
    }

    // Optional debug/header override: pass a signed session token, not "demo"
    if (header) {
      const fromHeader = decodeSession(header);
      if (fromHeader) {
        req.user = fromHeader;
        return true;
      }
    }

    throw new UnauthorizedException('Não autenticado');
  }
}
