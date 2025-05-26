import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product, Store } from './models'; // Import Product and Store entities
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ActivityLogModule } from './activity-log/activity-log.module'; // Import ActivityLogModule

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Store]),
    ActivityLogModule, // Add ActivityLogModule
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService] // Export ProductService
})
export class ProductModule {}
