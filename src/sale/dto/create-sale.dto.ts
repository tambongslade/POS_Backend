import { IsInt, IsNotEmpty, IsString, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';

export class CreateSaleDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  orderId: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  transactionId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  paymentMethodReceived: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0) // Amount paid cannot be negative
  @IsNotEmpty()
  amountPaid: number;

  @IsOptional()
  @IsString()
  notes?: string;
} 