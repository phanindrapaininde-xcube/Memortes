import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PostPrivacy } from './create-post.dto';

export class UpdatePostDto {
  @ApiPropertyOptional({ example: 'Updated caption ✨' })
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @ApiPropertyOptional({ example: '😍' })
  @IsOptional()
  @IsString()
  mood?: string;

  @ApiPropertyOptional({ enum: PostPrivacy })
  @IsOptional()
  @IsEnum(PostPrivacy)
  privacy?: PostPrivacy;
}
