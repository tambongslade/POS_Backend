import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from './models';
import { CreateStoreDto, UpdateStoreDto } from './store/dto';
import { Personnel } from './models'; // For manager relation
import { ActivityLogService, LogPayload } from './activity-log/activity-log.service'; // Import

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(Store) private readonly storeRepository: Repository<Store>,
    @InjectRepository(Personnel) private readonly personnelRepository: Repository<Personnel>, // For validating managerId
    private readonly activityLogService: ActivityLogService, // Inject
  ) {}

  async create(createStoreDto: CreateStoreDto, actorId?: number): Promise<Store> {
    const { managerId, ...storeData } = createStoreDto;
    const newStore = this.storeRepository.create(storeData);

    if (managerId) {
      const manager = await this.personnelRepository.findOneBy({ id: managerId });
      if (!manager) {
        throw new NotFoundException(`Manager with ID ${managerId} not found.`);
      }
      newStore.manager = manager;
      // newStore.managerId = managerId; // TypeORM handles this via the relation
    }

    const savedStore = await this.storeRepository.save(newStore);

    // Log activity
    const logPayload: LogPayload = {
      userId: actorId, // Use actorId passed from controller
      action: 'CREATE_STORE',
      details: `Store '${savedStore.name}' (ID: ${savedStore.id}) created.`,
      entityType: 'Store',
      entityId: savedStore.id,
      storeId: savedStore.id, // For a store, the entityId is the storeId
    };
    try {
      await this.activityLogService.createLog(logPayload);
    } catch (error) {
      console.error('Failed to create activity log for store creation:', error);
    }

    return savedStore;
  }

  async findAll(): Promise<Store[]> {
    return this.storeRepository.find({ relations: ['manager'] }); // Include manager details
  }

  async findOne(id: number): Promise<Store> {
    const store = await this.storeRepository.findOne({ 
        where: { id }, 
        relations: ['manager', 'products', 'personnel'] // Include related entities
    });
    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found.`);
    }
    return store;
  }

  async update(id: number, updateStoreDto: UpdateStoreDto, actorId?: number): Promise<Store> {
    const { managerId, ...storeData } = updateStoreDto;
    // Preload an existing entity and then update it. This ensures that only existing fields are updated.
    // It also allows TypeORM to correctly handle relations and run subscribers/listeners.
    const storeToUpdate = await this.storeRepository.findOneBy({ id });
    if (!storeToUpdate) {
      throw new NotFoundException(`Store with ID ${id} not found to update.`);
    }
    
    const originalStoreName = storeToUpdate.name; // For logging details

    const preloadedStore = await this.storeRepository.preload({
      id: id,
      ...storeData,
    });

    if (!preloadedStore) {
      // This case should ideally not be hit if findOneBy succeeded, but as a safeguard:
      throw new NotFoundException(`Store with ID ${id} could not be preloaded for update.`);
    }

    if (managerId !== undefined) {
      if (managerId === null) {
        preloadedStore.manager = null;
        preloadedStore.managerId = null;
      } else {
        const manager = await this.personnelRepository.findOneBy({ id: managerId });
        if (!manager) {
          throw new NotFoundException(`Manager with ID ${managerId} not found.`);
        }
        preloadedStore.manager = manager;
      }
    }
    // If managerId is not in updateStoreDto, the manager relation remains unchanged by preload unless storeData overwrites it.

    const updatedStore = await this.storeRepository.save(preloadedStore);

    // Log activity
    const logPayload: LogPayload = {
      userId: actorId,
      action: 'UPDATE_STORE',
      details: `Store '${originalStoreName}' (ID: ${updatedStore.id}) updated. New name: '${updatedStore.name}'.`,
      entityType: 'Store',
      entityId: updatedStore.id,
      storeId: updatedStore.id,
    };
    try {
      await this.activityLogService.createLog(logPayload);
    } catch (error) {
      console.error('Failed to create activity log for store update:', error);
    }

    return updatedStore;
  }

  async remove(id: number, actorId?: number): Promise<void> {
    const storeToRemove = await this.storeRepository.findOneBy({id}); // For logging details
    if (!storeToRemove) {
      throw new NotFoundException(`Store with ID ${id} not found to delete.`);
    }

    const result = await this.storeRepository.delete(id);
    if (result.affected === 0) {
      // This should be caught by the findOneBy above, but keep as a safeguard
      throw new NotFoundException(`Store with ID ${id} not found to delete (delete result).`);
    }

    // Log activity
    const logPayload: LogPayload = {
      userId: actorId,
      action: 'DELETE_STORE',
      details: `Store '${storeToRemove.name}' (ID: ${id}) deleted.`,
      entityType: 'Store',
      entityId: id,
      storeId: id, 
    };
    try {
      await this.activityLogService.createLog(logPayload);
    } catch (error) {
      console.error('Failed to create activity log for store deletion:', error);
    }
  }
}
