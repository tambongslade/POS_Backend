import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles, Role } from './auth/decorators/roles.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Personnel, Store } from './models';

@Controller('api/debug')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DebugController {
  constructor(
    @InjectRepository(Personnel)
    private readonly personnelRepository: Repository<Personnel>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
  ) {}

  @Get('check-data')
  @Roles(Role.ADMIN)
  async checkData() {
    try {
      // Get all stores
      const stores = await this.storeRepository.find();
      
      // Get all personnel
      const personnel = await this.personnelRepository.find({
        relations: ['store'],
      });

      // Find the specific user
      const adminUser = await this.personnelRepository.findOne({
        where: { email: 'tambongslade17@gmail.com' },
        relations: ['store'],
      });

      return {
        success: true,
        data: {
          stores: stores.map(store => ({
            id: store.id,
            name: store.name,
            address: store.address,
          })),
          personnel: personnel.map(person => ({
            id: person.id,
            email: person.email,
            firstName: person.firstName,
            lastName: person.lastName,
            role: person.role,
            storeId: person.storeId,
            storeName: person.store?.name || 'No Store Assigned',
          })),
          adminUser: adminUser ? {
            id: adminUser.id,
            email: adminUser.email,
            firstName: adminUser.firstName,
            lastName: adminUser.lastName,
            role: adminUser.role,
            storeId: adminUser.storeId,
            storeName: adminUser.store?.name || 'No Store Assigned',
          } : null,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('fix-user-store/:userId/:storeId')
  @Roles(Role.ADMIN)
  async fixUserStore(
    @Param('userId') userId: string,
    @Param('storeId') storeId: string,
  ) {
    try {
      const userIdNum = parseInt(userId);
      const storeIdNum = parseInt(storeId);

      // Check if user exists
      const user = await this.personnelRepository.findOne({
        where: { id: userIdNum },
      });

      if (!user) {
        return {
          success: false,
          message: `User with ID ${userIdNum} not found`,
        };
      }

      // Check if store exists
      const store = await this.storeRepository.findOne({
        where: { id: storeIdNum },
      });

      if (!store) {
        return {
          success: false,
          message: `Store with ID ${storeIdNum} not found`,
        };
      }

      // Update user's store assignment
      await this.personnelRepository.update(userIdNum, {
        storeId: storeIdNum,
      });

      // Get updated user
      const updatedUser = await this.personnelRepository.findOne({
        where: { id: userIdNum },
        relations: ['store'],
      });

      if (!updatedUser) {
        return {
          success: false,
          message: `Failed to retrieve updated user`,
        };
      }

      return {
        success: true,
        message: `User ${user.email} successfully assigned to store ${store.name}`,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
          storeId: updatedUser.storeId,
          storeName: updatedUser.store?.name || 'No Store Assigned',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('create-default-store')
  @Roles(Role.ADMIN)
  async createDefaultStore() {
    try {
      // Check if store with ID 1 exists
      const existingStore = await this.storeRepository.findOne({
        where: { id: 1 },
      });

      if (existingStore) {
        return {
          success: false,
          message: 'Store with ID 1 already exists',
          store: existingStore,
        };
      }

      // Create default store
      const defaultStore = this.storeRepository.create({
        name: 'Main Branch',
        address: '123 Main Street, City, Country',
        phone: '+1234567890',
        managerId: null,
      });

      const savedStore = await this.storeRepository.save(defaultStore);

      return {
        success: true,
        message: 'Default store created successfully',
        store: savedStore,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
} 