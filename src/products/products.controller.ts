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

@Controller('api/v1')
export class ProductsController {
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
      const catalog = this.suppliers.getMemoryCatalog();
      return {
        storeId,
        mode: 'memory',
        products: catalog.map((p) => ({
          id: p.externalId,
          externalId: p.externalId,
          sku: p.sku,
          title: p.title,
          costPrice: p.costPrice,
          stock: p.stock,
          active: p.active,
          categoryName: p.categoryName,
          publishedOnSite: false,
          sellPrice: Number((p.costPrice * 1.35).toFixed(2)),
        })),
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
          costPrice: Number(p.costPrice),
          stock: Number(p.stock),
          active: p.active,
          categoryName: p.categoryName,
          publishedOnSite: listing?.publishedOnSite ?? false,
          sellPrice: listing
            ? Number(listing.sellPrice)
            : Number((Number(p.costPrice) * 1.35).toFixed(2)),
          storeProductId: listing?.id ?? null,
        };
      }),
    };
  }

  @Post('stores/:storeId/products')
  @UseGuards(AuthGuard)
  async publish(
    @Req() req: { user: SessionUser },
    @Param('storeId') storeId: string,
    @Body()
    body: {
      productId?: string;
      sellPrice?: number;
      publishedOnSite?: boolean;
      markupPercent?: number;
    },
  ) {
    const store = await this.stores.getById(storeId, req.user);
    if (!store) throw new NotFoundException('Loja não encontrada');

    if (!isDatabaseConfigured()) {
      return {
        ok: true,
        mode: 'memory',
        message:
          'Sem PostgreSQL: publicação em memória não é persistida. Configure DATABASE_URL.',
      };
    }

    if (!body.productId) {
      return { error: 'productId obrigatório' };
    }

    const product = await this.prisma.product.findUnique({
      where: { id: body.productId },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');

    const sellPrice =
      body.sellPrice ??
      Number(product.costPrice) *
        (1 + (body.markupPercent != null ? body.markupPercent / 100 : 0.35));

    const listing = await this.prisma.storeProduct.upsert({
      where: { storeId_productId: { storeId, productId: product.id } },
      create: {
        storeId,
        productId: product.id,
        sellPrice: new Prisma.Decimal(sellPrice),
        markupPercent:
          body.markupPercent != null
            ? new Prisma.Decimal(body.markupPercent)
            : null,
        publishedOnSite: body.publishedOnSite ?? true,
      },
      update: {
        sellPrice: new Prisma.Decimal(sellPrice),
        markupPercent:
          body.markupPercent != null
            ? new Prisma.Decimal(body.markupPercent)
            : undefined,
        publishedOnSite: body.publishedOnSite ?? true,
      },
    });

    return { listing };
  }

  @Get('public/stores/:slug/products')
  async publicProducts(@Param('slug') slug: string) {
    const store = await this.stores.getBySlug(slug);
    if (!store) throw new NotFoundException('Loja não encontrada');

    if (!isDatabaseConfigured()) {
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
