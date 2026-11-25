import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import type { SessionUser } from '../auth/auth.types';
import { isDatabaseConfigured, PrismaService } from '../prisma/prisma.service';
import { StoresService } from '../stores/stores.service';
import { SuppliersService } from '../suppliers/suppliers.service';

type ImportBody = {
  /** Internal Dropmai product id (after sync) */
  productId?: string;
  /** Xnamai / Mercos external id — preferred for catalog import */
  externalId?: string;
  sku?: string | null;
  title?: string;
  description?: string | null;
  costPrice?: number;
  stock?: number;
  categoryName?: string | null;
  imageUrl?: string | null;
  /** Fixed sale price in BRL */
  sellPrice?: number;
  /** Markup % over supplier cost */
  markupPercent?: number;
  /** How the seller chose the price in the UI */
  priceMode?: 'markup' | 'fixed';
  publishedOnSite?: boolean;
};

type MemoryListing = {
  id: string;
  storeId: string;
  productId: string;
  externalId: string;
  sku: string | null;
  title: string;
  description: string | null;
  costPrice: number;
  sellPrice: number;
  markupPercent: number | null;
  stock: number;
  categoryName: string | null;
  imageUrl: string | null;
  publishedOnSite: boolean;
  active: boolean;
  createdAt: string;
};

@Controller('api/v1')
export class ProductsController {
  /** In-memory imports when DATABASE_URL is missing — survives until process restart. */
  private readonly memoryListings = new Map<string, MemoryListing[]>();

  constructor(
    private readonly stores: StoresService,
    private readonly suppliers: SuppliersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stores/:storeId/products')
  @UseGuards(AuthGuard)
  async listForStore(
    @Req() req: { user: SessionUser },
    @Param('storeId') storeId: string,
  ) {
    const store = await this.stores.getById(storeId, req.user);
    if (!store) throw new NotFoundException('Loja não encontrada');

    if (!isDatabaseConfigured()) {
      const imported = this.memoryListings.get(storeId) ?? [];
      const catalog = this.suppliers.getMemoryCatalog();
      const byExternal = new Map(imported.map((l) => [l.externalId, l]));

      const fromCatalog = catalog.map((p) => {
        const listing = byExternal.get(p.externalId);
        return {
          id: listing?.productId ?? p.externalId,
          externalId: p.externalId,
          sku: p.sku,
          title: listing?.title ?? p.title,
          description: listing?.description ?? p.description ?? null,
          costPrice: listing?.costPrice ?? p.costPrice,
          stock: listing?.stock ?? p.stock,
          active: p.active,
          categoryName: listing?.categoryName ?? p.categoryName,
          publishedOnSite: listing?.publishedOnSite ?? false,
          sellPrice:
            listing?.sellPrice ??
            Number((p.costPrice * 1.35).toFixed(2)),
          storeProductId: listing?.id ?? null,
          markupPercent: listing?.markupPercent ?? 35,
        };
      });

      // Imported items that are not in the mock catalog
      const extras = imported
        .filter((l) => !catalog.some((p) => p.externalId === l.externalId))
        .map((l) => ({
          id: l.productId,
          externalId: l.externalId,
          sku: l.sku,
          title: l.title,
          description: l.description,
          costPrice: l.costPrice,
          stock: l.stock,
          active: l.active,
          categoryName: l.categoryName,
          publishedOnSite: l.publishedOnSite,
          sellPrice: l.sellPrice,
          storeProductId: l.id,
          markupPercent: l.markupPercent,
        }));

      return {
        storeId,
        mode: 'memory',
        products: [...extras, ...fromCatalog],
      };
    }

    const products = await this.prisma.product.findMany({
      where: { supplier: { code: 'xnamai' } },
      include: { storeProducts: { where: { storeId } } },
      orderBy: { title: 'asc' },
      take: 200,
    });

    return {
      storeId,
      mode: 'database',
      products: products.map((p) => {
        const listing = p.storeProducts[0];
        return {
          id: p.id,
          externalId: p.externalId,
          sku: p.sku,
          title: listing?.titleOverride || p.title,
          description: p.description,
          costPrice: Number(p.costPrice),
          stock: Number(p.stock),
          active: p.active,
          categoryName: p.categoryName,
          publishedOnSite: listing?.publishedOnSite ?? false,
          sellPrice: listing
            ? Number(listing.sellPrice)
            : Number((Number(p.costPrice) * 1.35).toFixed(2)),
          storeProductId: listing?.id ?? null,
          markupPercent: listing?.markupPercent
            ? Number(listing.markupPercent)
            : null,
        };
      }),
    };
  }

  @Post('stores/:storeId/products')
  @UseGuards(AuthGuard)
  async publish(
    @Req() req: { user: SessionUser },
    @Param('storeId') storeId: string,
    @Body() body: ImportBody,
  ) {
    const store = await this.stores.getById(storeId, req.user);
    if (!store) throw new NotFoundException('Loja não encontrada');

    return this.importProduct(storeId, body);
  }

  /** Explicit import endpoint used by the Xnamai catalog modal. */
  @Post('stores/:storeId/products/import')
  @UseGuards(AuthGuard)
  async import(
    @Req() req: { user: SessionUser },
    @Param('storeId') storeId: string,
    @Body() body: ImportBody,
  ) {
    const store = await this.stores.getById(storeId, req.user);
    if (!store) throw new NotFoundException('Loja não encontrada');

    return this.importProduct(storeId, body);
  }

  private resolvePricing(body: ImportBody, costPrice: number) {
    const cost = Number.isFinite(costPrice) ? costPrice : 0;
    const mode =
      body.priceMode === 'fixed' ||
      (body.sellPrice != null && body.markupPercent == null)
        ? 'fixed'
        : 'markup';

    if (mode === 'fixed') {
      const sellPrice = Number(
        Number(body.sellPrice ?? cost * 1.35).toFixed(2),
      );
      const markupPercent =
        cost > 0
          ? Number((((sellPrice - cost) / cost) * 100).toFixed(4))
          : null;
      return { sellPrice, markupPercent, priceMode: 'fixed' as const };
    }

    const markupPercent = Number(
      body.markupPercent != null && Number.isFinite(body.markupPercent)
        ? body.markupPercent
        : 35,
    );
    const sellPrice = Number((cost * (1 + markupPercent / 100)).toFixed(2));
    return { sellPrice, markupPercent, priceMode: 'markup' as const };
  }

  private async importProduct(storeId: string, body: ImportBody) {
    const externalId = (body.externalId || body.productId || '').trim();
    if (!externalId && !body.productId) {
      return { error: 'externalId ou productId obrigatório' };
    }

    if (!isDatabaseConfigured()) {
      const costPrice = Number(body.costPrice ?? 0);
      const { sellPrice, markupPercent, priceMode } = this.resolvePricing(
        body,
        costPrice,
      );
      const title = (body.title || 'Produto Xnamai').trim();
      const listing: MemoryListing = {
        id: `spl-${storeId}-${externalId || body.productId}`,
        storeId,
        productId: `mem-${externalId || body.productId}`,
        externalId: externalId || String(body.productId),
        sku: body.sku ?? null,
        title,
        description: body.description?.trim() || null,
        costPrice,
        sellPrice,
        markupPercent,
        stock: Number(body.stock ?? 0),
        categoryName: body.categoryName ?? null,
        imageUrl: body.imageUrl ?? null,
        publishedOnSite: body.publishedOnSite ?? true,
        active: true,
        createdAt: new Date().toISOString(),
      };

      const list = this.memoryListings.get(storeId) ?? [];
      const idx = list.findIndex((l) => l.externalId === listing.externalId);
      if (idx >= 0) list[idx] = listing;
      else list.unshift(listing);
      this.memoryListings.set(storeId, list);

      return {
        ok: true,
        mode: 'memory',
        priceMode,
        listing: {
          id: listing.id,
          storeId,
          productId: listing.productId,
          sellPrice: listing.sellPrice,
          markupPercent: listing.markupPercent,
          publishedOnSite: listing.publishedOnSite,
          title: listing.title,
          costPrice: listing.costPrice,
          profit: Number((listing.sellPrice - listing.costPrice).toFixed(2)),
        },
        message:
          'Importado em memória (sem PostgreSQL). Com DATABASE_URL a listagem persiste no banco.',
      };
    }

    const supplier = await this.prisma.supplier.upsert({
      where: { code: 'xnamai' },
      create: { code: 'xnamai', name: 'Xnamai', active: true },
      update: { active: true },
    });

    let product =
      body.productId && !body.externalId
        ? await this.prisma.product.findUnique({ where: { id: body.productId } })
        : null;

    if (!product && externalId) {
      product = await this.prisma.product.findUnique({
        where: {
          supplierId_externalId: {
            supplierId: supplier.id,
            externalId,
          },
        },
      });
    }

    if (!product) {
      if (!body.title && !externalId) {
        throw new NotFoundException('Produto não encontrado');
      }
      const costPrice = Number(body.costPrice ?? 0);
      product = await this.prisma.product.create({
        data: {
          supplierId: supplier.id,
          externalId: externalId || `manual-${Date.now()}`,
          sku: body.sku ?? null,
          title: (body.title || 'Produto Xnamai').trim(),
          description: body.description?.trim() || null,
          categoryName: body.categoryName ?? null,
          costPrice: new Prisma.Decimal(costPrice),
          stock: new Prisma.Decimal(Number(body.stock ?? 0)),
          imageUrls: body.imageUrl ? [body.imageUrl] : [],
          active: true,
        },
      });
    } else {
      // Refresh snapshot from catalog when importing
      product = await this.prisma.product.update({
        where: { id: product.id },
        data: {
          ...(body.title ? { title: body.title.trim() } : {}),
          ...(body.description !== undefined
            ? { description: body.description?.trim() || null }
            : {}),
          ...(body.sku !== undefined ? { sku: body.sku } : {}),
          ...(body.categoryName !== undefined
            ? { categoryName: body.categoryName }
            : {}),
          ...(body.costPrice != null
            ? { costPrice: new Prisma.Decimal(Number(body.costPrice)) }
            : {}),
          ...(body.stock != null
            ? { stock: new Prisma.Decimal(Number(body.stock)) }
            : {}),
          ...(body.imageUrl ? { imageUrls: [body.imageUrl] } : {}),
          lastSyncedAt: new Date(),
        },
      });
    }

    const costPrice = Number(product.costPrice);
    const { sellPrice, markupPercent, priceMode } = this.resolvePricing(
      body,
      costPrice,
    );

    const listing = await this.prisma.storeProduct.upsert({
      where: { storeId_productId: { storeId, productId: product.id } },
      create: {
        storeId,
        productId: product.id,
        sellPrice: new Prisma.Decimal(sellPrice),
        markupPercent:
          markupPercent != null ? new Prisma.Decimal(markupPercent) : null,
        publishedOnSite: body.publishedOnSite ?? true,
      },
      update: {
        sellPrice: new Prisma.Decimal(sellPrice),
        markupPercent:
          markupPercent != null
            ? new Prisma.Decimal(markupPercent)
            : undefined,
        publishedOnSite: body.publishedOnSite ?? true,
      },
    });

    return {
      ok: true,
      mode: 'database',
      priceMode,
      listing: {
        id: listing.id,
        storeId: listing.storeId,
        productId: listing.productId,
        sellPrice: Number(listing.sellPrice),
        markupPercent: listing.markupPercent
          ? Number(listing.markupPercent)
          : null,
        publishedOnSite: listing.publishedOnSite,
        title: product.title,
        costPrice,
        profit: Number((sellPrice - costPrice).toFixed(2)),
      },
    };
  }

  @Get('public/stores/:slug/products')
  async publicProducts(@Param('slug') slug: string) {
    const store = await this.stores.getBySlug(slug);
    if (!store) throw new NotFoundException('Loja não encontrada');

    if (!isDatabaseConfigured()) {
      const imported = this.memoryListings.get(store.id) ?? [];
      if (imported.length > 0) {
        return {
          store,
          products: imported
            .filter((l) => l.publishedOnSite && l.active)
            .map((l) => ({
              id: l.id,
              title: l.title,
              sku: l.sku ?? l.externalId,
              sellPrice: l.sellPrice,
              stock: l.stock,
            })),
        };
      }
      return {
        store,
        products: this.suppliers
          .getMemoryCatalog()
          .filter((p) => p.active)
          .map((p) => ({
            id: p.externalId,
            title: p.title,
            sku: p.sku ?? p.externalId,
            sellPrice: Number((p.costPrice * 1.35).toFixed(2)),
            stock: p.stock,
          })),
      };
    }

    const listings = await this.prisma.storeProduct.findMany({
      where: { storeId: store.id, publishedOnSite: true, active: true },
      include: { product: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    if (listings.length > 0) {
      return {
        store,
        products: listings.map((l) => ({
          id: l.id,
          title: l.titleOverride || l.product.title,
          sku: l.product.sku ?? l.product.externalId,
          sellPrice: Number(l.sellPrice),
          stock: Number(l.product.stock),
        })),
      };
    }

    const catalog = await this.prisma.product.findMany({
      where: { active: true, supplier: { code: 'xnamai' } },
      take: 24,
      orderBy: { title: 'asc' },
    });

    return {
      store,
      products: catalog.map((p) => ({
        id: p.id,
        title: p.title,
        sku: p.sku ?? p.externalId,
        sellPrice: Number((Number(p.costPrice) * 1.35).toFixed(2)),
        stock: Number(p.stock),
      })),
    };
  }
}
