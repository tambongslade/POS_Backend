import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './models'; // Ensure Customer is imported from the models path
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { ActivityLogModule } from './activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer]),
    ActivityLogModule,
  ],
  controllers: [CustomerController],
  providers: [CustomerService],
})
export class CustomerModule {}
