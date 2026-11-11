import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DEMO_USER, SESSION_COOKIE } from './auth.types';

@Controller('api/v1/auth')
export class AuthController {
  @Post('login')
  login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = (body.email ?? '').trim().toLowerCase();
    if (!email) {
      return { error: 'Informe o e-mail' };
    }

    const user = {
      ...DEMO_USER,
      email: email || DEMO_USER.email,
    };

    res.cookie(SESSION_COOKIE, 'demo', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 14 * 1000,
    });

    return { ok: true, user };
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
}
