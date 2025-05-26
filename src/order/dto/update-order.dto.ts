import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
// import { OrderStatus } from './create-order.dto'; // If OrderStatus enum is defined

export class UpdateOrderDto {
  @IsOptional() // Make all fields optional for PATCH operations
  @IsString()
  @IsNotEmpty()
  // @IsIn(Object.values(OrderStatus)) // Example if using OrderStatus enum
  status?: string;

  // Add other fields that can be updated here if necessary
  // e.g., customer_name, customer_phone, etc., all with @IsOptional()
} 