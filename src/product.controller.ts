import { Controller, Get, Post, Body, Patch, Put, Param, Delete, Query, ParseIntPipe, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto } from './product/dto';
import { Product, ProductCategory } from './models';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from './auth/decorators/roles.decorator';
import { RolesGuard } from './auth/guards/roles.guard';

export interface PaginatedProductsResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Controller('api/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  create(@Request() req, @Body() createProductDto: CreateProductDto): Promise<Product> {
    const actorId = req.user?.userId;
    return this.productService.create(createProductDto, actorId);
  }

  @Get('categories')
  getCategories(): string[] {
    return Object.values(ProductCategory);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('storeId', new ParseIntPipe({ optional: true })) storeId?: number,
    @Query('category') category?: ProductCategory,
    @Query('minStock', new ParseIntPipe({ optional: true })) minStock?: number,
    @Query('maxStock', new ParseIntPipe({ optional: true })) maxStock?: number,
    @Query('search') search?: string,
    @Query('lowStock') lowStock?: string,
  ): Promise<PaginatedProductsResponse> {
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

    // Parse boolean filter
    const isLowStock = lowStock === 'true';

    return this.productService.findAllPaginated({
      page: pageNum,
      limit: limitNum,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
      storeId,
      category,
      minStock,
      maxStock,
      search,
      lowStock: isLowStock,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Product> {
    return this.productService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  update(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() updateProductDto: UpdateProductDto): Promise<Product> {
    const actorId = req.user?.userId;
    return this.productService.update(id, updateProductDto, actorId);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  updatePut(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() updateProductDto: UpdateProductDto): Promise<Product> {
    const actorId = req.user?.userId;
    return this.productService.update(id, updateProductDto, actorId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  remove(@Request() req, @Param('id', ParseIntPipe) id: number): Promise<void> {
    const actorId = req.user?.userId;
    return this.productService.remove(id, actorId);
  }
}
