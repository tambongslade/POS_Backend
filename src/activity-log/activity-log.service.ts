import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog, Personnel, Store } from '../models';

export interface LogPayload {
  action: string;
  details: string;
  userId?: number;
  entityType?: string;
  entityId?: number;
  storeId?: number;
}

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLog) private readonly activityLogRepository: Repository<ActivityLog>,
    @InjectRepository(Personnel) private readonly personnelRepository: Repository<Personnel>, // To fetch user if only userId is passed
    @InjectRepository(Store) private readonly storeRepository: Repository<Store> // To fetch store if only storeId is passed
  ) {}

  async createLog(logPayload: LogPayload): Promise<ActivityLog> {
    const { userId, storeId, action, details, entityType, entityId } = logPayload;

    const newLog = this.activityLogRepository.create({
      action,
      details,
      entity_type: entityType,
      entity_id: entityId,
    });

    if (userId) {
      const user = await this.personnelRepository.findOneBy({ id: userId });
      if (user) {
        newLog.user = user;
        newLog.user_id = user.id;
        // If storeId is not provided in payload, but user has a store, log that storeId
        if (!storeId && user.storeId) {
            newLog.store_id = user.storeId;
        }
      } else {
        // Handle case where userId is provided but user not found? Or assume valid ID?
        // For now, we'll proceed without linking user if not found, but this might indicate an issue.
        console.warn(`ActivityLogService: User with ID ${userId} not found for logging.`);
      }
    }

    if (storeId) {
        const store = await this.storeRepository.findOneBy({ id: storeId });
        if (store) {
            newLog.store = store;
            newLog.store_id = store.id;
        } else {
            console.warn(`ActivityLogService: Store with ID ${storeId} not found for logging.`);
        }
    } else if (newLog.user && newLog.user.storeId && !newLog.store_id) {
        // If storeId wasn't provided directly but user has an associated store, and it wasn't set above
        const store = await this.storeRepository.findOneBy({ id: newLog.user.storeId });
        if (store) {
            newLog.store = store;
            newLog.store_id = store.id;
        }
    }

    try {
      return await this.activityLogRepository.save(newLog);
    } catch (error) {
      console.error('Failed to save activity log:', error);
      // Depending on policy, you might not want to throw an error that breaks the main operation
      // For now, just log and rethrow or throw a specific logging error
      throw new InternalServerErrorException('Failed to record activity log.');
    }
  }
  
  // TODO: Add methods to find/query logs if a GET /api/activity-logs endpoint is needed
  // async findAll(...): Promise<ActivityLog[]> { ... }
  // async findOne(id: number): Promise<ActivityLog> { ... }
} 