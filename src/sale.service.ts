import { Injectable, NotFoundException, ConflictException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsWhere, Between, Like, SelectQueryBuilder } from 'typeorm';
import { Sale, Order, Store, Personnel, Customer, Product } from './models';
import { CreateSaleDto } from './sale/dto';
import { NotificationService } from './notification.service';
import { ActivityLogService, LogPayload } from './activity-log/activity-log.service';
import { PaginatedSalesResponse, SalesAnalyticsResponse } from './sale.controller';

// Define order statuses that are considered final or eligible for sale processing
const FINALIZED_ORDER_STATUSES = ['Completed', 'Paid']; // Example, adjust as needed
const CANCELLED_ORDER_STATUS = 'Cancelled';
const DEFAULT_COMPLETED_SALE_ORDER_STATUS = 'Completed'; // Status to set order to after sale

export interface SalesFilterOptions {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  startDate?: Date;
  endDate?: Date;
  store?: string;
  category?: string;
  search?: string;
  // Legacy support
  storeId?: number;
  personnelId?: number;
  customerId?: number;
}

export interface AnalyticsFilterOptions {
  timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate?: Date;
  endDate?: Date;
  store?: string;
}

@Injectable()
export class SaleService {
  private readonly logger = new Logger(SaleService.name);

  constructor(
    @InjectRepository(Sale) private readonly saleRepository: Repository<Sale>,
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async createSale(createSaleDto: CreateSaleDto): Promise<Sale> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let saleDetailsForNotification: Sale | null = null;
    let savedSaleForLog: Sale | null = null;

    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: createSaleDto.orderId },
        relations: ['store', 'user', 'customer'],
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${createSaleDto.orderId} not found.`);
      }

      // Check if a sale already exists for this order
      const existingSale = await queryRunner.manager.findOneBy(Sale, { orderId: createSaleDto.orderId });
      if (existingSale) {
        throw new ConflictException(`A sale already exists for order ID ${createSaleDto.orderId}.`);
      }

      // Validate order status (e.g., ensure it's not cancelled or already completed by other means)
      if (order.status === CANCELLED_ORDER_STATUS) {
        throw new BadRequestException(`Order ID ${createSaleDto.orderId} is cancelled and cannot be processed for sale.`);
      }
      // Add more status checks if needed, e.g. if (FINALIZED_ORDER_STATUSES.includes(order.status)) throw new BadRequestException(...)

      // Ensure amountPaid matches order.totalAmount
      if (createSaleDto.amountPaid !== order.totalAmount) {
        // For now, strict match. Business logic might allow partial payments or overpayments with different handling.
        this.logger.warn(`Sale amount ${createSaleDto.amountPaid} for order ${order.id} does not match order total ${order.totalAmount}. Proceeding, but review business rules.`);
        // Potentially throw BadRequestException here if amounts must match exactly.
      }

      const newSaleEntity = queryRunner.manager.create(Sale, {
        order: order,
        orderId: order.id,
        transactionId: createSaleDto.transactionId,
        paymentMethodReceived: createSaleDto.paymentMethodReceived,
        amountPaid: createSaleDto.amountPaid,
        notes: createSaleDto.notes,
        // Denormalize store, personnel, customer from the order for easier sale reporting
        store: order.store,
        storeId: order.storeId,
        personnel: order.user, // Assuming order.user is the personnel who processed
        personnelId: order.userId,
        customer: order.customer,
        customerId: order.customerId,
      });

      savedSaleForLog = await queryRunner.manager.save(Sale, newSaleEntity);

      // Update the order status to completed (or relevant final status)
      order.status = DEFAULT_COMPLETED_SALE_ORDER_STATUS;
      await queryRunner.manager.save(Order, order);

      await queryRunner.commitTransaction();
      
      // Fetch complete sale details for notification after successful commit
      saleDetailsForNotification = await this.findOne(savedSaleForLog.id);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      this.logger.error('Error in createSale transaction:', error.stack);
      throw new InternalServerErrorException('Failed to create sale.');
    } finally {
      await queryRunner.release();
    }

    if (savedSaleForLog) {
      const logPayload: LogPayload = {
        userId: savedSaleForLog.personnelId,
        action: 'CREATE_SALE',
        details: `Sale ID ${savedSaleForLog.id} created for Order ID ${savedSaleForLog.orderId}. Amount: ${savedSaleForLog.amountPaid}, Method: ${savedSaleForLog.paymentMethodReceived}.`,
        entityType: 'Sale',
        entityId: savedSaleForLog.id,
        storeId: savedSaleForLog.storeId,
      };
      try { await this.activityLogService.createLog(logPayload); } catch (e) { this.logger.error('Sale activity logging failed', e.stack); }
    }

    // Send notification outside of the transaction
    if (saleDetailsForNotification) {
      try {
        // await this.notificationService.sendSaleInvoice(saleDetailsForNotification); // Temporarily commented out
        this.logger.log(`Sale invoice notification process would have been initiated for Sale ID: ${saleDetailsForNotification.id} (currently deactivated).`); // Updated log
      } catch (notificationError) {
        this.logger.error(
          `Error during (deactivated) notification initiation for Sale ID: ${saleDetailsForNotification.id}`,
          notificationError.stack,
        );
        // Do not re-throw here to let the sale creation succeed even if notification fails init
      }
    }
    return saleDetailsForNotification; // Return the created and fetched sale
  }

  async findAllPaginated(options: SalesFilterOptions): Promise<PaginatedSalesResponse> {
    const queryBuilder = this.createSalesQueryBuilder();
    
    // Apply filters
    this.applySalesFilters(queryBuilder, options);
    
    // Apply sorting
    this.applySalesSorting(queryBuilder, options.sortBy, options.sortOrder);
    
    // Get total count before pagination
    const total = await queryBuilder.getCount();
    
    // Apply pagination
    const offset = (options.page - 1) * options.limit;
    queryBuilder.skip(offset).take(options.limit);
    
    // Execute query
    const sales = await queryBuilder.getMany();
    
    // Transform data for frontend
    const transformedSales = await this.transformSalesData(sales);
    
    return {
      sales: transformedSales,
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit),
    };
  }

  async getAnalytics(options: AnalyticsFilterOptions): Promise<SalesAnalyticsResponse> {
    const { startDate, endDate } = this.getDateRange(options.timeframe, options.startDate, options.endDate);
    
    // Get current period data
    const currentPeriodData = await this.getAnalyticsData(startDate, endDate, options.store);
    
    // Get previous period data for comparison
    const periodDuration = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodDuration);
    const previousEndDate = new Date(startDate.getTime() - 1);
    const previousPeriodData = await this.getAnalyticsData(previousStartDate, previousEndDate, options.store);
    
    // Calculate percentage changes
    const percentChanges = this.calculatePercentChanges(currentPeriodData.summary, previousPeriodData.summary);
    
    return {
      summary: {
        ...currentPeriodData.summary,
        percentChanges,
      },
      salesByStore: currentPeriodData.salesByStore,
      salesByCategory: currentPeriodData.salesByCategory,
      recentSales: currentPeriodData.recentSales,
    };
  }

  private createSalesQueryBuilder(): SelectQueryBuilder<Sale> {
    return this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.order', 'order')
      .leftJoinAndSelect('sale.store', 'store')
      .leftJoinAndSelect('sale.personnel', 'personnel')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('order.items', 'orderItems')
      .leftJoinAndSelect('orderItems.product', 'product');
  }

  private applySalesFilters(queryBuilder: SelectQueryBuilder<Sale>, options: SalesFilterOptions): void {
    // Date filters
    if (options.startDate && options.endDate) {
      queryBuilder.andWhere('sale.createdAt BETWEEN :startDate AND :endDate', {
        startDate: options.startDate,
        endDate: options.endDate,
      });
    } else if (options.startDate) {
      queryBuilder.andWhere('sale.createdAt >= :startDate', { startDate: options.startDate });
    } else if (options.endDate) {
      queryBuilder.andWhere('sale.createdAt <= :endDate', { endDate: options.endDate });
    }

    // Store filter
    if (options.store) {
      queryBuilder.andWhere('store.name ILIKE :store', { store: `%${options.store}%` });
    }

    // Category filter
    if (options.category) {
      queryBuilder.andWhere('product.category = :category', { category: options.category });
    }

    // Search filter (product name, customer name, or email)
    if (options.search) {
      queryBuilder.andWhere(
        '(product.name ILIKE :search OR customer.firstName ILIKE :search OR customer.lastName ILIKE :search OR customer.email ILIKE :search)',
        { search: `%${options.search}%` }
      );
    }

    // Legacy filters for backward compatibility
    if (options.storeId) {
      queryBuilder.andWhere('sale.storeId = :storeId', { storeId: options.storeId });
    }
    if (options.personnelId) {
      queryBuilder.andWhere('sale.personnelId = :personnelId', { personnelId: options.personnelId });
    }
    if (options.customerId) {
      queryBuilder.andWhere('sale.customerId = :customerId', { customerId: options.customerId });
    }
  }

  private applySalesSorting(queryBuilder: SelectQueryBuilder<Sale>, sortBy: string, sortOrder: 'asc' | 'desc'): void {
    const sortMap: { [key: string]: string } = {
      'created_at': 'sale.createdAt',
      'createdAt': 'sale.createdAt',
      'total_amount': 'sale.amountPaid',
      'totalAmount': 'sale.amountPaid',
      'amountPaid': 'sale.amountPaid',
      'customer_name': 'customer.firstName',
      'customerName': 'customer.firstName',
      'store_name': 'store.name',
      'storeName': 'store.name',
      'payment_method': 'sale.paymentMethodReceived',
      'paymentMethod': 'sale.paymentMethodReceived',
    };

    const sortField = sortMap[sortBy] || 'sale.createdAt';
    queryBuilder.orderBy(sortField, sortOrder.toUpperCase() as 'ASC' | 'DESC');
  }

  private async transformSalesData(sales: Sale[]): Promise<any[]> {
    return sales.map(sale => {
      const orderItems = sale.order?.items || [];
      const primaryProduct = orderItems.length > 0 ? orderItems[0].product?.name : 'N/A';
      const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0);
      
      // Calculate profit (simplified - you may need more complex logic)
      const profit = orderItems.reduce((sum, item) => {
        const costPrice = item.product?.cost_price || 0;
        const sellingPrice = item.unitPrice;
        const itemProfit = (sellingPrice - costPrice) * item.quantity;
        return sum + itemProfit;
      }, 0);

      const customerName = sale.customer 
        ? `${sale.customer.firstName || ''} ${sale.customer.lastName || ''}`.trim()
        : 'Walk-in Customer';

      return {
        id: sale.id,
        created_at: sale.createdAt,
        total_amount: sale.amountPaid,
        profit: profit,
        customer_name: customerName,
        customer_email: sale.customer?.email || '',
        cashier_name: sale.personnel 
          ? `${sale.personnel.firstName || ''} ${sale.personnel.lastName || ''}`.trim()
          : 'Unknown',
        store_name: sale.store?.name || 'Unknown Store',
        primaryProduct,
        totalItems,
        payment_method: sale.paymentMethodReceived,
      };
    });
  }

  private getDateRange(timeframe: string, startDate?: Date, endDate?: Date): { startDate: Date; endDate: Date } {
    if (startDate && endDate) {
      return { startDate, endDate };
    }

    const now = new Date();
    let calculatedStartDate: Date;

    switch (timeframe) {
      case 'daily':
        calculatedStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        break;
      case 'weekly':
        calculatedStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 84); // 12 weeks
        break;
      case 'yearly':
        calculatedStartDate = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
        break;
      case 'monthly':
      default:
        calculatedStartDate = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
        break;
    }

    return {
      startDate: startDate || calculatedStartDate,
      endDate: endDate || now,
    };
  }

  private async getAnalyticsData(startDate: Date, endDate: Date, store?: string) {
    const queryBuilder = this.createSalesQueryBuilder();
    
    queryBuilder.andWhere('sale.createdAt BETWEEN :startDate AND :endDate', {
      startDate,
      endDate,
    });

    if (store) {
      queryBuilder.andWhere('store.name ILIKE :store', { store: `%${store}%` });
    }

    const sales = await queryBuilder.getMany();
    
    // Calculate summary metrics
    const totalSales = sales.reduce((sum, sale) => sum + sale.amountPaid, 0);
    const totalTransactions = sales.length;
    const averageSale = totalTransactions > 0 ? totalSales / totalTransactions : 0;
    
    // Calculate total profit
    const totalProfit = sales.reduce((sum, sale) => {
      const orderItems = sale.order?.items || [];
      const saleProfit = orderItems.reduce((itemSum, item) => {
        const costPrice = item.product?.cost_price || 0;
        const sellingPrice = item.unitPrice;
        const itemProfit = (sellingPrice - costPrice) * item.quantity;
        return itemSum + itemProfit;
      }, 0);
      return sum + saleProfit;
    }, 0);

    // Group sales by store
    const salesByStore = this.groupSalesByStore(sales);
    
    // Group sales by category
    const salesByCategory = this.groupSalesByCategory(sales);
    
    // Get recent sales (last 10)
    const recentSales = sales
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map(sale => {
        const primaryProduct = sale.order?.items?.[0]?.product?.name || 'N/A';
        const customerName = sale.customer 
          ? `${sale.customer.firstName || ''} ${sale.customer.lastName || ''}`.trim()
          : 'Walk-in Customer';

        return {
          id: sale.id,
          product: primaryProduct,
          price: sale.amountPaid,
          customer: customerName,
          customer_email: sale.customer?.email || '',
          date: sale.createdAt.toISOString().split('T')[0],
          store: sale.store?.name || 'Unknown Store',
          employee: sale.personnel 
            ? `${sale.personnel.firstName || ''} ${sale.personnel.lastName || ''}`.trim()
            : 'Unknown',
        };
      });

    return {
      summary: {
        totalSales,
        totalProfit,
        averageSale,
        totalTransactions,
      },
      salesByStore,
      salesByCategory,
      recentSales,
    };
  }

  private groupSalesByStore(sales: Sale[]): any[] {
    const storeGroups: { [key: string]: number } = {};
    
    sales.forEach(sale => {
      const storeName = sale.store?.name || 'Unknown Store';
      storeGroups[storeName] = (storeGroups[storeName] || 0) + sale.amountPaid;
    });

    return Object.entries(storeGroups).map(([name, value]) => ({
      name,
      value,
    }));
  }

  private groupSalesByCategory(sales: Sale[]): any[] {
    const categoryGroups: { [key: string]: number } = {};
    
    sales.forEach(sale => {
      const orderItems = sale.order?.items || [];
      orderItems.forEach(item => {
        const category = item.product?.category || 'Other';
        const itemTotal = item.unitPrice * item.quantity;
        categoryGroups[category] = (categoryGroups[category] || 0) + itemTotal;
      });
    });

    return Object.entries(categoryGroups).map(([name, value]) => ({
      name,
      value,
    }));
  }

  private calculatePercentChanges(current: any, previous: any): any {
    const calculateChange = (currentVal: number, previousVal: number): number => {
      if (previousVal === 0) return currentVal > 0 ? 100 : 0;
      return ((currentVal - previousVal) / previousVal) * 100;
    };

    return {
      sales: calculateChange(current.totalSales, previous.totalSales),
      profit: calculateChange(current.totalProfit, previous.totalProfit),
      average: calculateChange(current.averageSale, previous.averageSale),
      transactions: calculateChange(current.totalTransactions, previous.totalTransactions),
    };
  }

  async findAll(
    storeId?: number,
    personnelId?: number,
    customerId?: number,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<Sale[]> {
    const where: FindOptionsWhere<Sale> = {};
    if (storeId) where.storeId = storeId;
    if (personnelId) where.personnelId = personnelId;
    if (customerId) where.customerId = customerId;
    if (dateFrom && dateTo) where.createdAt = Between(dateFrom, dateTo);
    else if (dateFrom) where.createdAt = Between(dateFrom, new Date());
    // else if (dateTo) where.created_at = LessThanOrEqual(dateTo); // Need to import LessThanOrEqual or use raw query for single bound date

    return this.saleRepository.find({
      where,
      relations: ['order', 'store', 'personnel', 'customer', 'order.items', 'order.items.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Sale> {
    const sale = await this.saleRepository.findOne({
      where: { id },
      relations: ['order', 'store', 'personnel', 'customer', 'order.items', 'order.items.product'],
    });
    if (!sale) {
      throw new NotFoundException(`Sale with ID ${id} not found.`);
    }
    return sale;
  }
  
  // No update or delete for sales, as they are typically immutable.
  // Refunds/returns would be separate operations/entities.
}
