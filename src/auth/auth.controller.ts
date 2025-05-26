import { Controller, Request, Post, UseGuards, Get, Body, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto'; // We'll create this DTO

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  @Get('ping')
  pingAuth() {
    this.logger.log('Auth ping endpoint was hit!');
    return { message: 'Auth is alive!', timestamp: new Date().toISOString() };
  }

  @UseGuards(AuthGuard('local')) // Passport local strategy
  @Post('login')
  async login(@Request() req, @Body() loginDto: LoginDto) { // loginDto for Swagger/validation, req.user from LocalAuthGuard
    this.logger.log(`Login attempt for user: ${loginDto.email}`);
    this.logger.debug(`Login DTO: ${JSON.stringify(loginDto)}`);
    this.logger.debug(`Request user from LocalAuthGuard: ${JSON.stringify(req.user)}`);
    const result = await this.authService.login(req.user);
    this.logger.log(`Login successful for user: ${req.user?.email || loginDto.email}`);
    return result; 
  }

  @UseGuards(AuthGuard('jwt')) // Passport JWT strategy
  @Get('profile')
  getProfile(@Request() req) {
    return req.user; // req.user is populated by JwtStrategy.validate()
  }
}
