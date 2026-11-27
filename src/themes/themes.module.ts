import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StoresModule } from '../stores/stores.module';
import { ThemesController } from './themes.controller';

@Module({
  imports: [AuthModule, StoresModule],
  controllers: [ThemesController],
})
export class ThemesModule {}
