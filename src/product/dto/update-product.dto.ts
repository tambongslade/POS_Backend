import { IsString, IsNumber, Min, IsInt, IsOptional, MaxLength, IsEnum, ValidateNested, IsArray } from 'class-validator';
import { ProductCategory } from '../../models/product.entity'; // Adjust path if necessary
import { Type } from 'class-transformer';
// import { IMEIUpdateOperations } from './imei.dto';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  storeId?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number; // Selling price

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  imei?: string;
} 