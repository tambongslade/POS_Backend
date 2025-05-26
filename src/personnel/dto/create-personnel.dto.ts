import { IsString, IsNotEmpty, IsEmail, MinLength, IsInt, Min, IsOptional } from 'class-validator';

export class CreatePersonnelDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsString()
  @IsNotEmpty() // Add more specific phone validation if needed (e.g., IsPhoneNumber)
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsInt()
  @Min(1)
  storeId: number;

  @IsEmail()
  @IsNotEmpty()
  email: string;
} 