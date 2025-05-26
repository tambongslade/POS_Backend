import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PersonnelModule } from '../personnel.module'; // Adjust path as needed
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy, jwtConstants } from './strategies/jwt.strategy';
import { ActivityLogModule } from '../activity-log/activity-log.module'; // Import ActivityLogModule
// import { ConfigModule, ConfigService } from '@nestjs/config'; // For .env based JWT_SECRET

@Module({
  imports: [
    PersonnelModule, // To use PersonnelService for user validation
    PassportModule.register({ defaultStrategy: 'jwt' }), // Register passport, default to jwt
    JwtModule.register({
      secret: jwtConstants.secret, // Replace with ConfigService for production
      signOptions: { expiresIn: '3600s' }, // e.g., 1 hour, adjust as needed
    }),
    ActivityLogModule, // Add ActivityLogModule to imports
    // If using .env and ConfigService for JWT_SECRET:
    // JwtModule.registerAsync({
    //   imports: [ConfigModule],
    //   useFactory: async (configService: ConfigService) => ({
    //     secret: configService.get<string>('JWT_SECRET'),
    //     signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '3600s' },
    //   }),
    //   inject: [ConfigService],
    // }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtModule], // Export JwtModule if other modules need to sign tokens, AuthService if other services need auth logic
})
export class AuthModule {}
