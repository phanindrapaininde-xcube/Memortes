import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface SupabaseJwtPayload {
  sub: string;          // user UUID
  email?: string;
  role?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

/**
 * Validates Supabase-issued JWTs.
 * Attaches the decoded payload to request.user so that @CurrentUser() works.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No bearer token provided');
    }

    try {
      const payload = await this.jwtService.verifyAsync<SupabaseJwtPayload>(
        token,
        { secret: this.config.getOrThrow<string>('JWT_SECRET') },
      );

      // Supabase tokens use 'authenticated' role for logged-in users
      if (payload.role !== 'authenticated' && payload.aud !== 'authenticated') {
        throw new UnauthorizedException('Token role is not authenticated');
      }

      // Attach to request so downstream handlers can read it
      (request as any).user = payload;
      return true;
    } catch (err: any) {
      throw new UnauthorizedException(
        err?.message ?? 'Invalid or expired token',
      );
    }
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;
    const [scheme, token] = authHeader.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }
}
