import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateStoryDto {
  @ApiProperty({ example: 'https://cdn.supabase.co/storage/...' })
  @IsString()
  image_url: string;

  @ApiPropertyOptional({
    example: '2026-07-08T12:00:00Z',
    description: 'Expiry datetime (defaults to 24 h from now)',
  })
  @IsOptional()
  @IsDateString()
  expires_at?: string;
}
