import { PartialType } from '@nestjs/mapped-types';
import { CreatePersonnelDto } from './create-personnel.dto';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePersonnelDto extends PartialType(CreatePersonnelDto) {
  // Explicitly make password optional and apply validation if present
  // This overrides the password from CreatePersonnelDto which is mandatory
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password?: string;
} 