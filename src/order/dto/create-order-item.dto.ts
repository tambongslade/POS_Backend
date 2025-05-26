import { IsInt, Min, IsNumber, IsNotEmpty } from 'class-validator';

export class CreateOrderItemDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  productId: number;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsNotEmpty()
  unitPrice: number;
} 