import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Role } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    this.logger.debug(`Required roles: ${JSON.stringify(requiredRoles)}`);

    if (!requiredRoles) {
      this.logger.debug('No specific roles required, access granted.');
      return true; // No roles specified, access granted
    }
    const { user } = context.switchToHttp().getRequest();
    this.logger.debug(`User object from request: ${JSON.stringify(user)}`);
    
    // Ensure user and user.roles exist. user.roles should be a string from our JWT payload.
    if (!user || !user.roles) {
        this.logger.warn('Access denied: No user or no roles found on user object.');
        return false; // No user or no roles on user, access denied
    }

    this.logger.debug(`User roles: ${user.roles}`);
    // If user.roles is a single string role, check if it's in requiredRoles
    // If user.roles could be an array of strings, use .some(role => requiredRoles.includes(role))
    const hasRequiredRole = requiredRoles.some((role) => user.roles?.includes(role));
    this.logger.debug(`Does user have required role? ${hasRequiredRole}`);

    return hasRequiredRole;
  }
} 