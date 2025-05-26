import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  managerId?: number; // Changed from manager_id
} 