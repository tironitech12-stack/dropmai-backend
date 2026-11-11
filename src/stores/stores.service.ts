import { BadRequestException, Injectable } from '@nestjs/common';
import { isDatabaseConfigured, PrismaService } from '../prisma/prisma.service';
import type { SessionUser } from '../auth/auth.types';

export type StoreSummary = {
  id: string;
  slug: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED';
  description?: string | null;
  createdAt: string;
};

type MemoryStore = StoreSummary & { ownerId: string };

@Injectable()
export class StoresService {
  private readonly memory = new Map<string, MemoryStore>();

  constructor(private readonly prisma: PrismaService) {}

  private seed(user: SessionUser) {
    if (this.memory.size > 0) return;
    this.memory.set('store-demo-1', {
      id: 'store-demo-1',
      slug: 'minhaloja',
      name: 'Minha Loja Demo',
      status: 'ACTIVE',
      description: 'Loja de exemplo no Dropmai',
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

  async listForUser(user: SessionUser): Promise<StoreSummary[]> {
    if (!isDatabaseConfigured()) {
      this.seed(user);
      return Array.from(this.memory.values())
        .filter((s) => s.ownerId === user.id)
        .map((s) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          status: s.status,
          description: s.description,
          createdAt: s.createdAt,
        }));
    }

    const rows = await this.prisma.store.findMany({
      where: { members: { some: { userId: user.id } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      status: s.status,
      description: s.description,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async create(
    user: SessionUser,
    input: { name: string; slug: string; description?: string },
  ): Promise<StoreSummary> {
    const slug = this.normalizeSlug(input.slug);
    if (!slug || slug.length < 2) {
      throw new BadRequestException('Slug inválido');
    }

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
        createdAt: new Date().toISOString(),
        ownerId: user.id,
      };
      this.memory.set(id, row);
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        status: row.status,
        description: row.description,
        createdAt: row.createdAt,
      };
    }

    const dbUser = await this.prisma.user.upsert({
      where: { email: user.email },
      create: { id: user.id, email: user.email, name: user.name },
      update: { name: user.name },
    });

    const store = await this.prisma.store.create({
      data: {
        name: input.name.trim(),
        slug,
        description: input.description,
        status: 'DRAFT',
        members: { create: { userId: dbUser.id, role: 'OWNER' } },
      },
    });

    return {
      id: store.id,
      slug: store.slug,
      name: store.name,
      status: store.status,
      description: store.description,
      createdAt: store.createdAt.toISOString(),
    };
  }

  async getById(storeId: string, user: SessionUser): Promise<StoreSummary | null> {
    if (!isDatabaseConfigured()) {
      this.seed(user);
      const row = this.memory.get(storeId);
      if (!row || row.ownerId !== user.id) return null;
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        status: row.status,
        description: row.description,
        createdAt: row.createdAt,
      };
    }

    const store = await this.prisma.store.findFirst({
      where: { id: storeId, members: { some: { userId: user.id } } },
    });
    if (!store) return null;
    return {
      id: store.id,
      slug: store.slug,
      name: store.name,
      status: store.status,
      description: store.description,
      createdAt: store.createdAt.toISOString(),
    };
  }

  async getBySlug(slug: string): Promise<StoreSummary | null> {
    if (!isDatabaseConfigured()) {
      for (const s of this.memory.values()) {
        if (s.slug === slug) {
          return {
            id: s.id,
            slug: s.slug,
            name: s.name,
            status: s.status,
            description: s.description,
            createdAt: s.createdAt,
          };
        }
      }
      if (slug === 'minhaloja') {
        return {
          id: 'store-demo-1',
          slug: 'minhaloja',
          name: 'Minha Loja Demo',
          status: 'ACTIVE',
          description: 'Loja de exemplo no Dropmai',
          createdAt: new Date().toISOString(),
        };
      }
      return null;
    }

    const store = await this.prisma.store.findUnique({ where: { slug } });
    if (!store) return null;
    return {
      id: store.id,
      slug: store.slug,
      name: store.name,
      status: store.status,
      description: store.description,
      createdAt: store.createdAt.toISOString(),
    };
  }
}
