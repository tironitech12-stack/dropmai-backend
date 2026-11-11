import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StoresModule } from '../stores/stores.module';
import { MarketplaceController } from './marketplace.controller';

@Module({
  imports: [AuthModule, StoresModule],
  controllers: [MarketplaceController],
})
export class MarketplaceModule {}
