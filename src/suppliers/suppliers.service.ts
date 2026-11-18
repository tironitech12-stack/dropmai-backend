import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isDatabaseConfigured, PrismaService } from '../prisma/prisma.service';
import { MOCK_XNAMAI_PRODUCTS } from './mock-catalog';
import type { SupplierProduct, SupplierSyncResult } from './types';
import { XnamaiCatalogAdapter } from './xnamai.adapter';

type CatalogDto = {
  id: string;
  externalId: string;
  sku: string | null;
  title: string;
  stock: number;
  costPrice: number;
  categoryId: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  imageHashes: string[];
  active: boolean;
  featured: boolean;
  showOnB2b: boolean;
};

@Injectable()
export class SuppliersService {
  private readonly memoryCatalog = new Map<string, SupplierProduct>();
  private liveCache:
    | {
        at: number;
        products: SupplierProduct[];
        categories: Array<{ id: string; name: string; parentId: string | null }>;
        mode: 'live' | 'mock';
        source: string;
      }
    | null = null;
  private readonly liveCacheTtlMs = 5 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {
    for (const p of MOCK_XNAMAI_PRODUCTS) {
      this.memoryCatalog.set(p.externalId, p);
    }
  }

  getMemoryCatalog(): SupplierProduct[] {
    return Array.from(this.memoryCatalog.values());
  }

  private toDto(
    p: SupplierProduct,
    categoryNameById: Map<string, string>,
  ): CatalogDto {
    const categoryId = p.categoryExternalId ?? null;
    const raw = (p.raw ?? {}) as Record<string, unknown>;
    const showOnB2b = raw.exibir_no_b2b == null ? false : Boolean(raw.exibir_no_b2b);
    const featuredFlag =
      raw.destaque === true ||
      raw.exibir_destaque === true ||
      raw.produto_destaque === true ||
      showOnB2b;
    return {
      id: p.externalId,
      externalId: p.externalId,
      sku: p.sku ?? null,
      title: p.title,
      stock: Number(p.stock),
      costPrice: Number(p.costPrice),
      categoryId,
      categoryName:
        p.categoryName ??
        (categoryId ? categoryNameById.get(categoryId) ?? null : null),
      imageUrl: p.imageUrls?.[0] ?? null,
      imageHashes: p.imageHashes ?? [],
      active: p.active,
      featured: Boolean(featuredFlag),
      showOnB2b,
    };
  }

  private async loadLiveCatalog(forceMock?: boolean) {
    const adapter = new XnamaiCatalogAdapter({ forceMock });
    const now = Date.now();
    if (
      this.liveCache &&
      now - this.liveCache.at < this.liveCacheTtlMs &&
      !forceMock
    ) {
      return this.liveCache;
    }

    const [fetched, cats] = await Promise.all([
      adapter.fetchProducts({
        limit: 5000,
        fullCatalog: adapter.hasLiveSource(),
      }),
      adapter.fetchCategories(),
    ]);

    // Optional Mercos enrich (B2B flags / rare image URLs) — never block BI catalog.
    let enrichById = new Map<string, SupplierProduct>();
    if (fetched.source.startsWith('xnamai-bi')) {
      try {
        const mercosEnrich = await adapter.fetchProducts({
          limit: 500,
          fullCatalog: false,
        });
        if (mercosEnrich.source === 'mercos-adaptor') {
          enrichById = new Map(
            mercosEnrich.products.map((p) => [p.externalId, p] as const),
          );
        }
      } catch {
        /* ignore enrich failures */
      }
    }

    const merged: SupplierProduct[] = [];
    for (const p of fetched.products) {
      const extra = enrichById.get(p.externalId);
      const row: SupplierProduct = extra
        ? {
            ...p,
            categoryExternalId: p.categoryExternalId ?? extra.categoryExternalId,
            imageUrls: p.imageUrls?.length ? p.imageUrls : extra.imageUrls,
            imageHashes: p.imageHashes?.length
              ? p.imageHashes
              : extra.imageHashes,
            raw: { ...(extra.raw ?? {}), ...(p.raw ?? {}) },
          }
        : p;
      this.memoryCatalog.set(row.externalId, row);
      merged.push(row);
    }

    // Skip demo rows labeled [exemplo] when live source is available.
    const products =
      fetched.mode === 'live'
        ? merged.filter(
            (p) => !/\[exemplo\]/i.test(p.title) && p.active !== false,
          )
        : merged;

    this.liveCache = {
      at: now,
      products,
      categories: cats.categories,
      mode: fetched.mode,
      source:
        enrichById.size > 0 && fetched.source !== 'mercos-adaptor'
          ? `${fetched.source}+mercos-enrich`
          : fetched.source,
    };
    return this.liveCache;
  }

  /**
   * List Xnamai supplier products for the merchant panel.
   * Live path: Mercos adaptor (paginated) → BI analytics → mock only if unreachable.
   */
  async listXnamaiProducts(options?: {
    inStock?: boolean;
    limit?: number;
    page?: number;
    pageSize?: number;
    categoryId?: string;
    q?: string;
    forceMock?: boolean;
  }): Promise<{
    products: CatalogDto[];
    featured: CatalogDto[];
    categories: Array<{ id: string; name: string; parentId: string | null; count: number }>;
    mode: 'live' | 'mock' | 'db';
    source: string;
    inStock: boolean;
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    warning?: string;
  }> {
    const inStock = options?.inStock !== false;
    const page = Math.max(options?.page ?? 1, 1);
    const pageSize = Math.min(Math.max(options?.pageSize ?? options?.limit ?? 48, 1), 100);
    const categoryId = options?.categoryId?.trim() || '';
    const q = options?.q?.trim().toLowerCase() || '';

    const live = await this.loadLiveCatalog(options?.forceMock);
    const categoryNameById = new Map(
      live.categories.map((c) => [c.id, c.name] as const),
    );

    let products = live.products.map((p) => this.toDto(p, categoryNameById));

    let mode: 'live' | 'mock' | 'db' =
      live.mode === 'mock' ? 'mock' : 'live';
    let source = live.source;

    // Prefer Dropmai DB only when live adapter is unavailable but DB has rows.
    if (isDatabaseConfigured() && mode !== 'live') {
      try {
        const rows = await this.prisma.product.findMany({
          where: {
            supplier: { code: 'xnamai' },
            ...(inStock ? { stock: { gt: 0 } } : {}),
          },
          orderBy: [{ stock: 'desc' }, { title: 'asc' }],
          take: 5000,
        });
        if (rows.length > 0) {
          products = rows.map((p) => ({
            id: p.id,
            externalId: p.externalId,
            sku: p.sku,
            title: p.title,
            stock: Number(p.stock),
            costPrice: Number(p.costPrice),
            categoryId: p.categoryExternalId,
            categoryName: p.categoryName,
            imageUrl: p.imageUrls?.[0] ?? null,
            imageHashes: p.imageHashes ?? [],
            active: p.active,
            featured: false,
            showOnB2b: false,
          }));
          mode = 'db';
          source = 'dropmai-db';
        }
      } catch (err) {
        console.warn('[suppliers] db list failed, keeping adapter catalog', err);
      }
    }

    if (inStock) {
      products = products.filter((p) => p.stock > 0);
    }
    if (categoryId) {
      products = products.filter((p) => p.categoryId === categoryId);
    }
    if (q) {
      products = products.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q) ||
          p.externalId.toLowerCase().includes(q),
      );
    }

    products.sort((a, b) => b.stock - a.stock || a.title.localeCompare(b.title));

    const counts = new Map<string, number>();
    for (const p of products) {
      if (!p.categoryId) continue;
      counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    }
    const categories = live.categories
      .map((c) => ({
        ...c,
        count: counts.get(c.id) ?? 0,
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    let featured = products.filter((p) => p.featured).slice(0, 12);
    if (featured.length < 6) {
      featured = products.slice(0, 12);
    }

    const total = products.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const pageItems = products.slice(start, start + pageSize);

    const warning =
      mode === 'mock'
        ? 'Catálogo mock ativo. Configure MERCOS_ADAPTOR_API_KEY ou XNAMAI_BI_API_KEY (e DROPMAI_USE_MOCK=false) no Render.'
        : pageItems.every((p) => !p.imageUrl)
          ? 'Mercos entrega hashes de imagem, não URLs públicas. Defina MERCOS_IMAGE_URL_TEMPLATE se houver CDN, ou estenda o Adaptor para imagens.'
          : undefined;

    return {
      products: pageItems,
      featured,
      categories,
      mode,
      source,
      inStock,
      page,
      pageSize,
      total,
      totalPages,
      warning,
    };
  }

  async listXnamaiCategories() {
    const live = await this.loadLiveCatalog();
    return {
      categories: live.categories,
      mode: live.mode,
      source: live.source,
    };
  }

  async syncXnamai(options?: {
    limit?: number;
    forceMock?: boolean;
  }): Promise<SupplierSyncResult> {
    const adapter = new XnamaiCatalogAdapter({ forceMock: options?.forceMock });
    const fetched = await adapter.fetchProducts({ limit: options?.limit ?? 200 });

    if (!isDatabaseConfigured()) {
      for (const p of fetched.products) {
        this.memoryCatalog.set(p.externalId, p);
      }
      return {
        supplierCode: 'xnamai',
        fetched: fetched.products.length,
        upserted: fetched.products.length,
        mode: fetched.mode,
        source: `${fetched.source}+memory`,
      };
    }

    const supplier = await this.prisma.supplier.upsert({
      where: { code: 'xnamai' },
      create: {
        code: 'xnamai',
        name: 'Xnamai',
        active: true,
        apiBaseUrl:
          process.env.MERCOS_ADAPTOR_URL || process.env.XNAMAI_BI_URL || null,
        metadata: { role: 'primary_supplier' },
      },
      update: { active: true, name: 'Xnamai' },
    });

    let upserted = 0;
    const run = await this.prisma.catalogSyncRun.create({
      data: { supplierCode: 'xnamai', status: 'PENDING' },
    });

    try {
      for (const product of fetched.products) {
        const row = await this.prisma.product.upsert({
          where: {
            supplierId_externalId: {
              supplierId: supplier.id,
              externalId: product.externalId,
            },
          },
          create: {
            supplierId: supplier.id,
            externalId: product.externalId,
            sku: product.sku,
            title: product.title,
            description: product.description,
            categoryExternalId: product.categoryExternalId,
            categoryName: product.categoryName,
            unit: product.unit,
            costPrice: new Prisma.Decimal(product.costPrice),
            minimumPrice:
              product.minimumPrice != null
                ? new Prisma.Decimal(product.minimumPrice)
                : null,
            stock: new Prisma.Decimal(product.stock),
            ncm: product.ncm,
            imageUrls: product.imageUrls ?? [],
            imageHashes: product.imageHashes ?? [],
            active: product.active,
            raw: (product.raw as Prisma.InputJsonValue) ?? undefined,
            sourceUpdatedAt: product.sourceUpdatedAt
              ? new Date(product.sourceUpdatedAt)
              : null,
            lastSyncedAt: new Date(),
          },
          update: {
            sku: product.sku,
            title: product.title,
            description: product.description,
            categoryExternalId: product.categoryExternalId,
            categoryName: product.categoryName,
            unit: product.unit,
            costPrice: new Prisma.Decimal(product.costPrice),
            minimumPrice:
              product.minimumPrice != null
                ? new Prisma.Decimal(product.minimumPrice)
                : null,
            stock: new Prisma.Decimal(product.stock),
            ncm: product.ncm,
            imageUrls: product.imageUrls ?? [],
            imageHashes: product.imageHashes ?? [],
            active: product.active,
            raw: (product.raw as Prisma.InputJsonValue) ?? undefined,
            sourceUpdatedAt: product.sourceUpdatedAt
              ? new Date(product.sourceUpdatedAt)
              : null,
            lastSyncedAt: new Date(),
          },
        });

        if (product.variants?.length) {
          for (const variant of product.variants) {
            if (!variant.externalId && !variant.sku) continue;
            const existing = variant.externalId
              ? await this.prisma.productVariant.findFirst({
                  where: { productId: row.id, externalId: variant.externalId },
                })
              : null;
            const data = {
              productId: row.id,
              externalId: variant.externalId ?? null,
              sku: variant.sku ?? null,
              title: variant.title ?? null,
              attributes:
                (variant.attributes as Prisma.InputJsonValue) ?? undefined,
              costPrice:
                variant.costPrice != null
                  ? new Prisma.Decimal(variant.costPrice)
                  : null,
              stock: new Prisma.Decimal(variant.stock ?? 0),
              active: variant.active ?? true,
            };
            if (existing) {
              await this.prisma.productVariant.update({
                where: { id: existing.id },
                data,
              });
            } else {
              await this.prisma.productVariant.create({ data });
            }
          }
        }
        upserted += 1;
      }

      await this.prisma.catalogSyncRun.update({
        where: { id: run.id },
        data: { status: 'SYNCED', records: upserted, finishedAt: new Date() },
      });

      return {
        supplierCode: 'xnamai',
        fetched: fetched.products.length,
        upserted,
        mode: fetched.mode,
        source: fetched.source,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.catalogSyncRun.update({
        where: { id: run.id },
        data: { status: 'ERROR', error: message, finishedAt: new Date() },
      });
      return {
        supplierCode: 'xnamai',
        fetched: fetched.products.length,
        upserted,
        mode: fetched.mode,
        source: fetched.source,
        error: message,
      };
    }
  }
}
