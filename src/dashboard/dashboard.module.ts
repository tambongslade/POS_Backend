import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product, Personnel, Order, Store } from '../models'; // Assuming models path
// We will import other necessary modules like ProductModule, OrderModule etc. later

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Personnel, Order, Store]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {} 