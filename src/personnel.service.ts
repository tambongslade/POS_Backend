import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Personnel, Store } from './models';
import { CreatePersonnelDto, UpdatePersonnelDto } from './personnel/dto';
import * as bcrypt from 'bcrypt';
import { ActivityLogService, LogPayload } from './activity-log/activity-log.service';
import { PaginatedPersonnelResponse } from './personnel.controller';

export interface PersonnelFilterOptions {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  role?: string;
  storeId?: number;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class PersonnelService {
  constructor(
    @InjectRepository(Personnel) private readonly personnelRepository: Repository<Personnel>,
    @InjectRepository(Store) private readonly storeRepository: Repository<Store>,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async create(createPersonnelDto: CreatePersonnelDto, actorId?: number): Promise<Personnel> {
    // Check if email already exists
    const existingByEmail = await this.personnelRepository.findOneBy({ email: createPersonnelDto.email });
    if (existingByEmail) {
      throw new ConflictException('Personnel with this email already exists.');
    }

    // Check if storeId is valid
    const store = await this.storeRepository.findOneBy({ id: createPersonnelDto.storeId });
    if (!store) {
      throw new BadRequestException(`Store with ID ${createPersonnelDto.storeId} not found.`);
    }

    // Password will be hashed by @BeforeInsert hook in Personnel entity
    const newPersonnel = this.personnelRepository.create({
      ...createPersonnelDto,
      store: store, // Associate with the found store entity
    });
    
    const savedPersonnel = await this.personnelRepository.save(newPersonnel);

    // Log activity
    const logPayload: LogPayload = {
      userId: actorId,
      action: 'CREATE_PERSONNEL',
      details: `Personnel '${savedPersonnel.firstName} ${savedPersonnel.lastName}' (ID: ${savedPersonnel.id}, Email: ${savedPersonnel.email}) created.`,
      entityType: 'Personnel',
      entityId: savedPersonnel.id,
      storeId: savedPersonnel.storeId === null ? undefined : savedPersonnel.storeId,
    };
    try {
      await this.activityLogService.createLog(logPayload);
    } catch (error) {
      console.error('Failed to create activity log for personnel creation:', error);
    }

    return savedPersonnel;
  }

  async findAll(): Promise<Personnel[]> {
    // Exclude password from the result by default
    return this.personnelRepository.find({ relations: ['store'] });
  }

  async findOne(id: number): Promise<Personnel> {
    const personnel = await this.personnelRepository.findOne({ 
        where: { id }, 
        relations: ['store'] 
    });
    if (!personnel) {
      throw new NotFoundException(`Personnel with ID ${id} not found.`);
    }
    return personnel;
  }

  async update(id: number, updatePersonnelDto: UpdatePersonnelDto, actorId?: number): Promise<Personnel> {
    const personnelToUpdate = await this.personnelRepository.findOneBy({ id });
    if (!personnelToUpdate) {
      throw new NotFoundException(`Personnel with ID ${id} not found.`);
    }

    const originalEmail = personnelToUpdate.email; // For logging

    // Check for email conflict if email is being changed
    if (updatePersonnelDto.email && updatePersonnelDto.email !== personnelToUpdate.email) {
      const existingByEmail = await this.personnelRepository.findOneBy({ email: updatePersonnelDto.email });
      if (existingByEmail) {
        throw new ConflictException('Personnel with this email already exists.');
      }
    }

    // Check storeId if it's being updated
    let storeChanged = false;
    if (updatePersonnelDto.storeId && updatePersonnelDto.storeId !== personnelToUpdate.storeId) {
      const store = await this.storeRepository.findOneBy({ id: updatePersonnelDto.storeId });
      if (!store) {
        throw new BadRequestException(`Store with ID ${updatePersonnelDto.storeId} not found.`);
      }
      personnelToUpdate.store = store;
      personnelToUpdate.storeId = store.id;
      storeChanged = true;
    }

    // If password is provided in DTO, hash it before updating
    if (updatePersonnelDto.password) {
      const saltRounds = 10;
      personnelToUpdate.password = await bcrypt.hash(updatePersonnelDto.password, saltRounds);
      // Remove password from DTO so it doesn't overwrite the hashed one via direct spread
      delete updatePersonnelDto.password;
    }

    // Update other properties
    // Object.assign(personnel, updatePersonnelDto) would also work for non-relational fields
    // but explicit assignment is safer when relations or special handling like password is involved.

    // Update personnel properties from DTO, excluding password (handled above) and storeId (handled via relation)
    const { password, storeId, ...otherUpdates } = updatePersonnelDto;
    Object.assign(personnelToUpdate, otherUpdates);
    
    const updatedPersonnel = await this.personnelRepository.save(personnelToUpdate);

    // Log activity
    let details = `Personnel '${updatedPersonnel.firstName} ${updatedPersonnel.lastName}' (ID: ${updatedPersonnel.id}, Email: ${originalEmail}) updated.`;
    if (originalEmail !== updatedPersonnel.email) {
      details += ` New email: ${updatedPersonnel.email}.`;
    }
    if (storeChanged) {
      details += ` New store ID: ${updatedPersonnel.storeId}.`;
    }
    // Add more details if other fields changed

    const logPayload: LogPayload = {
      userId: actorId,
      action: 'UPDATE_PERSONNEL',
      details: details,
      entityType: 'Personnel',
      entityId: updatedPersonnel.id,
      storeId: updatedPersonnel.storeId === null ? undefined : updatedPersonnel.storeId,
    };
    try {
      await this.activityLogService.createLog(logPayload);
    } catch (error) {
      console.error('Failed to create activity log for personnel update:', error);
    }

    return updatedPersonnel;
  }

  async findByEmail(email: string): Promise<Personnel | null> {
    return this.personnelRepository.createQueryBuilder('personnel')
      .addSelect('personnel.password')
      .where('personnel.email = :email', { email })
      .leftJoinAndSelect('personnel.store', 'store')
      .getOne();
  }

  async remove(id: number, actorId?: number): Promise<void> {
    const result = await this.personnelRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Personnel with ID ${id} not found.`);
    }

    // Log activity
    const logPayload: LogPayload = {
      userId: actorId,
      action: 'DELETE_PERSONNEL',
      details: `Personnel with ID ${id} deleted.`,
      entityType: 'Personnel',
      entityId: id,
    };
    try {
      await this.activityLogService.createLog(logPayload);
    } catch (error) {
      console.error('Failed to create activity log for personnel deletion:', error);
    }
  }

  async findAllPaginated(options: PersonnelFilterOptions): Promise<PaginatedPersonnelResponse> {
    const queryBuilder = this.createPersonnelQueryBuilder();
    
    // Apply filters
    this.applyPersonnelFilters(queryBuilder, options);
    
    // Apply sorting
    this.applyPersonnelSorting(queryBuilder, options.sortBy, options.sortOrder);
    
    // Get total count before pagination
    const total = await queryBuilder.getCount();
    
    // Apply pagination
    const offset = (options.page - 1) * options.limit;
    queryBuilder.skip(offset).take(options.limit);
    
    // Execute query
    const personnel = await queryBuilder.getMany();
    
    return {
      personnel,
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit),
    };
  }

  private createPersonnelQueryBuilder(): SelectQueryBuilder<Personnel> {
    return this.personnelRepository
      .createQueryBuilder('personnel')
      .leftJoinAndSelect('personnel.store', 'store');
  }

  private applyPersonnelFilters(queryBuilder: SelectQueryBuilder<Personnel>, options: PersonnelFilterOptions): void {
    // Role filter
    if (options.role) {
      queryBuilder.andWhere('personnel.role = :role', { role: options.role });
    }

    // Store filter
    if (options.storeId) {
      queryBuilder.andWhere('personnel.storeId = :storeId', { storeId: options.storeId });
    }

    // Date filters
    if (options.startDate && options.endDate) {
      queryBuilder.andWhere('personnel.createdAt BETWEEN :startDate AND :endDate', {
        startDate: options.startDate,
        endDate: options.endDate,
      });
    } else if (options.startDate) {
      queryBuilder.andWhere('personnel.createdAt >= :startDate', { startDate: options.startDate });
    } else if (options.endDate) {
      queryBuilder.andWhere('personnel.createdAt <= :endDate', { endDate: options.endDate });
    }

    // Search filter (name, email, or phone)
    if (options.search) {
      queryBuilder.andWhere(
        '(personnel.firstName ILIKE :search OR personnel.lastName ILIKE :search OR personnel.email ILIKE :search OR personnel.phone ILIKE :search)',
        { search: `%${options.search}%` }
      );
    }
  }

  private applyPersonnelSorting(queryBuilder: SelectQueryBuilder<Personnel>, sortBy: string, sortOrder: 'asc' | 'desc'): void {
    const sortMap: { [key: string]: string } = {
      'created_at': 'personnel.createdAt',
      'createdAt': 'personnel.createdAt',
      'first_name': 'personnel.firstName',
      'firstName': 'personnel.firstName',
      'last_name': 'personnel.lastName',
      'lastName': 'personnel.lastName',
      'email': 'personnel.email',
      'phone': 'personnel.phone',
      'role': 'personnel.role',
      'store_name': 'store.name',
      'storeName': 'store.name',
    };

    const sortField = sortMap[sortBy] || 'personnel.createdAt';
    queryBuilder.orderBy(sortField, sortOrder.toUpperCase() as 'ASC' | 'DESC');
  }
}