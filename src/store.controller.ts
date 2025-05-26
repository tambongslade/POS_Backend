import { Controller, Get, Post, Body, Patch, Put, Param, Delete, ParseIntPipe, UsePipes, ValidationPipe, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StoreService } from './store.service';
import { CreateStoreDto, UpdateStoreDto } from './store/dto';
import { Store } from './models';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from './auth/decorators/roles.decorator';
import { RolesGuard } from './auth/guards/roles.guard';

@Controller('api/stores')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Request() req, @Body() createStoreDto: CreateStoreDto): Promise<Store> {
    const actorId = req.user?.userId;
    return this.storeService.create(createStoreDto, actorId);
  }

  @Get()
  findAll(): Promise<Store[]> {
    return this.storeService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Store> {
    return this.storeService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() updateStoreDto: UpdateStoreDto): Promise<Store> {
    const actorId = req.user?.userId;
    return this.storeService.update(id, updateStoreDto, actorId);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  updatePut(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() updateStoreDto: UpdateStoreDto): Promise<Store> {
    const actorId = req.user?.userId;
    return this.storeService.update(id, updateStoreDto, actorId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Request() req, @Param('id', ParseIntPipe) id: number): Promise<void> {
    const actorId = req.user?.userId;
    return this.storeService.remove(id, actorId);
  }
}
