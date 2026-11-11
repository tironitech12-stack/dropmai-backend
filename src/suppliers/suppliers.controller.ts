import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { SuppliersService } from './suppliers.service';

@Controller('api/v1/sync')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Post('xnamai')
  @UseGuards(AuthGuard)
  syncXnamai(@Body() body: { limit?: number; forceMock?: boolean }) {
    return this.suppliers.syncXnamai(body ?? {});
  }
}
