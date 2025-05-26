import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PersonnelService } from '../../personnel.service'; // Reverted to original path
// import { ConfigService } from '@nestjs/config'; // If using ConfigService for JWT_SECRET

// Placeholder for JWT secret - In a real app, use ConfigService and .env file
export const jwtConstants = {
  secret: 'DO_NOT_USE_THIS_IN_PRODUCTION_REPLACE_ME',
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly personnelService: PersonnelService,
    // private readonly configService: ConfigService, // Uncomment if using ConfigService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // secretOrKey: configService.get('JWT_SECRET'), // Use this if using ConfigService
      secretOrKey: jwtConstants.secret, // For now, using placeholder
    });
  }

  async validate(payload: any) {
    // Payload here is the decoded JWT (e.g., { email: '...', sub: userId, storeId: ..., ... })
    // We should find the user in the DB to ensure they still exist and are active
    const user = await this.personnelService.findOne(payload.sub); 
    if (!user) {
      throw new UnauthorizedException('User not found or token invalid.');
    }
    // Return complete user information including current storeId from database
    // This ensures we always have the most up-to-date store assignment
    return { 
      userId: user.id, 
      email: user.email, 
      roles: user.role,
      storeId: user.storeId, // Use current storeId from database
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
    };
  }
} 