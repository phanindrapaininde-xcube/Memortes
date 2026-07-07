import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiPropertyOptional({ example: 'Hey, how are you?' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;

  @ApiPropertyOptional({ example: 'https://cdn.supabase.co/storage/...' })
  @IsOptional()
  @IsString()
  image_url?: string;
}
