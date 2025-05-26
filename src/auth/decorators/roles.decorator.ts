import { SetMetadata } from '@nestjs/common';

export enum Role {
  USER = 'User', // General user/customer - if they can log in
  CASHIER = 'Cashier',
  MANAGER = 'Manager',
  ADMIN = 'Admin',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles); 