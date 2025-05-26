import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLogService } from './activity-log.service';
import { ActivityLog, Personnel, Store } from '../models';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog, Personnel, Store])],
  providers: [ActivityLogService],
  exports: [ActivityLogService]
})
export class ActivityLogModule {}
