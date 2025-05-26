import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
// This is a guard for JWT authentication
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {} 