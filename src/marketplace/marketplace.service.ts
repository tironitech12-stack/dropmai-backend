import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { isDatabaseConfigured, PrismaService } from '../prisma/prisma.service';
import type { SessionUser } from '../auth/auth.types';

export type MarketplaceChannelId = 'MERCADO_LIVRE' | 'SHOPEE';

export type MarketplaceStatus =
  | 'not_configured'
  | 'not_connected'
  | 'connected'
  | 'error';

export type MarketplaceAccountView = {
  channel: MarketplaceChannelId;
  label: string;
  status: MarketplaceStatus;
  oauthConfigured: boolean;
  externalUserId: string | null;
  connectedAt: string | null;
  lastError: string | null;
  note: string | null;
};

type MemoryConnection = {
  storeId: string;
  channel: MarketplaceChannelId;
  externalUserId: string;
  active: boolean;
  connectedAt: string;
  lastError: string | null;
};

type OAuthStatePayload = {
  storeId: string;
  userId: string;
  channel: MarketplaceChannelId;
  nonce: string;
  exp: number;
};

const CHANNEL_META: Record<
  MarketplaceChannelId,
  { label: string; path: string }
> = {
  MERCADO_LIVRE: { label: 'Mercado Livre', path: 'mercado_livre' },
  SHOPEE: { label: 'Shopee', path: 'shopee' },
};

@Injectable()
export class MarketplaceService {
  private readonly memory = new Map<string, MemoryConnection>();

  constructor(private readonly prisma: PrismaService) {}

  private memoryKey(storeId: string, channel: MarketplaceChannelId) {
    return `${storeId}:${channel}`;
  }

  private publicApiBase() {
    return (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
  }

  private frontendBase() {
    return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
  }

  private stateSecret() {
    return (
      process.env.SESSION_SECRET?.trim() ||
      process.env.ML_CLIENT_SECRET?.trim() ||
      'dropmai-dev-marketplace-state'
    );
  }

  isOauthConfigured(channel: MarketplaceChannelId): boolean {
    if (channel === 'MERCADO_LIVRE') {
      return Boolean(
        process.env.ML_CLIENT_ID?.trim() &&
          process.env.ML_CLIENT_SECRET?.trim(),
      );
    }
    return Boolean(
      process.env.SHOPEE_PARTNER_ID?.trim() &&
        process.env.SHOPEE_PARTNER_KEY?.trim(),
    );
  }

  redirectUri(channel: MarketplaceChannelId): string {
    const fromEnv =
      channel === 'MERCADO_LIVRE'
        ? process.env.ML_REDIRECT_URI?.trim()
        : process.env.SHOPEE_REDIRECT_URI?.trim();
    if (fromEnv) return fromEnv;
    const base = this.publicApiBase();
    return `${base}/api/v1/marketplaces/${CHANNEL_META[channel].path}/callback`;
  }

  parseChannel(raw: string): MarketplaceChannelId | null {
    const n = raw.trim().toUpperCase().replace(/-/g, '_');
    if (n === 'MERCADO_LIVRE' || n === 'ML' || n === 'MERCADOLIVRE') {
      return 'MERCADO_LIVRE';
    }
    if (n === 'SHOPEE') return 'SHOPEE';
    return null;
  }

  signState(payload: OAuthStatePayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.stateSecret())
      .update(body)
      .digest('base64url');
    return `${body}.${sig}`;
  }

  verifyState(state: string): OAuthStatePayload | null {
    const [body, sig] = state.split('.');
    if (!body || !sig) return null;
    const expected = createHmac('sha256', this.stateSecret())
      .update(body)
      .digest('base64url');
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    } catch {
      return null;
    }
    try {
      const payload = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as OAuthStatePayload;
      if (!payload?.storeId || !payload?.userId || !payload?.channel) return null;
      if (payload.exp < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }

  async listForStore(storeId: string): Promise<{
    accounts: MarketplaceAccountView[];
    phase: string;
  }> {
    const channels: MarketplaceChannelId[] = ['MERCADO_LIVRE', 'SHOPEE'];
    const accounts: MarketplaceAccountView[] = [];

    for (const channel of channels) {
      accounts.push(await this.viewFor(storeId, channel));
    }

    return {
      accounts,
      phase: 'connect_stub',
    };
  }

  private async viewFor(
    storeId: string,
    channel: MarketplaceChannelId,
  ): Promise<MarketplaceAccountView> {
    const oauthConfigured = this.isOauthConfigured(channel);
    const meta = CHANNEL_META[channel];

    if (isDatabaseConfigured()) {
      const row = await this.prisma.marketplaceAccount.findFirst({
        where: { storeId, channel, active: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (row) {
        return {
          channel,
          label: meta.label,
          status: 'connected',
          oauthConfigured,
          externalUserId: row.externalUserId,
          connectedAt: row.createdAt.toISOString(),
          lastError: null,
          note: null,
        };
      }
    } else {
      const mem = this.memory.get(this.memoryKey(storeId, channel));
      if (mem?.active) {
        return {
          channel,
          label: meta.label,
          status: 'connected',
          oauthConfigured,
          externalUserId: mem.externalUserId,
          connectedAt: mem.connectedAt,
          lastError: mem.lastError,
          note: 'Conexão em memória (mock DB).',
        };
      }
    }

    if (!oauthConfigured) {
      return {
        channel,
        label: meta.label,
        status: 'not_configured',
        oauthConfigured: false,
        externalUserId: null,
        connectedAt: null,
        lastError: null,
        note:
          channel === 'MERCADO_LIVRE'
            ? 'Defina ML_CLIENT_ID e ML_CLIENT_SECRET no Backend.'
            : 'Defina SHOPEE_PARTNER_ID e SHOPEE_PARTNER_KEY no Backend.',
      };
    }

    return {
      channel,
      label: meta.label,
      status: 'not_connected',
      oauthConfigured: true,
      externalUserId: null,
      connectedAt: null,
      lastError: null,
      note: null,
    };
  }

  async beginConnect(
    storeId: string,
    user: SessionUser,
    channel: MarketplaceChannelId,
  ): Promise<
    | {
        ok: false;
        status: 'not_configured';
        channel: MarketplaceChannelId;
        message: string;
      }
    | {
        ok: true;
        status: 'authorize';
        channel: MarketplaceChannelId;
        authorizeUrl: string;
        message: string;
      }
  > {
    if (!this.isOauthConfigured(channel)) {
      return {
        ok: false,
        status: 'not_configured',
        channel,
        message:
          channel === 'MERCADO_LIVRE'
            ? 'Mercado Livre ainda não está configurado no servidor (faltam ML_CLIENT_ID / ML_CLIENT_SECRET).'
            : 'Shopee ainda não está configurado no servidor (faltam SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY).',
      };
    }

    const state = this.signState({
      storeId,
      userId: user.id,
      channel,
      nonce: randomBytes(8).toString('hex'),
      exp: Date.now() + 15 * 60 * 1000,
    });

    const authorizeUrl = this.buildAuthorizeUrl(channel, state);
    return {
      ok: true,
      status: 'authorize',
      channel,
      authorizeUrl,
      message:
        'OAuth URL gerada. Token exchange no callback ainda é stub — complete o cadastro do app no provedor.',
    };
  }

  private buildAuthorizeUrl(
    channel: MarketplaceChannelId,
    state: string,
  ): string {
    const redirectUri = this.redirectUri(channel);

    if (channel === 'MERCADO_LIVRE') {
      const clientId = process.env.ML_CLIENT_ID!.trim();
      const url = new URL('https://auth.mercadolivre.com.br/authorization');
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('state', state);
      return url.toString();
    }

    // Shopee partner auth — URL shape; full HMAC sign when Partner Key is live.
    const partnerId = process.env.SHOPEE_PARTNER_ID!.trim();
    const apiBase = (
      process.env.SHOPEE_API_BASE || 'https://partner.shopeemobile.com'
    ).replace(/\/$/, '');
    const path = '/api/v2/shop/auth_partner';
    const timestamp = Math.floor(Date.now() / 1000);
    const partnerKey = process.env.SHOPEE_PARTNER_KEY!.trim();
    const baseString = `${partnerId}${path}${timestamp}`;
    const sign = createHmac('sha256', partnerKey)
      .update(baseString)
      .digest('hex');
    const url = new URL(`${apiBase}${path}`);
    url.searchParams.set('partner_id', partnerId);
    url.searchParams.set('timestamp', String(timestamp));
    url.searchParams.set('sign', sign);
    url.searchParams.set('redirect', redirectUri);
    // state via redirect query after Shopee returns — also echo in redirect URI query if needed
    url.searchParams.set('state', state);
    return url.toString();
  }

  /**
   * OAuth callback stub: validates state, refuses to invent tokens.
   * When real exchange lands, persist MarketplaceAccount here.
   */
  async handleCallbackStub(
    channel: MarketplaceChannelId,
    query: { code?: string; state?: string; shop_id?: string; error?: string },
  ): Promise<{ redirectTo: string }> {
    const fe = this.frontendBase();
    const path = '/painel/canais/marketplaces';

    if (query.error) {
      return {
        redirectTo: `${fe}${path}?error=${encodeURIComponent(query.error)}&channel=${CHANNEL_META[channel].path}`,
      };
    }

    if (!query.state) {
      return {
        redirectTo: `${fe}${path}?error=missing_state&channel=${CHANNEL_META[channel].path}`,
      };
    }

    const payload = this.verifyState(query.state);
    if (!payload || payload.channel !== channel) {
      return {
        redirectTo: `${fe}${path}?error=invalid_state&channel=${CHANNEL_META[channel].path}`,
      };
    }

    if (!query.code && !query.shop_id) {
      return {
        redirectTo: `${fe}${path}?error=missing_code&channel=${CHANNEL_META[channel].path}`,
      };
    }

    // Stub only: do NOT store fake tokens. Surface honest pending status.
    return {
      redirectTo: `${fe}${path}?connected=pending&channel=${CHANNEL_META[channel].path}&storeId=${encodeURIComponent(payload.storeId)}&note=${encodeURIComponent('callback_ok_token_exchange_pending')}`,
    };
  }

  async disconnect(
    storeId: string,
    channel: MarketplaceChannelId,
  ): Promise<{ ok: true; channel: MarketplaceChannelId; status: 'not_connected' }> {
    if (isDatabaseConfigured()) {
      await this.prisma.marketplaceAccount.updateMany({
        where: { storeId, channel, active: true },
        data: { active: false },
      });
    }
    this.memory.delete(this.memoryKey(storeId, channel));
    return { ok: true, channel, status: 'not_connected' };
  }
}
