import { IsInt, Min, IsOptional, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { AddCartItemDto } from './add-cart-item.dto';

export class CreateCartDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  personnel_id?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddCartItemDto)
  // @ArrayMinSize(1) // Uncomment if a cart must be created with at least one item
  items?: AddCartItemDto[];
} 