import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DEMO_USER, SESSION_COOKIE, SessionUser } from './auth.types';

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

    if (cookie === 'demo' || cookie === DEMO_USER.id || header === 'demo') {
      req.user = DEMO_USER;
      return true;
    }

    if (cookie) {
      try {
        const parsed = JSON.parse(cookie) as SessionUser;
        if (parsed?.email) {
          req.user = parsed;
          return true;
        }
      } catch {
        req.user = DEMO_USER;
        return true;
      }
    }

    throw new UnauthorizedException('Não autenticado');
  }
}
