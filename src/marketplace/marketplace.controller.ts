import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import type { SessionUser } from '../auth/auth.types';
import { StoresService } from '../stores/stores.service';
import { MarketplaceService } from './marketplace.service';

/**
 * Marketplace connect stubs — ML / Shopee OAuth + listing sync later.
 * Credentials only from env; never invent secrets or fake "connected".
 */
@Controller('api/v1')
export class MarketplaceController {
  constructor(
    private readonly stores: StoresService,
    private readonly marketplaces: MarketplaceService,
  ) {}

  @Get('stores/:storeId/marketplaces')
  @UseGuards(AuthGuard)
  async listAccounts(
    @Req() req: { user: SessionUser },
    @Param('storeId') storeId: string,
  ) {
    const store = await this.stores.getById(storeId, req.user);
    if (!store) throw new NotFoundException('Loja não encontrada');

    const { accounts, phase } = await this.marketplaces.listForStore(storeId);
    return {
      storeId,
      accounts,
      phase,
      note: 'Fase connect: OAuth stub. Sync de anúncios/estoque/pedidos ainda não implementado.',
    };
  }

  @Post('stores/:storeId/marketplaces/:channel/connect')
  @UseGuards(AuthGuard)
  async connect(
    @Req() req: { user: SessionUser },
    @Param('storeId') storeId: string,
    @Param('channel') channelRaw: string,
  ) {
    const store = await this.stores.getById(storeId, req.user);
    if (!store) throw new NotFoundException('Loja não encontrada');

    const channel = this.marketplaces.parseChannel(channelRaw);
    if (!channel) {
      throw new BadRequestException(
        'Canal inválido. Use mercado_livre ou shopee.',
      );
    }

    return this.marketplaces.beginConnect(storeId, req.user, channel);
  }

  @Post('stores/:storeId/marketplaces/:channel/disconnect')
  @UseGuards(AuthGuard)
  async disconnect(
    @Req() req: { user: SessionUser },
    @Param('storeId') storeId: string,
    @Param('channel') channelRaw: string,
  ) {
    const store = await this.stores.getById(storeId, req.user);
    if (!store) throw new NotFoundException('Loja não encontrada');

    const channel = this.marketplaces.parseChannel(channelRaw);
    if (!channel) {
      throw new BadRequestException(
        'Canal inválido. Use mercado_livre ou shopee.',
      );
    }

    return this.marketplaces.disconnect(storeId, channel);
  }

  @Get('marketplaces/mercado_livre/callback')
  async mlCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const { redirectTo } = await this.marketplaces.handleCallbackStub(
      'MERCADO_LIVRE',
      { code, state, error },
    );
    return res.redirect(redirectTo);
  }

  @Get('marketplaces/shopee/callback')
  async shopeeCallback(
    @Query('code') code: string | undefined,
    @Query('shop_id') shopId: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const { redirectTo } = await this.marketplaces.handleCallbackStub('SHOPEE', {
      code,
      shop_id: shopId,
      state,
      error,
    });
    return res.redirect(redirectTo);
  }

  @Post('stores/:storeId/marketplaces/:channel/listings')
  @UseGuards(AuthGuard)
  async publishStub(
    @Req() req: { user: SessionUser },
    @Param('storeId') storeId: string,
    @Param('channel') channelRaw: string,
  ) {
    const store = await this.stores.getById(storeId, req.user);
    if (!store) throw new NotFoundException('Loja não encontrada');

    const channel = this.marketplaces.parseChannel(channelRaw);
    if (!channel) {
      throw new BadRequestException(
        'Canal inválido. Use mercado_livre ou shopee.',
      );
    }

    return {
      ok: false,
      channel,
      message:
        'Publicação de anúncios ainda não implementada. Conecte a conta primeiro (fase A).',
    };
  }
}
