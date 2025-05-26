import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale, Order, Store, Personnel, Customer, Product } from './models';
import { SaleController } from './sale.controller';
import { SaleService } from './sale.service';
import { NotificationModule } from './notification.module';
import { ActivityLogModule } from './activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, Order, Store, Personnel, Customer, Product]),
    NotificationModule,
    ActivityLogModule,
  ],
  controllers: [SaleController],
  providers: [SaleService],
})
export class SaleModule {}
