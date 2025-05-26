import { Controller, Get, Post, Body, Patch, Put, Param, Delete, ParseIntPipe, Query, UsePipes, ValidationPipe, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderDto } from './order/dto';
import { Order } from './models';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from './auth/decorators/roles.decorator';
import { RolesGuard } from './auth/guards/roles.guard';

export interface PaginatedOrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Controller('api/orders') // Standardized API prefix
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CASHIER, Role.MANAGER, Role.ADMIN)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  create(@Body() createOrderDto: CreateOrderDto): Promise<Order> {
    return this.orderService.create(createOrderDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CASHIER, Role.MANAGER, Role.ADMIN)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('storeId') storeIdParam?: string, 
    @Query('status') status?: string, 
    @Query('customerId') customerIdParam?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ): Promise<PaginatedOrdersResponse> {
    // Parse pagination parameters
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    
    // Validate pagination
    if (pageNum < 1) {
      throw new BadRequestException('Page must be greater than 0');
    }
    if (limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    // Parse numeric filters
    let numericStoreId: number | undefined = undefined;
    if (storeIdParam && storeIdParam.trim() !== '') {
      numericStoreId = parseInt(storeIdParam, 10);
      if (isNaN(numericStoreId)) {
        numericStoreId = undefined;
      }
    }

    let numericCustomerId: number | undefined = undefined;
    if (customerIdParam && customerIdParam.trim() !== '') {
      numericCustomerId = parseInt(customerIdParam, 10);
      if (isNaN(numericCustomerId)) {
        numericCustomerId = undefined;
      }
    }

    // Parse date filters
    let parsedStartDate: Date | undefined;
    let parsedEndDate: Date | undefined;

    if (startDate) {
      parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        throw new BadRequestException('Invalid startDate format. Use YYYY-MM-DD.');
      }
    }
    if (endDate) {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        throw new BadRequestException('Invalid endDate format. Use YYYY-MM-DD.');
      }
      parsedEndDate.setHours(23, 59, 59, 999);
    }

    return this.orderService.findAllPaginated({
      page: pageNum,
      limit: limitNum,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
      storeId: numericStoreId,
      status,
      customerId: numericCustomerId,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      search,
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CASHIER, Role.MANAGER, Role.ADMIN)
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Order> {
    return this.orderService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  update(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() updateOrderDto: UpdateOrderDto): Promise<Order> {
    const actorId = req.user?.userId;
    return this.orderService.update(id, updateOrderDto, actorId);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  updatePut(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() updateOrderDto: UpdateOrderDto): Promise<Order> {
    const actorId = req.user?.userId;
    return this.orderService.update(id, updateOrderDto, actorId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Request() req, @Param('id', ParseIntPipe) id: number): Promise<void> {
    const actorId = req.user?.userId;
    return this.orderService.remove(id, actorId);
  }
}
