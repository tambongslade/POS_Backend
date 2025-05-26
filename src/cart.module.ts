import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart, CartItem, Product, Personnel } from './models';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { ActivityLogModule } from './activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem, Product, Personnel]),
    ActivityLogModule,
  ],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
