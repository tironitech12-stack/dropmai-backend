import { Controller, Get } from '@nestjs/common';
import { isDatabaseConfigured } from './prisma/prisma.service';
import { THEME_CATALOG } from './themes/theme-catalog';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'dropmai-backend',
      mock: process.env.DROPMAI_USE_MOCK === 'true' || !isDatabaseConfigured(),
      databaseConfigured: isDatabaseConfigured(),
      themeCount: THEME_CATALOG.length,
      catalogVersion: 'thematic-v2',
      hasAmplia: THEME_CATALOG.some((t) => t.id === 'amplia'),
    };
  }
}
