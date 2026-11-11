import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    if (isDatabaseConfigured()) {
      await this.$connect();
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL?.trim() ?? '';
  if (!url) return false;
  if (process.env.DROPMAI_USE_MOCK === 'true') return false;
  if (url.includes('USER:PASSWORD@') || url.includes('localhost:5432/dropmai')) {
    return process.env.DROPMAI_FORCE_DB === 'true';
  }
  return true;
}
