import { Injectable, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, SelectQueryBuilder } from 'typeorm';
import { Customer } from './models';
import { CreateCustomerDto, UpdateCustomerDto } from './customer/dto';
import { ActivityLogService, LogPayload } from './activity-log/activity-log.service';
import { PaginatedCustomersResponse } from './customer.controller';

export interface CustomersFilterOptions {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer) private readonly customerRepository: Repository<Customer>,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async create(createCustomerDto: CreateCustomerDto, actorId?: number): Promise<Customer> {
    // Check for existing email or phone if provided and not null/empty
    if (createCustomerDto.email) {
      const existingByEmail = await this.customerRepository.findOneBy({ email: createCustomerDto.email });
      if (existingByEmail) {
        throw new ConflictException(`Customer with email ${createCustomerDto.email} already exists.`);
      }
    }
    if (createCustomerDto.phoneNumber) {
      const existingByPhone = await this.customerRepository.findOneBy({ phoneNumber: createCustomerDto.phoneNumber });
      if (existingByPhone) {
        throw new ConflictException(`Customer with phone number ${createCustomerDto.phoneNumber} already exists.`);
      }
    }

    const customer = this.customerRepository.create(createCustomerDto);
    let savedCustomer: Customer;
    try {
      savedCustomer = await this.customerRepository.save(customer);
    } catch (error) {
        // TypeORM can throw QueryFailedError with specific codes for unique constraint violations
        // e.g., '23505' for PostgreSQL unique_violation
        if (error.code === '23505') { 
            // More specific error message could check error.detail to see which constraint failed
            throw new ConflictException('A customer with the provided email or phone number already exists.');
        }
        console.error('Error creating customer:', error);
        throw new InternalServerErrorException('Failed to create customer.');
    }

    // Log activity
    const logPayload: LogPayload = {
      userId: actorId,
      action: 'CREATE_CUSTOMER',
      details: `Customer '${savedCustomer.firstName} ${savedCustomer.lastName}' (ID: ${savedCustomer.id}) created.`,
      entityType: 'Customer',
      entityId: savedCustomer.id,
      // storeId: undefined, as customers are not directly linked to a single store in this model
    };
    try { await this.activityLogService.createLog(logPayload); } catch (e) { console.error('Log failed', e); }

    return savedCustomer;
  }

  async findAll(searchTerm?: string): Promise<Customer[]> {
    if (searchTerm) {
        // Basic search example: by name, email, or phone. 
        // For more advanced search, consider Full-Text Search or more complex queries.
        return this.customerRepository.createQueryBuilder('customer')
            .where('customer.firstName ILIKE :term', { term: `%${searchTerm}%` })
            .orWhere('customer.lastName ILIKE :term', { term: `%${searchTerm}%` })
            .orWhere('customer.email ILIKE :term', { term: `%${searchTerm}%` })
            .orWhere('customer.phoneNumber ILIKE :term', { term: `%${searchTerm}%` })
            .getMany();
    }
    return this.customerRepository.find();
  }

  async findOne(id: number): Promise<Customer> {
    const customer = await this.customerRepository.findOneBy({ id });
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found.`);
    }
    return customer;
  }

  async update(id: number, updateCustomerDto: UpdateCustomerDto, actorId?: number): Promise<Customer> {
    const customer = await this.findOne(id); // Ensures customer exists
    const originalDetails = `${customer.firstName} ${customer.lastName}, Email: ${customer.email}, Phone: ${customer.phoneNumber}`;

    // Check for email/phone conflict if they are being changed
    if (updateCustomerDto.email && updateCustomerDto.email !== customer.email) {
      const existingByEmail = await this.customerRepository.findOneBy({ email: updateCustomerDto.email });
      if (existingByEmail && existingByEmail.id !== id) {
        throw new ConflictException(`Customer with email ${updateCustomerDto.email} already exists.`);
      }
    }
    if (updateCustomerDto.phoneNumber && updateCustomerDto.phoneNumber !== customer.phoneNumber) {
      const existingByPhone = await this.customerRepository.findOneBy({ phoneNumber: updateCustomerDto.phoneNumber });
      if (existingByPhone && existingByPhone.id !== id) {
        throw new ConflictException(`Customer with phone number ${updateCustomerDto.phoneNumber} already exists.`);
      }
    }

    // Update customer properties
    customer.firstName = updateCustomerDto.firstName || customer.firstName;
    customer.lastName = updateCustomerDto.lastName || customer.lastName;
    customer.email = updateCustomerDto.email || customer.email;
    customer.phoneNumber = updateCustomerDto.phoneNumber || customer.phoneNumber;

    let updatedCustomer: Customer;
    try {
      updatedCustomer = await this.customerRepository.save(customer);
    } catch (error) {
      console.error('Error updating customer:', error);
      throw new InternalServerErrorException('Failed to update customer.');
    }

    // Log activity
    const logPayload: LogPayload = {
      userId: actorId,
      action: 'UPDATE_CUSTOMER',
      details: `Customer '${originalDetails}' updated to '${updatedCustomer.firstName} ${updatedCustomer.lastName}, Email: ${updatedCustomer.email}, Phone: ${updatedCustomer.phoneNumber}`,
      entityType: 'Customer',
      entityId: updatedCustomer.id,
      // storeId: undefined, as customers are not directly linked to a single store in this model
    };
    try { await this.activityLogService.createLog(logPayload); } catch (e) { console.error('Log failed', e); }

    return updatedCustomer;
  }

  async remove(id: number, actorId?: number): Promise<void> {
    const customer = await this.findOne(id); // Ensures customer exists
    if (!customer) { // findOne throws NotFoundException, so this is redundant but safe
      throw new NotFoundException(`Customer with ID ${id} not found.`);
    }

    const customerDetails = `${customer.firstName} ${customer.lastName} (ID: ${id}, Email: ${customer.email})`;

    const result = await this.customerRepository.delete(id);

    if (result.affected === 0) {
      // This might happen if deleted between findOne and delete, though unlikely
      throw new NotFoundException(`Customer with ID ${id} not found or already deleted.`);
    }

    // Log activity
    const logPayload: LogPayload = {
      userId: actorId,
      action: 'DELETE_CUSTOMER',
      details: `Customer '${customerDetails}' deleted.`,
      entityType: 'Customer',
      entityId: id,
    };
    try { await this.activityLogService.createLog(logPayload); } catch (e) { console.error('Log failed', e); }
  }

  async findAllPaginated(options: CustomersFilterOptions): Promise<PaginatedCustomersResponse> {
    const queryBuilder = this.createCustomersQueryBuilder();
    
    // Apply filters
    this.applyCustomersFilters(queryBuilder, options);
    
    // Apply sorting
    this.applyCustomersSorting(queryBuilder, options.sortBy, options.sortOrder);
    
    // Get total count before pagination
    const total = await queryBuilder.getCount();
    
    // Apply pagination
    const offset = (options.page - 1) * options.limit;
    queryBuilder.skip(offset).take(options.limit);
    
    // Execute query
    const customers = await queryBuilder.getMany();
    
    return {
      customers,
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit),
    };
  }

  private createCustomersQueryBuilder(): SelectQueryBuilder<Customer> {
    return this.customerRepository.createQueryBuilder('customer');
  }

  private applyCustomersFilters(queryBuilder: SelectQueryBuilder<Customer>, options: CustomersFilterOptions): void {
    // Date filters
    if (options.startDate && options.endDate) {
      queryBuilder.andWhere('customer.createdAt BETWEEN :startDate AND :endDate', {
        startDate: options.startDate,
        endDate: options.endDate,
      });
    } else if (options.startDate) {
      queryBuilder.andWhere('customer.createdAt >= :startDate', { startDate: options.startDate });
    } else if (options.endDate) {
      queryBuilder.andWhere('customer.createdAt <= :endDate', { endDate: options.endDate });
    }

    // Search filter (name, email, or phone)
    if (options.search) {
      queryBuilder.andWhere(
        '(customer.firstName ILIKE :search OR customer.lastName ILIKE :search OR customer.email ILIKE :search OR customer.phoneNumber ILIKE :search)',
        { search: `%${options.search}%` }
      );
    }
  }

  private applyCustomersSorting(queryBuilder: SelectQueryBuilder<Customer>, sortBy: string, sortOrder: 'asc' | 'desc'): void {
    const sortMap: { [key: string]: string } = {
      'created_at': 'customer.createdAt',
      'createdAt': 'customer.createdAt',
      'first_name': 'customer.firstName',
      'firstName': 'customer.firstName',
      'last_name': 'customer.lastName',
      'lastName': 'customer.lastName',
      'email': 'customer.email',
      'phone_number': 'customer.phoneNumber',
      'phoneNumber': 'customer.phoneNumber',
    };

    const sortField = sortMap[sortBy] || 'customer.createdAt';
    queryBuilder.orderBy(sortField, sortOrder.toUpperCase() as 'ASC' | 'DESC');
  }
}
