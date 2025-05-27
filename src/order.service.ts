import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsWhere, SelectQueryBuilder } from 'typeorm';
import { Order, OrderItem, Product, Store, Personnel, Customer } from './models';
import { CreateOrderDto, UpdateOrderDto } from './order/dto';
import { ActivityLogService, LogPayload } from './activity-log/activity-log.service';
import { PaginatedOrdersResponse } from './order.controller';
import { WhatsappService } from './whatsapp/whatsapp.service';

export interface OrdersFilterOptions {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  storeId?: number;
  status?: string;
  customerId?: number;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    @InjectRepository(Store) private readonly storeRepository: Repository<Store>,
    @InjectRepository(Personnel) private readonly personnelRepository: Repository<Personnel>,
    @InjectRepository(Customer) private readonly customerRepository: Repository<Customer>,
    private readonly dataSource: DataSource,
    private readonly activityLogService: ActivityLogService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let savedOrder: Order;

    try {
      const { storeId, userId, customerId, items, ...orderData } = createOrderDto;

      const store = await queryRunner.manager.findOneBy(Store, { id: storeId });
      if (!store) throw new BadRequestException(`Store with ID ${storeId} not found.`);

      const user = await queryRunner.manager.findOneBy(Personnel, { id: userId });
      if (!user) throw new BadRequestException(`User (Personnel) with ID ${userId} not found.`);

      let customer: Customer | null = null;
      if (customerId) {
        customer = await queryRunner.manager.findOneBy(Customer, { id: customerId });
        if (!customer) throw new BadRequestException(`Customer with ID ${customerId} not found.`);
      }

      let calculatedTotalAmount = 0;
      const orderItemsToCreate: Array<Partial<OrderItem> & { product: Product, quantity: number, unitPrice: number, productId: number }> = [];

      // First loop: Validate products and stock, prepare item data
      for (const itemDto of items) {
        const product = await queryRunner.manager.findOneBy(Product, { id: itemDto.productId });
        if (!product) throw new BadRequestException(`Product with ID ${itemDto.productId} not found.`);
        if (product.stock < itemDto.quantity) {
          throw new BadRequestException(`Insufficient stock for product ${product.name} (ID ${itemDto.productId}). Available: ${product.stock}, Requested: ${itemDto.quantity}`);
        }
        calculatedTotalAmount += itemDto.unitPrice * itemDto.quantity;
        orderItemsToCreate.push({
          product: product, 
          productId: product.id, 
          quantity: itemDto.quantity, 
          unitPrice: itemDto.unitPrice,
        });
      }

      // Create the Order entity
      const newOrderEntity = queryRunner.manager.create(Order, {
        ...orderData, store, user, customer, customerId: customer?.id, totalAmount: calculatedTotalAmount,
      });
      savedOrder = await queryRunner.manager.save(Order, newOrderEntity);
      
      // Second loop: Create OrderItems and decrement stock using optimized method
      for (const itemToCreate of orderItemsToCreate) {
        const newOrderItem = queryRunner.manager.create(OrderItem, {
            product: itemToCreate.product, 
            productId: itemToCreate.productId,
            quantity: itemToCreate.quantity, 
            unitPrice: itemToCreate.unitPrice, 
            order: savedOrder, 
            orderId: savedOrder.id
        });
        await queryRunner.manager.save(OrderItem, newOrderItem);

        // Decrement stock using TypeORM's decrement method
        await queryRunner.manager.decrement(
          Product, 
          { id: itemToCreate.productId }, 
          'stock', 
          itemToCreate.quantity
        );
      }
      
      await queryRunner.commitTransaction();

      // Send WhatsApp notification
      try {
        await this.whatsappService.notifySaleToAdmin({
          orderId: savedOrder.id,
          items: orderItemsToCreate.map(item => ({
            productName: item.product.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            imei: item.product.imei
          })),
          totalAmount: calculatedTotalAmount,
          customerName: customer?.name
        });
      } catch (error) {
        this.logger.error('Failed to send WhatsApp notification:', error);
        // Don't throw error here, as the order was already saved successfully
      }

      // Log activity (after successful transaction)
      const logPayload: LogPayload = {
        userId: savedOrder.userId,
        action: 'CREATE_ORDER',
        details: `Order ID ${savedOrder.id} created. Total: ${savedOrder.totalAmount}. Status: ${savedOrder.status}.`,
        entityType: 'Order',
        entityId: savedOrder.id,
        storeId: savedOrder.storeId,
      };
      try {
        await this.activityLogService.createLog(logPayload);
      } catch (error) {
        console.error('Failed to create activity log for order creation:', error);
      }
      return this.findOne(savedOrder.id);

    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
      this.logError(err, 'create order');
      throw new InternalServerErrorException('Error creating order. Please try again.');
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(storeIdInput?: number, status?: string, customerIdInput?: number): Promise<Order[]> {
    const where: FindOptionsWhere<Order> = {};
    if (storeIdInput) where.storeId = storeIdInput;
    if (status) where.status = status;
    if (customerIdInput) where.customerId = customerIdInput;
    return this.orderRepository.find({
      where, relations: ['store', 'user', 'customer', 'items', 'items.product'], order: { createdAt: 'DESC' }
    });
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id }, relations: ['store', 'user', 'customer', 'items', 'items.product'],
    });
    if (!order) throw new NotFoundException(`Order with ID ${id} not found.`);
    return order;
  }

  async update(id: number, updateOrderDto: UpdateOrderDto, actorId?: number): Promise<Order> {
    const order = await this.findOne(id);
    const originalStatus = order.status;
    
    if (updateOrderDto.status) {
        order.status = updateOrderDto.status;
    }

    const updatedOrder = await this.orderRepository.save(order);

    // Log activity
    if (originalStatus !== updatedOrder.status) {
      const logPayload: LogPayload = {
        userId: actorId, // User performing the update
        action: 'UPDATE_ORDER_STATUS',
        details: `Order ID ${updatedOrder.id} status changed from '${originalStatus}' to '${updatedOrder.status}'.`,
        entityType: 'Order',
        entityId: updatedOrder.id,
        storeId: updatedOrder.storeId,
      };
      try {
        await this.activityLogService.createLog(logPayload);
      } catch (error) {
        console.error('Failed to create activity log for order update:', error);
      }
    }
    return this.findOne(updatedOrder.id);
  }

  async remove(id: number, actorId?: number): Promise<void> {
    const orderToRemove = await this.findOne(id);
    const result = await this.orderRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Order with ID ${id} not found or already deleted.`);
    }
    // Log activity
    const logPayload: LogPayload = {
      userId: actorId,
      action: 'DELETE_ORDER',
      details: `Order ID ${id} (Status: ${orderToRemove.status}, Total: ${orderToRemove.totalAmount}) deleted.`,
      entityType: 'Order',
      entityId: id,
      storeId: orderToRemove.storeId,
    };
    try {
      await this.activityLogService.createLog(logPayload);
    } catch (error) {
      console.error('Failed to create activity log for order deletion:', error);
    }
  }

  async findAllPaginated(options: OrdersFilterOptions): Promise<PaginatedOrdersResponse> {
    const queryBuilder = this.createOrdersQueryBuilder();
    
    // Apply filters
    this.applyOrdersFilters(queryBuilder, options);
    
    // Apply sorting
    this.applyOrdersSorting(queryBuilder, options.sortBy, options.sortOrder);
    
    // Get total count before pagination
    const total = await queryBuilder.getCount();
    
    // Apply pagination
    const offset = (options.page - 1) * options.limit;
    queryBuilder.skip(offset).take(options.limit);
    
    // Execute query
    const orders = await queryBuilder.getMany();
    
    return {
      orders,
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit),
    };
  }

  private createOrdersQueryBuilder(): SelectQueryBuilder<Order> {
    return this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.store', 'store')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product');
  }

  private applyOrdersFilters(queryBuilder: SelectQueryBuilder<Order>, options: OrdersFilterOptions): void {
    // Store filter
    if (options.storeId) {
      queryBuilder.andWhere('order.storeId = :storeId', { storeId: options.storeId });
    }

    // Status filter
    if (options.status) {
      queryBuilder.andWhere('order.status = :status', { status: options.status });
    }

    // Customer filter
    if (options.customerId) {
      queryBuilder.andWhere('order.customerId = :customerId', { customerId: options.customerId });
    }

    // Date filters
    if (options.startDate && options.endDate) {
      queryBuilder.andWhere('order.createdAt BETWEEN :startDate AND :endDate', {
        startDate: options.startDate,
        endDate: options.endDate,
      });
    } else if (options.startDate) {
      queryBuilder.andWhere('order.createdAt >= :startDate', { startDate: options.startDate });
    } else if (options.endDate) {
      queryBuilder.andWhere('order.createdAt <= :endDate', { endDate: options.endDate });
    }

    // Search filter (customer name, email, or product name)
    if (options.search) {
      queryBuilder.andWhere(
        '(customer.firstName ILIKE :search OR customer.lastName ILIKE :search OR customer.email ILIKE :search OR product.name ILIKE :search)',
        { search: `%${options.search}%` }
      );
    }
  }

  private applyOrdersSorting(queryBuilder: SelectQueryBuilder<Order>, sortBy: string, sortOrder: 'asc' | 'desc'): void {
    const sortMap: { [key: string]: string } = {
      'created_at': 'order.createdAt',
      'createdAt': 'order.createdAt',
      'total_amount': 'order.totalAmount',
      'totalAmount': 'order.totalAmount',
      'status': 'order.status',
      'customer_name': 'customer.firstName',
      'customerName': 'customer.firstName',
      'store_name': 'store.name',
      'storeName': 'store.name',
    };

    const sortField = sortMap[sortBy] || 'order.createdAt';
    queryBuilder.orderBy(sortField, sortOrder.toUpperCase() as 'ASC' | 'DESC');
  }

  private logError(error: any, context: string) {
    console.error(`Error in OrderService - ${context}:`, error);
  }
}
