import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Store, Personnel } from './models'; // Add Personnel import
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { ActivityLogModule } from './activity-log/activity-log.module'; // Import ActivityLogModule

@Module({
  imports: [
    TypeOrmModule.forFeature([Store, Personnel]),
    ActivityLogModule, // Add ActivityLogModule
  ],
  controllers: [StoreController],               // Declare StoreController
  providers: [StoreService],                  // Provide StoreService
})
export class StoreModule {}
