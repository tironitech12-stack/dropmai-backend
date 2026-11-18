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

  /** Merchant panel: Xnamai catalog with optional in-stock filter. */
  @Get('suppliers/xnamai/products')
  @UseGuards(AuthGuard)
  listXnamaiProducts(
    @Query('inStock') inStock?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.suppliers.listXnamaiProducts({
      inStock: inStock === undefined ? true : inStock !== 'false' && inStock !== '0',
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }

  @Post('sync/xnamai')
  @UseGuards(AuthGuard)
  syncXnamai(@Body() body: { limit?: number; forceMock?: boolean }) {
    return this.suppliers.syncXnamai(body ?? {});
  }
}
