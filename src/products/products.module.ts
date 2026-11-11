import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StoresModule } from '../stores/stores.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { ProductsController } from './products.controller';

@Module({
  imports: [AuthModule, StoresModule, SuppliersModule],
  controllers: [ProductsController],
})
export class ProductsModule {}
