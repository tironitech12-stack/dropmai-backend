import { Controller, Get } from '@nestjs/common';
import { isDatabaseConfigured } from './prisma/prisma.service';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'dropmai-backend',
      mock: process.env.DROPMAI_USE_MOCK === 'true' || !isDatabaseConfigured(),
      databaseConfigured: isDatabaseConfigured(),
    };
  }
}
