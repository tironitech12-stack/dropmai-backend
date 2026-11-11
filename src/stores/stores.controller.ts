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
import { StoresService } from './stores.service';

@Controller('api/v1')
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get('stores')
  @UseGuards(AuthGuard)
  list(@Req() req: { user: SessionUser }) {
    return this.stores.listForUser(req.user).then((stores) => ({ stores }));
  }

  @Post('stores')
  @UseGuards(AuthGuard)
  create(
    @Req() req: { user: SessionUser },
    @Body() body: { name?: string; slug?: string; description?: string },
  ) {
    if (!body.name?.trim() || !body.slug?.trim()) {
      return { error: 'Nome e slug (subdomínio) são obrigatórios' };
    }
    return this.stores
      .create(req.user, {
        name: body.name,
        slug: body.slug,
        description: body.description,
      })
      .then((store) => ({ store }));
  }

  @Get('stores/:storeId')
  @UseGuards(AuthGuard)
  async getOne(
    @Req() req: { user: SessionUser },
    @Param('storeId') storeId: string,
  ) {
    const store = await this.stores.getById(storeId, req.user);
    if (!store) throw new NotFoundException('Loja não encontrada');
    return { store };
  }

  /** Public storefront lookup by slug */
  @Get('public/stores/:slug')
  async publicBySlug(@Param('slug') slug: string) {
    const store = await this.stores.getBySlug(slug);
    if (!store) throw new NotFoundException('Loja não encontrada');
    return { store };
  }
}
