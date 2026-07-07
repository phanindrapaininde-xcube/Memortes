import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseConfigService } from '../config/supabase.config';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseConfigService,
  ) {}

  async signUp(dto: SignUpDto) {
    // Check username uniqueness before delegating to Supabase
    const existing = await this.prisma.profile.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException('Username already taken');
    }

    const { data, error } = await this.supabase.client.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: false, // sends verification email
      user_metadata: {
        username: dto.username,
        display_name: dto.display_name,
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        throw new ConflictException('Email already registered');
      }
      throw new BadRequestException(error.message);
    }

    // Create the profile row immediately (Supabase trigger may also do this)
    try {
      await this.prisma.profile.upsert({
        where: { id: data.user.id },
        create: {
          id: data.user.id,
          username: dto.username,
          display_name: dto.display_name,
        },
        update: {},
      });
    } catch (err) {
      this.logger.warn(`Profile upsert failed after sign-up: ${err}`);
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        username: dto.username,
      },
      message: 'Verification email sent. Please check your inbox.',
    };
  }

  async signIn(dto: SignInDto) {
    const { data, error } =
      await this.supabase.client.auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      });

    if (error) {
      throw new UnauthorizedException(
        error.message ?? 'Invalid email or password',
      );
    }

    const profile = await this.prisma.profile.findUnique({
      where: { id: data.user.id },
    });

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email,
        profile,
      },
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const { data, error } = await this.supabase.client.auth.verifyOtp({
      email: dto.email,
      token: dto.token,
      type: 'signup',
    });

    if (error) {
      throw new BadRequestException(error.message ?? 'OTP verification failed');
    }

    return {
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      message: 'Email verified successfully',
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    const { data, error } = await this.supabase.client.auth.refreshSession({
      refresh_token: dto.refresh_token,
    });

    if (error) {
      throw new UnauthorizedException(error.message ?? 'Token refresh failed');
    }

    return {
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      expires_at: data.session?.expires_at,
    };
  }

  async signOut(userId: string) {
    // Revoke all sessions for this user on the server side
    const { error } = await this.supabase.client.auth.admin.signOut(userId);
    if (error) {
      this.logger.warn(`Sign-out error for ${userId}: ${error.message}`);
    }
    return { message: 'Signed out successfully' };
  }

  async getMe(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });
    if (!profile) throw new UnauthorizedException('Profile not found');
    return profile;
  }
}
