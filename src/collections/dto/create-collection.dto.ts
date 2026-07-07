import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength, IsOptional } from 'class-validator';

export class CreateCollectionDto {
  @ApiProperty({ example: 'Japan Trip 2026' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({ example: 'https://cdn.supabase.co/storage/...' })
  @IsOptional()
  @IsString()
  cover_url?: string;
}
