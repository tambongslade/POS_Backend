import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { DashboardService, SummaryStats } from './dashboard.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, Role } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getSummaryStats(): Promise<SummaryStats> {
    this.logger.log('Request received for summary stats');
    return this.dashboardService.getSummaryStats();
  }

  // Other dashboard stat endpoints will go here later
  // e.g., @Get('sales-over-time')
}