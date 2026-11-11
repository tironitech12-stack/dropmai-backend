import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isDatabaseConfigured, PrismaService } from '../prisma/prisma.service';
import { MOCK_XNAMAI_PRODUCTS } from './mock-catalog';
import type { SupplierProduct, SupplierSyncResult } from './types';
import { XnamaiCatalogAdapter } from './xnamai.adapter';

@Injectable()
export class SuppliersService {
  private readonly memoryCatalog = new Map<string, SupplierProduct>();

  constructor(private readonly prisma: PrismaService) {
    for (const p of MOCK_XNAMAI_PRODUCTS) {
      this.memoryCatalog.set(p.externalId, p);
    }
  }

  getMemoryCatalog(): SupplierProduct[] {
    return Array.from(this.memoryCatalog.values());
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
