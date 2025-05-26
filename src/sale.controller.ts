import { Controller, Get, Post, Body, Param, ParseIntPipe, Query, UsePipes, ValidationPipe, BadRequestException, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SaleService } from './sale.service';
import { CreateSaleDto } from './sale/dto';
import { Sale } from './models';

export interface PaginatedSalesResponse {
  sales: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SalesAnalyticsResponse {
  summary: {
    totalSales: number;
    totalProfit: number;
    averageSale: number;
    totalTransactions: number;
    percentChanges: {
      sales: number;
      profit: number;
      average: number;
      transactions: number;
    };
  };
  salesByStore: any[];
  salesByCategory: any[];
  recentSales: any[];
}

@Controller('api/sales')
export class SaleController {
  constructor(private readonly saleService: SaleService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  create(@Request() req, @Body() createSaleDto: CreateSaleDto): Promise<Sale> {
    return this.saleService.createSale(createSaleDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('store') store?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    // Legacy parameters for backward compatibility
    @Query('storeId') storeId?: string,
    @Query('personnelId') personnelId?: string,
    @Query('customerId') customerId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<PaginatedSalesResponse> {
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

    const startDateStr = startDate || dateFrom;
    const endDateStr = endDate || dateTo;

    if (startDateStr) {
      parsedStartDate = new Date(startDateStr);
      if (isNaN(parsedStartDate.getTime())) {
        throw new BadRequestException('Invalid startDate format. Use YYYY-MM-DD.');
      }
    }
    if (endDateStr) {
      parsedEndDate = new Date(endDateStr);
      if (isNaN(parsedEndDate.getTime())) {
        throw new BadRequestException('Invalid endDate format. Use YYYY-MM-DD.');
      }
      // Set to end of day for inclusive range
      parsedEndDate.setHours(23, 59, 59, 999);
    }

    if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
      throw new BadRequestException('startDate cannot be after endDate.');
    }

    // Parse legacy parameters for backward compatibility
    const numericStoreId = storeId ? parseInt(storeId, 10) : undefined;
    const numericPersonnelId = personnelId ? parseInt(personnelId, 10) : undefined;
    const numericCustomerId = customerId ? parseInt(customerId, 10) : undefined;

    return this.saleService.findAllPaginated({
      page: pageNum,
      limit: limitNum,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      store,
      category,
      search,
      // Legacy support
      storeId: numericStoreId,
      personnelId: numericPersonnelId,
      customerId: numericCustomerId,
    });
  }

  @Get('analytics')
  @UseGuards(AuthGuard('jwt'))
  async getAnalytics(
    @Query('timeframe') timeframe?: 'daily' | 'weekly' | 'monthly' | 'yearly',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('store') store?: string,
  ): Promise<SalesAnalyticsResponse> {
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

    return this.saleService.getAnalytics({
      timeframe: timeframe || 'monthly',
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      store,
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Sale> {
    return this.saleService.findOne(id);
  }
}
