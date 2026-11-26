import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isDatabaseConfigured, PrismaService } from '../prisma/prisma.service';
import type { SessionUser } from '../auth/auth.types';
import {
  THEME_CATALOG,
  buildDefaultSettings,
  getThemeDefinition,
  mergeThemeSettings,
  type ThemeSettings,
} from '../themes/theme-catalog';

export type StoreSummary = {
  id: string;
  slug: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED';
  description?: string | null;
  logoUrl?: string | null;
  themeId: string;
  themeSettings: ThemeSettings;
  createdAt: string;
};

type MemoryStore = StoreSummary & { ownerId: string };

@Injectable()
export class StoresService {
  private readonly memory = new Map<string, MemoryStore>();

  constructor(private readonly prisma: PrismaService) {}

  private seed(user: SessionUser) {
    if (this.memory.size > 0) return;
    const themeId = 'vitrine';
    const themeSettings = buildDefaultSettings(themeId, 'Minha Loja Demo');
    this.memory.set('store-demo-1', {
      id: 'store-demo-1',
      slug: 'minhaloja',
      name: 'Minha Loja Demo',
      status: 'ACTIVE',
      description: 'Loja de exemplo no Dropmai',
      logoUrl: null,
      themeId,
      themeSettings,
      createdAt: new Date().toISOString(),
      ownerId: user.id,
    });
  }

  private normalizeSlug(slug: string) {
    return slug
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
  }

  private toSummary(input: {
    id: string;
    slug: string;
    name: string;
    status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED';
    description?: string | null;
    logoUrl?: string | null;
    themeId?: string | null;
    themeSettings?: unknown;
    createdAt: string | Date;
  }): StoreSummary {
    const themeId = input.themeId || 'vitrine';
    const defaults = buildDefaultSettings(
      themeId,
      input.name,
      input.logoUrl ?? null,
    );
    const themeSettings = mergeThemeSettings(
      defaults,
      (input.themeSettings as ThemeSettings) ?? null,
    );
    if (!themeSettings.brand.name) themeSettings.brand.name = input.name;
    if (input.logoUrl && !themeSettings.brand.logoUrl) {
      themeSettings.brand.logoUrl = input.logoUrl;
    }
    return {
      id: input.id,
      slug: input.slug,
      name: input.name,
      status: input.status,
      description: input.description ?? null,
      logoUrl: themeSettings.brand.logoUrl ?? input.logoUrl ?? null,
      themeId,
      themeSettings,
      createdAt:
        typeof input.createdAt === 'string'
          ? input.createdAt
          : input.createdAt.toISOString(),
    };
  }

  listThemes() {
    return THEME_CATALOG.map((t) => ({
      id: t.id,
      name: t.name,
      tagline: t.tagline,
      free: t.free,
      previewAccent: t.previewAccent,
      defaultSettings: t.defaultSettings,
    }));
  }

  async listForUser(user: SessionUser): Promise<StoreSummary[]> {
    if (!isDatabaseConfigured()) {
      this.seed(user);
      return Array.from(this.memory.values())
        .filter((s) => s.ownerId === user.id)
        .map((s) => this.toSummary(s));
    }

    const rows = await this.prisma.store.findMany({
      where: { members: { some: { userId: user.id } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((s) => this.toSummary(s));
  }

  async create(
    user: SessionUser,
    input: { name: string; slug: string; description?: string },
  ): Promise<StoreSummary> {
    const slug = this.normalizeSlug(input.slug);
    if (!slug || slug.length < 2) {
      throw new BadRequestException('Slug inválido');
    }

    const themeId = 'vitrine';
    const themeSettings = buildDefaultSettings(themeId, input.name.trim());

    if (!isDatabaseConfigured()) {
      this.seed(user);
      for (const s of this.memory.values()) {
        if (s.slug === slug) {
          throw new BadRequestException('Este subdomínio já está em uso');
        }
      }
      const id = `store-${Date.now()}`;
      const row: MemoryStore = {
        id,
        slug,
        name: input.name.trim(),
        status: 'DRAFT',
        description: input.description ?? null,
        logoUrl: null,
        themeId,
        themeSettings,
        createdAt: new Date().toISOString(),
        ownerId: user.id,
      };
      this.memory.set(id, row);
      return this.toSummary(row);
    }

    let dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      dbUser = await this.prisma.user.upsert({
        where: { email: user.email },
        create: { id: user.id, email: user.email, name: user.name },
        update: { name: user.name },
      });
    }

    const store = await this.prisma.store.create({
      data: {
        name: input.name.trim(),
        slug,
        description: input.description,
        status: 'DRAFT',
        themeId,
        themeSettings: themeSettings as unknown as Prisma.InputJsonValue,
        members: { create: { userId: dbUser.id, role: 'OWNER' } },
      },
    });

    return this.toSummary(store);
  }

  async getById(
    storeId: string,
    user: SessionUser,
  ): Promise<StoreSummary | null> {
    if (!isDatabaseConfigured()) {
      this.seed(user);
      const row = this.memory.get(storeId);
      if (!row || row.ownerId !== user.id) return null;
      return this.toSummary(row);
    }

    const store = await this.prisma.store.findFirst({
      where: { id: storeId, members: { some: { userId: user.id } } },
    });
    if (!store) return null;
    return this.toSummary(store);
  }

  async getBySlug(slug: string): Promise<StoreSummary | null> {
    if (!isDatabaseConfigured()) {
      for (const s of this.memory.values()) {
        if (s.slug === slug) return this.toSummary(s);
      }
      if (slug === 'minhaloja') {
        return this.toSummary({
          id: 'store-demo-1',
          slug: 'minhaloja',
          name: 'Minha Loja Demo',
          status: 'ACTIVE',
          description: 'Loja de exemplo no Dropmai',
          logoUrl: null,
          themeId: 'vitrine',
          themeSettings: buildDefaultSettings('vitrine', 'Minha Loja Demo'),
          createdAt: new Date().toISOString(),
        });
      }
      return null;
    }

    const store = await this.prisma.store.findUnique({ where: { slug } });
    if (!store) return null;
    return this.toSummary(store);
  }

  async applyTheme(
    storeId: string,
    user: SessionUser,
    themeId: string,
    keepCustomBrand = true,
  ): Promise<StoreSummary> {
    const store = await this.getById(storeId, user);
    if (!store) throw new BadRequestException('Loja não encontrada');
    getThemeDefinition(themeId); // validates known id via fallback

    const nextDefaults = buildDefaultSettings(themeId, store.name, store.logoUrl);
    const themeSettings = keepCustomBrand
      ? mergeThemeSettings(nextDefaults, {
          brand: store.themeSettings.brand,
          // keep colors/typography from new theme; brand stays
        })
      : nextDefaults;

    return this.persistTheme(storeId, user, themeId, themeSettings);
  }

  async updateThemeSettings(
    storeId: string,
    user: SessionUser,
    input: {
      themeId?: string;
      themeSettings?: Partial<ThemeSettings> | ThemeSettings;
      logoUrl?: string | null;
    },
  ): Promise<StoreSummary> {
    const store = await this.getById(storeId, user);
    if (!store) throw new BadRequestException('Loja não encontrada');

    const themeId = input.themeId || store.themeId;
    const base = buildDefaultSettings(themeId, store.name, store.logoUrl);
    const merged = mergeThemeSettings(
      mergeThemeSettings(base, store.themeSettings),
      input.themeSettings,
    );

    if (input.logoUrl !== undefined) {
      merged.brand.logoUrl = input.logoUrl;
    }
    if (input.themeSettings && 'brand' in input.themeSettings === false) {
      // keep brand name filled
    }
    if (!merged.brand.name) merged.brand.name = store.name;

    return this.persistTheme(storeId, user, themeId, merged);
  }

  private async persistTheme(
    storeId: string,
    user: SessionUser,
    themeId: string,
    themeSettings: ThemeSettings,
  ): Promise<StoreSummary> {
    const logoUrl = themeSettings.brand.logoUrl ?? null;

    if (!isDatabaseConfigured()) {
      this.seed(user);
      const row = this.memory.get(storeId);
      if (!row || row.ownerId !== user.id) {
        throw new BadRequestException('Loja não encontrada');
      }
      row.themeId = themeId;
      row.themeSettings = themeSettings;
      row.logoUrl = logoUrl;
      this.memory.set(storeId, row);
      return this.toSummary(row);
    }

    const updated = await this.prisma.store.updateMany({
      where: { id: storeId, members: { some: { userId: user.id } } },
      data: {
        themeId,
        themeSettings: themeSettings as unknown as Prisma.InputJsonValue,
        logoUrl,
      },
    });
    if (!updated.count) throw new BadRequestException('Loja não encontrada');

    const store = await this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
    });
    return this.toSummary(store);
  }
}
