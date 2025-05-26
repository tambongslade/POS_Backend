import { Controller, Get, Post, Body, Patch, Put, Param, Delete, ParseIntPipe, Query, UsePipes, ValidationPipe, HttpCode, HttpStatus, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CustomerService } from './customer.service';
import { CreateCustomerDto, UpdateCustomerDto } from './customer/dto';
import { Customer } from './models';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from './auth/decorators/roles.decorator';
import { RolesGuard } from './auth/guards/roles.guard';

export interface PaginatedCustomersResponse {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Controller('api/customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  create(@Request() req, @Body() createCustomerDto: CreateCustomerDto): Promise<Customer> {
    const actorId = req.user?.userId;
    return this.customerService.create(createCustomerDto, actorId);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('search') searchTerm?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<PaginatedCustomersResponse> {
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

    return this.customerService.findAllPaginated({
      page: pageNum,
      limit: limitNum,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
      search: searchTerm,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Customer> {
    return this.customerService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateCustomerDto: UpdateCustomerDto
  ): Promise<Customer> {
    const actorId = req.user?.userId;
    return this.customerService.update(id, updateCustomerDto, actorId);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  updatePut(
    @Request() req,
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateCustomerDto: UpdateCustomerDto
  ): Promise<Customer> {
    const actorId = req.user?.userId;
    return this.customerService.update(id, updateCustomerDto, actorId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req, @Param('id', ParseIntPipe) id: number): Promise<void> {
    const actorId = req.user?.userId;
    return this.customerService.remove(id, actorId);
  }
}
