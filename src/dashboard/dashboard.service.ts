import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, Personnel, Order, Store } from '../models'; // Assuming models path

export interface SummaryStats {
  totalSales: number;
  totalSalesByStore: Array<{ storeId: number; storeName: string; totalSales: number }>;
  totalProducts: number;
  totalEmployees: number;
  totalOrders: number;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Personnel)
    private personnelRepository: Repository<Personnel>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
  ) {}

  async getSummaryStats(): Promise<SummaryStats> {
    this.logger.log('Fetching summary stats...');

    const totalProducts = await this.productRepository.count();
    const totalEmployees = await this.personnelRepository.count();
    const totalOrders = await this.orderRepository.count();

    const totalSalesResult = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.total_amount)', 'total')
      .getRawOne();
    const totalSales = parseFloat(totalSalesResult?.total) || 0;

    const salesByStoreRaw = await this.orderRepository
      .createQueryBuilder('order')
      .innerJoin('order.store', 'store') // Assumes 'store' relation in Order entity
      .select('store.id', 'storeId')
      .addSelect('store.name', 'storeName')
      .addSelect('SUM(order.total_amount)', 'totalSalesForStore')
      .groupBy('store.id')
      .addGroupBy('store.name')
      .orderBy('store.name')
      .getRawMany();
      
    const totalSalesByStore = salesByStoreRaw.map(s => ({
      storeId: s.storeId,
      storeName: s.storeName,
      totalSales: parseFloat(s.totalSalesForStore) || 0,
    }));

    return {
      totalSales,
      totalSalesByStore,
      totalProducts,
      totalEmployees,
      totalOrders,
    };
  }
}
