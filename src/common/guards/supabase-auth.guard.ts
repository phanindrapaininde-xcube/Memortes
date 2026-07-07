import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseConfigService } from '../../config/supabase.config';
import { Request } from 'express';

export interface SupabaseJwtPayload {
  sub: string;          // user UUID
  email?: string;
  role?: string;
  aud?: string;
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
    private readonly supabase: SupabaseConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No bearer token provided');
    }

    try {
      const { data: { user }, error } = await this.supabase.client.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException(error?.message ?? 'Invalid or expired token');
      }

      // Supabase tokens use 'authenticated' role for logged-in users
      if (user.role !== 'authenticated' && user.aud !== 'authenticated') {
        throw new UnauthorizedException('Token role is not authenticated');
      }

      const payload: SupabaseJwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        aud: user.aud,
        app_metadata: user.app_metadata,
        user_metadata: user.user_metadata,
      };

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
