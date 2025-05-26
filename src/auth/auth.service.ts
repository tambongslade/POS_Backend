import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PersonnelService } from '../personnel.service'; // Adjust path as needed
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Personnel } from '../models'; // Adjust path as needed
import { ActivityLogService, LogPayload } from '../activity-log/activity-log.service'; // Import ActivityLogService

export interface ValidatedUser {
  id: number;
  firstName?: string;
  lastName?: string;
  role: string;
  phone: string;
  storeId: number | null;
  email: string;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private personnelService: PersonnelService,
    private jwtService: JwtService,
    private activityLogService: ActivityLogService, // Inject ActivityLogService
  ) {}

  async validateUser(email: string, pass: string): Promise<ValidatedUser | null> {
    this.logger.debug(`Attempting to validate user: ${email}`);
    const user = await this.personnelService.findByEmail(email); 
    
    if (!user) {
      this.logger.warn(`Validation failed: User with email ${email} not found.`);
      return null;
    }
    this.logger.debug(`User found: ${JSON.stringify(user)}`);

    if (!user.password) {
        this.logger.warn(`Validation failed: User ${email} has no password set.`);
        return null;
    }

    const isMatch = await bcrypt.compare(pass, user.password);
    if (isMatch) {
      this.logger.log(`Password match for user ${email}.`);
      const { password, store, hashPasswordOnInsert, created_at, updated_at, ...relevantUserData } = user as any; 

      const validatedUser: ValidatedUser = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
        storeId: user.storeId,
        email: user.email,
        createdAt: user.createdAt
      };
      return validatedUser;
    } else {
      this.logger.warn(`Validation failed: Password mismatch for user ${email}.`);
      return null;
    }
  }

  async login(user: ValidatedUser & { storeId?: number | null }) { // Use ValidatedUser, ensure storeId can be null
    const payload = { email: user.email, sub: user.id, roles: user.role, storeId: user.storeId };
    const accessToken = this.jwtService.sign(payload);

    // Log successful login
    const logPayload: LogPayload = {
      userId: user.id,
      action: 'USER_LOGIN',
      details: `User ${user.email} logged in successfully.`,
      storeId: user.storeId === null ? undefined : user.storeId, // Coerce null to undefined
      entityType: 'Personnel',
      entityId: user.id,
    };
    try {
      await this.activityLogService.createLog(logPayload);
    } catch (error) {
      // Log or handle logging failure, but don't let it break the login process
      console.error('Failed to create login activity log:', error);
    }

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
        storeId: user.storeId,
        createdAt: user.createdAt,
      },
    };
  }

  // This method is for the JwtStrategy to find a user from the token payload
  // It's usually simple if your payload contains enough info (like user ID)
  async findUserForJwtStrategy(payload: any): Promise<Personnel | null> {
    return this.personnelService.findOne(payload.sub); // Assuming payload.sub is the user ID
  }
}
