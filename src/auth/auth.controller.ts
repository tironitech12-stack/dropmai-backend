import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SESSION_COOKIE } from './auth.types';
import { AuthService } from './auth.service';
import {
  clearSessionCookie,
  decodeSession,
  isValidEmail,
  normalizeEmail,
  setSessionCookie,
} from './auth.util';

function exceptionMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpException) {
    const body = err.getResponse();
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object') {
      const msg = (body as { message?: string | string[] }).message;
      if (Array.isArray(msg)) return msg[0] || fallback;
      if (typeof msg === 'string') return msg;
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = normalizeEmail(body.email);
    if (!email) {
      res.status(400);
      return { error: 'Informe o e-mail', field: 'email' };
    }
    if (!isValidEmail(email)) {
      res.status(400);
      return { error: 'E-mail inválido', field: 'email' };
    }
    if (!String(body.password ?? '').trim()) {
      res.status(400);
      return { error: 'Informe a senha', field: 'password' };
    }

    try {
      const user = await this.auth.login(email, String(body.password));
      const session = setSessionCookie(res, user);
      return { ok: true, user, session };
    } catch (err) {
      const status = err instanceof HttpException ? err.getStatus() : 401;
      res.status(status);
      return { error: exceptionMessage(err, 'E-mail ou senha incorretos') };
    }
  }

  @Post('register')
  @HttpCode(201)
  async register(
    @Body() body: { name?: string; email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = normalizeEmail(body.email);
    const name = String(body.name ?? '').trim();
    const password = String(body.password ?? '');

    if (!name || name.length < 2) {
      res.status(400);
      return { error: 'Informe seu nome', field: 'name' };
    }
    if (!email) {
      res.status(400);
      return { error: 'Informe o e-mail', field: 'email' };
    }
    if (!isValidEmail(email)) {
      res.status(400);
      return { error: 'E-mail inválido', field: 'email' };
    }
    if (password.length < 6) {
      res.status(400);
      return {
        error: 'A senha deve ter pelo menos 6 caracteres',
        field: 'password',
      };
    }

    try {
      const user = await this.auth.register(name, email, password);
      const session = setSessionCookie(res, user);
      return { ok: true, created: true, user, session };
    } catch (err) {
      const status = err instanceof HttpException ? err.getStatus() : 400;
      res.status(status);
      return {
        error: exceptionMessage(err, 'Não foi possível criar a conta'),
        field: status === 409 ? 'email' : undefined,
      };
    }
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    clearSessionCookie(res);
    return { ok: true };
  }

  @Get('me')
  me(@Req() req: { cookies?: Record<string, string> }) {
    const user = decodeSession(req.cookies?.[SESSION_COOKIE]);
    return { user };
  }

  /**
   * Google OAuth start.
   * Requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.
   */
  @Get('google')
  googleStart(
    @Query('returnTo') returnTo: string | undefined,
    @Res() res: Response,
  ) {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI?.trim() ||
      `${process.env.PUBLIC_API_URL?.replace(/\/$/, '') || ''}/api/v1/auth/google/callback`;
    const frontend =
      process.env.FRONTEND_URL?.replace(/\/$/, '') ||
      'https://dropmai.vercel.app';

    if (!clientId || !clientSecret || !redirectUri.startsWith('http')) {
      const accept = String(
        (res.req as { headers?: { accept?: string } }).headers?.accept || '',
      );
      if (accept.includes('application/json')) {
        return res.status(501).json({
          ok: false,
          stub: true,
          message:
            'Google OAuth não configurado. Defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI.',
          envs: [
            'GOOGLE_CLIENT_ID',
            'GOOGLE_CLIENT_SECRET',
            'GOOGLE_REDIRECT_URI',
            'FRONTEND_URL',
            'SESSION_SECRET',
            'DATABASE_URL',
            'DROPMAI_USE_MOCK',
          ],
        });
      }
      return res.redirect(
        `${frontend}/entrar?error=${encodeURIComponent('google_not_configured')}`,
      );
    }

    const state = Buffer.from(
      JSON.stringify({
        returnTo: returnTo || `${frontend}/painel`,
        n: Date.now(),
      }),
    ).toString('base64url');

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('access_type', 'online');
    url.searchParams.set('prompt', 'select_account');
    url.searchParams.set('state', state);

    return res.redirect(url.toString());
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const frontend =
      process.env.FRONTEND_URL?.replace(/\/$/, '') ||
      'https://dropmai.vercel.app';

    let returnTo = `${frontend}/painel`;
    try {
      if (state) {
        const parsed = JSON.parse(
          Buffer.from(state, 'base64url').toString('utf8'),
        ) as { returnTo?: string };
        if (parsed.returnTo?.startsWith('http')) returnTo = parsed.returnTo;
      }
    } catch {
      /* ignore bad state */
    }

    if (error || !code) {
      return res.redirect(
        `${frontend}/entrar?error=${encodeURIComponent(error || 'google_denied')}`,
      );
    }

    try {
      const user = await this.auth.loginWithGoogleCode(code);
      const session = setSessionCookie(res, user);
      // Bridge via URL hash so the session token is not sent to frontend logs/Referer.
      const bridge = new URL(`${frontend}/auth/callback`);
      bridge.hash = new URLSearchParams({
        session,
        returnTo,
      }).toString();
      return res.redirect(bridge.toString());
    } catch {
      return res.redirect(
        `${frontend}/entrar?error=${encodeURIComponent('google_failed')}`,
      );
    }
  }
}
