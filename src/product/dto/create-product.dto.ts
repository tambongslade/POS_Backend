import { IsString, IsNotEmpty, IsNumber, Min, IsInt, IsOptional, MaxLength, IsEnum } from 'class-validator';
import { ProductCategory } from '../../models/product.entity'; // Adjust path if necessary

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string; // Consider max length if appropriate

  @IsEnum(ProductCategory)
  @IsNotEmpty()
  category: ProductCategory;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basePrice: number;

  @IsInt()
  @Min(0)
  stock: number;

  @IsInt()
  @Min(1)
  storeId: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number; // alias or derived from base_price?

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
} 