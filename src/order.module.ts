import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order, OrderItem, Product, Store, Personnel, Customer } from './models';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { ActivityLogModule } from './activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Product, Store, Personnel, Customer]),
    ActivityLogModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
