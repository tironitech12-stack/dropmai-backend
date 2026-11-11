import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { SessionUser } from '../auth/auth.types';
import { isDatabaseConfigured, PrismaService } from '../prisma/prisma.service';
import { StoresService } from '../stores/stores.service';

type MemoryDomain = {
  id: string;
  storeId: string;
  domain: string;
  isPrimary: boolean;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'FAILED';
  verificationToken: string;
};

@Controller('api/v1')
export class DomainsController {
  private readonly memory: MemoryDomain[] = [];

  constructor(
    private readonly stores: StoresService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stores/:storeId/domains')
  @UseGuards(AuthGuard)
  async list(
    @Req() req: { user: SessionUser },
    @Param('storeId') storeId: string,
  ) {
    const store = await this.stores.getById(storeId, req.user);
    if (!store) throw new NotFoundException('Loja não encontrada');

    if (!isDatabaseConfigured()) {
      return {
        domains: this.memory.filter((d) => d.storeId === storeId),
        note: 'DNS verification stub — configure CNAME para dropmai.com.br',
      };
    }

    const domains = await this.prisma.customDomain.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
    return {
      domains,
      note: 'DNS verification stub — configure CNAME para dropmai.com.br',
    };
  }

  @Post('stores/:storeId/domains')
  @UseGuards(AuthGuard)
  async attach(
    @Req() req: { user: SessionUser },
    @Param('storeId') storeId: string,
    @Body() body: { domain?: string; isPrimary?: boolean },
  ) {
    const store = await this.stores.getById(storeId, req.user);
    if (!store) throw new NotFoundException('Loja não encontrada');

    const domain = (body.domain ?? '').trim().toLowerCase();
    if (!domain || !domain.includes('.')) {
      return { error: 'Domínio inválido' };
    }

    const token = `dropmai-verify-${Math.random().toString(36).slice(2, 10)}`;

    if (!isDatabaseConfigured()) {
      const row: MemoryDomain = {
        id: `dom-${Date.now()}`,
        storeId,
        domain,
        isPrimary: Boolean(body.isPrimary),
        verificationStatus: 'PENDING',
        verificationToken: token,
      };
      this.memory.push(row);
      return {
        domain: row,
        dns: {
          type: 'CNAME',
          host: domain,
          value: 'cname.dropmai.com.br',
          txt: `dropmai-site-verification=${token}`,
        },
      };
    }

    const row = await this.prisma.customDomain.create({
      data: {
        storeId,
        domain,
        isPrimary: Boolean(body.isPrimary),
        verificationStatus: 'PENDING',
        verificationToken: token,
      },
    });

    return {
      domain: row,
      dns: {
        type: 'CNAME',
        host: domain,
        value: 'cname.dropmai.com.br',
        txt: `dropmai-site-verification=${token}`,
      },
    };
  }

  @Get('public/domains/lookup')
  async lookup(@Query('host') hostQuery?: string) {
    const host = (hostQuery ?? '').toLowerCase();
    if (!host) return { store: null, error: 'host obrigatório' };

    if (!isDatabaseConfigured()) {
      const found = this.memory.find(
        (d) => d.domain === host && d.verificationStatus === 'VERIFIED',
      );
      return {
        store: found ? { id: found.storeId, domain: found.domain } : null,
        note: 'Custom domain mapping stub',
      };
    }

    const row = await this.prisma.customDomain.findFirst({
      where: { domain: host, verificationStatus: 'VERIFIED' },
      include: { store: true },
    });
    return {
      store: row
        ? {
            id: row.store.id,
            slug: row.store.slug,
            name: row.store.name,
            domain: row.domain,
          }
        : null,
    };
  }
}
