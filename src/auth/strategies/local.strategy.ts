import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService, ValidatedUser } from '../auth.service';
import { Personnel } from '../../models'; // Adjust path as needed

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email', // We'll use email as the username
      // passwordField: 'password' // default is 'password'
    });
  }

  async validate(email: string, pass: string): Promise<ValidatedUser> {
    const user = await this.authService.validateUser(email, pass);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    // user is already Omit<Personnel, 'Password' | 'store'> because validateUser returns that type.
    return user;
  }
} 