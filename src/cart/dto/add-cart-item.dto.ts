import { IsInt, Min, IsNotEmpty } from 'class-validator';

export class AddCartItemDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  product_id: number;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;
} 