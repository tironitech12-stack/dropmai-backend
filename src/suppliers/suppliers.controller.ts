import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { SuppliersService } from './suppliers.service';

@Controller('api/v1')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  /**
   * Public image proxy for catalog thumbs (storefront CDN is already public).
   * Browser <img> cannot send session headers cross-origin, so this stays open.
   * Streams bytes (with CORS *) so Vercel pages never depend on redirect quirks.
   */
  @Get('suppliers/xnamai/products/:productId/image')
  @Header('Cache-Control', 'public, max-age=86400')
  async productImage(
    @Param('productId') productId: string,
    @Query('sku') sku: string | undefined,
    @Query('q') q: string | undefined,
    @Query('force') force: string | undefined,
    @Query('redirect') redirect: string | undefined,
    @Res() res: Response,
  ) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Timing-Allow-Origin', '*');

    const result = await this.suppliers.resolveProductImage(productId, {
      sku,
      q,
      force: force === '1' || force === 'true',
    });
    if (!('redirectUrl' in result)) {
      return res.status(404).json({
        message: 'Imagem não encontrada na vitrine Xnamai',
      });
    }

    // Optional redirect mode (debug); default streams the CDN bytes.
    if (redirect === '1' || redirect === 'true') {
      return res.redirect(302, result.redirectUrl);
    }

    try {
      const upstream = await fetch(result.redirectUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          Referer: 'https://xnamai.mercos.com/',
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!upstream.ok || !upstream.body) {
        return res.redirect(302, result.redirectUrl);
      }
      const contentType =
        upstream.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      const buf = Buffer.from(await upstream.arrayBuffer());
      return res.status(200).send(buf);
    } catch {
      return res.redirect(302, result.redirectUrl);
    }
  }

  /** Merchant panel: Xnamai catalog with stock/category filters + destaques. */
  @Get('suppliers/xnamai/products')
  @UseGuards(AuthGuard)
  listXnamaiProducts(
    @Query('inStock') inStock?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('categoryId') categoryId?: string,
    @Query('q') q?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedPage = page ? Number(page) : undefined;
    const parsedPageSize = pageSize ? Number(pageSize) : undefined;
    return this.suppliers.listXnamaiProducts({
      inStock:
        inStock === undefined ? true : inStock !== 'false' && inStock !== '0',
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      page: Number.isFinite(parsedPage) ? parsedPage : undefined,
      pageSize: Number.isFinite(parsedPageSize) ? parsedPageSize : undefined,
      categoryId,
      q,
    });
  }

  @Get('suppliers/xnamai/categories')
  @UseGuards(AuthGuard)
  listXnamaiCategories() {
    return this.suppliers.listXnamaiCategories();
  }

  @Post('sync/xnamai')
  @UseGuards(AuthGuard)
  syncXnamai(@Body() body: { limit?: number; forceMock?: boolean }) {
    return this.suppliers.syncXnamai(body ?? {});
  }
}
