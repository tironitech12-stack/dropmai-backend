import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { DEMO_USER, SESSION_COOKIE } from './auth.types';
import {
  isValidEmail,
  normalizeEmail,
  sessionUserFromEmail,
  setSessionCookie,
} from './auth.util';

@Controller('api/v1/auth')
export class AuthController {
  @Post('login')
  @HttpCode(200)
  login(
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

    const user = sessionUserFromEmail(email);
    setSessionCookie(res, user);
    return { ok: true, user };
  }

  @Post('register')
  @HttpCode(201)
  register(
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

    // Stub: no persistence yet — always "creates" and signs in
    const user = sessionUserFromEmail(email, name);
    setSessionCookie(res, user);
    return { ok: true, created: true, user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  me(@Req() req: { cookies?: Record<string, string> }) {
    const cookie = req.cookies?.[SESSION_COOKIE];
    if (!cookie) {
      return { user: null };
    }
    return { user: DEMO_USER };
  }

  /**
   * Google OAuth start.
   * If GOOGLE_CLIENT_ID (+ secret + redirect) are set, redirects to Google.
   * Otherwise returns JSON documenting required envs (for UI stub button).
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
      // Stub: bounce back to login with a clear query flag (UI still ships the button).
      // Required envs: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, FRONTEND_URL
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
  googleCallback(
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

    // Stub: exchange not implemented without full Google token plumbing.
    // Sign in as demo Google user so the button path works end-to-end in staging.
    const user = sessionUserFromEmail(
      'google-user@dropmai.com.br',
      'Conta Google',
    );
    setSessionCookie(res, user);
    return res.redirect(returnTo);
  }
}
