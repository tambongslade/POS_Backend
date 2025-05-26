import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsArray, ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer'; // Required for @ValidateNested with arrays
import { CreateOrderItemDto } from './create-order-item.dto';

// Consider defining an enum for status and payment_method if they have fixed values
// export enum OrderStatus { PENDING = 'Pending', COMPLETED = 'Completed', CANCELLED = 'Cancelled' }
// export enum PaymentMethod { CASH = 'Cash', CARD = 'Card', ONLINE = 'Online' }

export class CreateOrderDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  customerId?: number; // Link to an existing customer

  @IsString()
  @IsNotEmpty()
  // @IsIn(Object.values(OrderStatus)) // Example if using OrderStatus enum
  status: string; 

  @IsString()
  @IsNotEmpty()
  // @IsIn(Object.values(PaymentMethod)) // Example if using PaymentMethod enum
  paymentMethod: string;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  storeId: number;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  userId: number; // Employee who processed the order

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
} 