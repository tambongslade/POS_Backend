import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, FindOptionsWhere, Raw, SelectQueryBuilder, Brackets } from 'typeorm';
import { Product, Store } from './models';
import { CreateProductDto, UpdateProductDto } from './product/dto';
import { ActivityLogService, LogPayload } from './activity-log/activity-log.service';
import { ProductCategory } from './models/product.entity';
import { PaginatedProductsResponse } from './product.controller';

export interface ProductsFilterOptions {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  storeId?: number;
  category?: ProductCategory;
  minStock?: number;
  maxStock?: number;
  search?: string;
  lowStock?: boolean;
  imei?: string;
  isAdmin?: boolean;
}

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    @InjectRepository(Store) private readonly storeRepository: Repository<Store>,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async create(createProductDto: CreateProductDto, actorId?: number): Promise<Product> {
    // console.log('Incoming CreateProductDto:', JSON.stringify(createProductDto, null, 2)); // Kept for debugging if needed

    const store = await this.storeRepository.findOneBy({ id: createProductDto.storeId });
    if (!store) {
      throw new BadRequestException(`Store with ID ${createProductDto.storeId} not found.`);
    }

    const costPrice = parseFloat(String(createProductDto.costPrice));
    const price = parseFloat(String(createProductDto.price)); // Selling price
    const stock = parseInt(String(createProductDto.stock), 10);
    const lowStockThreshold = createProductDto.lowStockThreshold !== undefined ? parseInt(String(createProductDto.lowStockThreshold), 10) : 5;

    if (isNaN(costPrice)) {
        throw new BadRequestException('Invalid costPrice provided.');
    }
    if (isNaN(price)) {
        throw new BadRequestException('Invalid price (selling price) provided.');
    }

    const productData: Partial<Product> = {
        name: createProductDto.name,
        description: createProductDto.description,
        category: createProductDto.category,
        stock: stock,
        price: price, // Directly use the selling price from DTO
        cost_price: costPrice,
        lowStockThreshold: lowStockThreshold,
        store: store,
        imei: createProductDto.imei ?? null
    };
    
    // console.log('ProductData before create:', JSON.stringify(productData, null, 2)); // Kept for debugging if needed

    const newProductEntity = this.productRepository.create(productData as Product);
    const savedProduct = await this.productRepository.save(newProductEntity);

    // Log activity
    const logPayload: LogPayload = {
      userId: actorId,
      action: 'CREATE_PRODUCT',
      details: `Product '${savedProduct.name}' (ID: ${savedProduct.id}) created in store ID ${savedProduct.storeId}.`,
      entityType: 'Product',
      entityId: savedProduct.id,
      storeId: savedProduct.storeId,
    };
    try {
      await this.activityLogService.createLog(logPayload);
    } catch (error) {
      console.error('Failed to create activity log for product creation:', error);
    }

    return savedProduct;
  }

  async findAll(storeId?: number, category?: ProductCategory, minStock?: number): Promise<Product[]> {
    const where: FindOptionsWhere<Product> = {};
    if (storeId) {
      where.storeId = storeId;
    }
    if (category) {
      where.category = category; // Consider ILIKE for case-insensitive category search if DB supports
    }
    if (minStock !== undefined) {
        where.stock = Raw((alias) => `${alias} >= :minStock`, { minStock });
    }

    return this.productRepository.find({ 
        where,
        relations: ['store'] 
    });
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.productRepository.findOne({ 
        where: { id }, 
        relations: ['store'] 
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found.`);
    }
    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto, actorId?: number): Promise<Product> {
    const productToUpdate = await this.productRepository.findOneBy({ id });
    if (!productToUpdate) {
      throw new NotFoundException(`Product with ID ${id} not found.`);
    }
    const originalName = productToUpdate.name;
    const originalStoreId = productToUpdate.storeId;

    // Destructure basePrice if it exists in DTO to explicitly ignore it
    const { storeId, basePrice, ...productUpdateDataRest } = updateProductDto as any; 
    let newStore: Store | null = null;

    if (storeId) {
      newStore = await this.storeRepository.findOneBy({ id: storeId });
      if (!newStore) {
        throw new BadRequestException(`Store with ID ${storeId} not found.`);
      }
    }
    
    const updatedProductData: Partial<Product> = { ...productUpdateDataRest };

    if (newStore) {
        updatedProductData.store = newStore;
        updatedProductData.storeId = newStore.id;
    }

    if (updateProductDto.imei !== undefined) {
      updatedProductData.imei = updateProductDto.imei;
    }

    // Ensure numeric fields are numbers if provided
    if (updatedProductData.price !== undefined) updatedProductData.price = parseFloat(String(updatedProductData.price));
    if (updatedProductData.cost_price !== undefined) updatedProductData.cost_price = parseFloat(String(updatedProductData.cost_price));
    if (updatedProductData.stock !== undefined) updatedProductData.stock = parseInt(String(updatedProductData.stock), 10);
    if (updatedProductData.lowStockThreshold !== undefined) updatedProductData.lowStockThreshold = parseInt(String(updatedProductData.lowStockThreshold), 10);

    const preloadedProduct = await this.productRepository.preload({
        id: id,
        ...updatedProductData,
    });

    if (!preloadedProduct) {
        throw new NotFoundException(`Product with ID ${id} could not be preloaded for update.`);
    }

    const savedProduct = await this.productRepository.save(preloadedProduct);

    // Log activity
    let logDetails = `Product '${originalName}' (ID: ${savedProduct.id}) updated.`
    if (originalName !== savedProduct.name) logDetails += ` Name changed to '${savedProduct.name}'.`;
    if (newStore && originalStoreId !== savedProduct.storeId) logDetails += ` Store changed to ID ${savedProduct.storeId}.`;

    const logPayload: LogPayload = {
      userId: actorId,
      action: 'UPDATE_PRODUCT',
      details: logDetails,
      entityType: 'Product',
      entityId: savedProduct.id,
      storeId: savedProduct.storeId,
    };
    try {
      await this.activityLogService.createLog(logPayload);
    } catch (error) {
      console.error('Failed to create activity log for product update:', error);
    }

    return savedProduct;
  }

  async remove(id: number, actorId?: number): Promise<void> {
    const productToRemove = await this.productRepository.findOneBy({ id });
    if (!productToRemove) {
      throw new NotFoundException(`Product with ID ${id} not found.`);
    }

    const result = await this.productRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Product with ID ${id} not found (delete result).`);
    }

    // Log activity
    const logPayload: LogPayload = {
      userId: actorId,
      action: 'DELETE_PRODUCT',
      details: `Product '${productToRemove.name}' (ID: ${id}) from store ID ${productToRemove.storeId} deleted.`,
      entityType: 'Product',
      entityId: id,
      storeId: productToRemove.storeId,
    };
    try {
      await this.activityLogService.createLog(logPayload);
    } catch (error) {
      console.error('Failed to create activity log for product deletion:', error);
    }
  }

  async findAllPaginated(options: ProductsFilterOptions): Promise<PaginatedProductsResponse> {
    const queryBuilder = this.createProductsQueryBuilder();
    
    // Apply filters
    this.applyProductsFilters(queryBuilder, options);
    
    // Apply sorting
    this.applyProductsSorting(queryBuilder, options.sortBy, options.sortOrder);
    
    // Get total count before pagination
    const total = await queryBuilder.getCount();
    
    // Apply pagination
    const offset = (options.page - 1) * options.limit;
    queryBuilder.skip(offset).take(options.limit);
    
    // Execute query
    const products = await queryBuilder.getMany();
    
    return {
      products,
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit),
    };
  }

  private createProductsQueryBuilder(): SelectQueryBuilder<Product> {
    return this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.store', 'store');
  }

  private applyProductsFilters(queryBuilder: SelectQueryBuilder<Product>, options: ProductsFilterOptions): void {
    // Store filter
    if (options.storeId) {
      queryBuilder.andWhere('product.storeId = :storeId', { storeId: options.storeId });
    }

    // Category filter
    if (options.category) {
      queryBuilder.andWhere('product.category = :category', { category: options.category });
    }

    // Stock range filter
    if (options.minStock !== undefined) {
      queryBuilder.andWhere('product.stock >= :minStock', { minStock: options.minStock });
    }
    if (options.maxStock !== undefined) {
      queryBuilder.andWhere('product.stock <= :maxStock', { maxStock: options.maxStock });
    }

    // Low stock filter
    if (options.lowStock) {
      queryBuilder.andWhere('product.stock <= product.lowStockThreshold');
    }

    // IMEI search
    if (options.imei) {
      queryBuilder.andWhere('product.imei ILIKE :imei', { imei: `%${options.imei}%` });
    }

    // General search (name, description, or IMEI)
    if (options.search) {
      queryBuilder.andWhere(new Brackets(qb => {
        qb.where('LOWER(product.name) LIKE LOWER(:search)', { search: `%${options.search}%` })
          .orWhere('LOWER(product.description) LIKE LOWER(:search)', { search: `%${options.search}%` })
          .orWhere('product.imei LIKE :search', { search: `%${options.search}%` });
      }));
    }

    // Filter out zero stock items for non-admin users
    if (!options.isAdmin) {
      queryBuilder.andWhere('product.stock >= 1');
    }
  }

  private applyProductsSorting(queryBuilder: SelectQueryBuilder<Product>, sortBy: string, sortOrder: 'asc' | 'desc'): void {
    const sortMap: { [key: string]: string } = {
      'created_at': 'product.createdAt',
      'createdAt': 'product.createdAt',
      'name': 'product.name',
      'price': 'product.price',
      // 'base_price': 'product.base_price', // Removed base_price
      // 'basePrice': 'product.base_price', // Removed basePrice
      'stock': 'product.stock',
      'category': 'product.category',
      'store_name': 'store.name',
      'storeName': 'store.name',
      'cost_price': 'product.cost_price',
      'costPrice': 'product.cost_price'
    };

    const sortField = sortMap[sortBy] || 'product.createdAt';
    queryBuilder.orderBy(sortField, sortOrder.toUpperCase() as 'ASC' | 'DESC');
  }

  async getLowStockProductsReport(): Promise<Product[]> {
    return this.productRepository.find({
      where: {
        stock: Raw(alias => `${alias} <= product.lowStockThreshold`)
      },
      relations: ['store'], // Include store if needed in the report
      order: {
        storeId: 'ASC', // Optional: order by store then by name for readability
        name: 'ASC'
      }
    });
  }
}
