import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Personnel, Store } from './models'; // Import Personnel and Store entities
import { PersonnelController } from './personnel.controller';
import { PersonnelService } from './personnel.service';
import { ActivityLogModule } from './activity-log/activity-log.module'; // Import ActivityLogModule

@Module({
  imports: [
    TypeOrmModule.forFeature([Personnel, Store]),
    ActivityLogModule, // Add ActivityLogModule
  ],
  controllers: [PersonnelController],
  providers: [PersonnelService],
  exports: [PersonnelService] // Ensure PersonnelService is exported if other modules like AuthModule need it
})
export class PersonnelModule {}
