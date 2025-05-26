import { IsInt, Min, IsNotEmpty } from 'class-validator';

export class UpdateCartItemDto {
  @IsInt()
  @Min(1) // Assuming quantity cannot be zero, effectively removing the item.
          // If zero is allowed to clear an item, change Min to 0.
  @IsNotEmpty()
  quantity: number;
} 