import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { isDatabaseConfigured, PrismaService } from '../prisma/prisma.service';
import type { SessionUser } from './auth.types';
import {
  hashPassword,
  sessionUserFromEmail,
  toSessionUser,
  verifyPassword,
} from './auth.util';

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  id?: string;
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Assumes email/password already validated by controller. */
  async login(email: string, password: string): Promise<SessionUser> {
    if (!isDatabaseConfigured()) {
      return sessionUserFromEmail(email);
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }
    return toSessionUser(user);
  }

  /** Assumes name/email/password already validated by controller. */
  async register(
    name: string,
    email: string,
    password: string,
  ): Promise<SessionUser> {
    if (!isDatabaseConfigured()) {
      return sessionUserFromEmail(email, name);
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Já existe uma conta com este e-mail');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash: hashPassword(password),
      },
    });
    return toSessionUser(user);
  }

  async loginWithGoogleCode(code: string): Promise<SessionUser> {
    const profile = await this.exchangeGoogleCode(code);
    const providerAccountId = String(profile.id || profile.sub || '').trim();
    const email = String(profile.email ?? '')
      .trim()
      .toLowerCase();

    if (!providerAccountId || !email || !email.includes('@')) {
      throw new UnauthorizedException('Google não retornou e-mail válido');
    }

    const name =
      String(profile.name ?? '').trim() || email.split('@')[0] || 'vendedor';
    const imageUrl = profile.picture?.trim() || null;

    if (!isDatabaseConfigured()) {
      return {
        id: `google-${providerAccountId}`,
        email,
        name,
      };
    }

    return this.upsertGoogleUser({
      providerAccountId,
      email,
      name,
      imageUrl,
      accessToken: profile.accessToken,
      refreshToken: profile.refreshToken,
      expiresAt: profile.expiresAt,
    });
  }

  private async upsertGoogleUser(input: {
    providerAccountId: string;
    email: string;
    name: string;
    imageUrl: string | null;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
  }): Promise<SessionUser> {
    const existingAccount = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: input.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (existingAccount) {
      const user = await this.prisma.user.update({
        where: { id: existingAccount.userId },
        data: {
          name: input.name || existingAccount.user.name,
          imageUrl: input.imageUrl ?? existingAccount.user.imageUrl,
          email: input.email,
        },
      });
      await this.prisma.account.update({
        where: { id: existingAccount.id },
        data: {
          accessToken: input.accessToken,
          refreshToken: input.refreshToken ?? existingAccount.refreshToken,
          expiresAt: input.expiresAt,
        },
      });
      return toSessionUser(user);
    }

    const byEmail = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (byEmail) {
      await this.prisma.account.create({
        data: {
          userId: byEmail.id,
          provider: 'google',
          providerAccountId: input.providerAccountId,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          expiresAt: input.expiresAt,
        },
      });
      const user = await this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          name: input.name || byEmail.name,
          imageUrl: input.imageUrl ?? byEmail.imageUrl,
        },
      });
      return toSessionUser(user);
    }

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        imageUrl: input.imageUrl,
        accounts: {
          create: {
            provider: 'google',
            providerAccountId: input.providerAccountId,
            accessToken: input.accessToken,
            refreshToken: input.refreshToken,
            expiresAt: input.expiresAt,
          },
        },
      },
    });
    return toSessionUser(user);
  }

  private async exchangeGoogleCode(code: string): Promise<
    GoogleUserInfo & {
      accessToken?: string;
      refreshToken?: string;
      expiresAt?: Date;
    }
  > {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI?.trim() ||
      `${process.env.PUBLIC_API_URL?.replace(/\/$/, '') || ''}/api/v1/auth/google/callback`;

    if (!clientId || !clientSecret || !redirectUri.startsWith('http')) {
      throw new UnauthorizedException('Google OAuth não configurado');
    }

    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const tokenJson = (await tokenRes.json()) as GoogleTokenResponse;
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new UnauthorizedException(
        tokenJson.error_description ||
          tokenJson.error ||
          'Falha ao trocar código Google',
      );
    }

    const infoRes = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      },
    );
    const info = (await infoRes.json()) as GoogleUserInfo;
    if (!infoRes.ok) {
      throw new UnauthorizedException('Falha ao ler perfil Google');
    }

    const expiresAt =
      typeof tokenJson.expires_in === 'number'
        ? new Date(Date.now() + tokenJson.expires_in * 1000)
        : undefined;

    return {
      ...info,
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token,
      expiresAt,
    };
  }
}
