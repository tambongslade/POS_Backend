import { Controller, Get, Post, Body, Patch, Put, Param, Delete, ParseIntPipe, Query, UsePipes, ValidationPipe, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PersonnelService } from './personnel.service';
import { CreatePersonnelDto, UpdatePersonnelDto } from './personnel/dto';
import { Personnel } from './models';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from './auth/decorators/roles.decorator';
import { RolesGuard } from './auth/guards/roles.guard';

export interface PaginatedPersonnelResponse {
  personnel: Personnel[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Controller('api/personnel')
export class PersonnelController {
  constructor(private readonly personnelService: PersonnelService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  create(@Request() req, @Body() createPersonnelDto: CreatePersonnelDto): Promise<Personnel> {
    const actorId = req.user?.userId;
    return this.personnelService.create(createPersonnelDto, actorId);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('role') role?: string,
    @Query('storeId', new ParseIntPipe({ optional: true })) storeId?: number,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<PaginatedPersonnelResponse> {
    // Parse pagination parameters
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    
    // Validate pagination
    if (pageNum < 1) {
      throw new BadRequestException('Page must be greater than 0');
    }
    if (limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    // Parse date filters
    let parsedStartDate: Date | undefined;
    let parsedEndDate: Date | undefined;

    if (startDate) {
      parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        throw new BadRequestException('Invalid startDate format. Use YYYY-MM-DD.');
      }
    }
    if (endDate) {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        throw new BadRequestException('Invalid endDate format. Use YYYY-MM-DD.');
      }
      parsedEndDate.setHours(23, 59, 59, 999);
    }

    return this.personnelService.findAllPaginated({
      page: pageNum,
      limit: limitNum,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
      role,
      storeId,
      search,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Personnel> {
    return this.personnelService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  update(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() updatePersonnelDto: UpdatePersonnelDto): Promise<Personnel> {
    const actorId = req.user?.userId;
    return this.personnelService.update(id, updatePersonnelDto, actorId);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  updatePut(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() updatePersonnelDto: UpdatePersonnelDto): Promise<Personnel> {
    const actorId = req.user?.userId;
    return this.personnelService.update(id, updatePersonnelDto, actorId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Request() req, @Param('id', ParseIntPipe) id: number): Promise<void> {
    const actorId = req.user?.userId;
    return this.personnelService.remove(id, actorId);
  }
}
