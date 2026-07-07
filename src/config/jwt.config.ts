import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

/**
 * Factory for @nestjs/jwt module options.
 * Uses the same JWT secret as Supabase so that tokens issued by Supabase
 * can be validated here without an extra round-trip.
 */
export const jwtConfig = (config: ConfigService): JwtModuleOptions => ({
  secret: config.getOrThrow<string>('JWT_SECRET'),
  signOptions: {
    expiresIn: '7d',
    issuer: 'supabase',
  },
});
