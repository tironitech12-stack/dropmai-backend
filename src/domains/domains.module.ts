import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StoresModule } from '../stores/stores.module';
import { DomainsController } from './domains.controller';

@Module({
  imports: [AuthModule, StoresModule],
  controllers: [DomainsController],
})
export class DomainsModule {}
