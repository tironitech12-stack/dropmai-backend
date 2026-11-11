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
import { AuthGuard } from '../auth/auth.guard';
import type { SessionUser } from '../auth/auth.types';
import { StoresService } from '../stores/stores.service';

/**
 * Marketplace stubs — ML / Shopee / Amazon OAuth + listing sync later.
 */
@Controller('api/v1')
export class MarketplaceController {
  constructor(private readonly stores: StoresService) {}

  @Get('stores/:storeId/marketplaces')
  @UseGuards(AuthGuard)
  async listAccounts(
    @Req() req: { user: SessionUser },
    @Param('storeId') storeId: string,
  ) {
    const store = await this.stores.getById(storeId, req.user);
    if (!store) throw new NotFoundException('Loja não encontrada');

    return {
      accounts: [
        {
          channel: 'MERCADO_LIVRE',
          status: 'not_connected',
          label: 'Mercado Livre',
        },
        { channel: 'SHOPEE', status: 'not_connected', label: 'Shopee' },
        { channel: 'AMAZON', status: 'not_connected', label: 'Amazon' },
      ],
      note: 'Stub: OAuth e publicação entram no roadmap.',
    };
  }

  @Post('stores/:storeId/marketplaces/:channel/connect')
  @UseGuards(AuthGuard)
  async connectStub(
    @Req() req: { user: SessionUser },
    @Param('storeId') storeId: string,
    @Param('channel') channel: string,
    @Body() _body: Record<string, unknown>,
  ) {
    const store = await this.stores.getById(storeId, req.user);
    if (!store) throw new NotFoundException('Loja não encontrada');
    return {
      ok: false,
      channel: channel.toUpperCase(),
      message: 'Conexão de marketplace ainda não implementada (stub).',
    };
  }

  @Post('stores/:storeId/marketplaces/:channel/listings')
  @UseGuards(AuthGuard)
  async publishStub(
    @Req() req: { user: SessionUser },
    @Param('storeId') storeId: string,
    @Param('channel') channel: string,
    @Body() body: { storeProductId?: string },
  ) {
    const store = await this.stores.getById(storeId, req.user);
    if (!store) throw new NotFoundException('Loja não encontrada');
    return {
      ok: false,
      channel: channel.toUpperCase(),
      storeProductId: body.storeProductId ?? null,
      message: 'Publicação em marketplace ainda não implementada (stub).',
    };
  }
}
