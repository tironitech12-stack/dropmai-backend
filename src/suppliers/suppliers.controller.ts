import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { SuppliersService } from './suppliers.service';

@Controller('api/v1')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

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
