import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  MaxLength,
} from 'class-validator';

export enum PostType {
  POST = 'post',
  REEL = 'reel',
}

export enum PostPrivacy {
  PUBLIC = 'public',
  FRIENDS = 'friends',
  CLOSE_FRIENDS = 'close_friends',
}

export class CreatePostDto {
  @ApiProperty({ enum: PostType, default: PostType.POST })
  @IsEnum(PostType)
  type: PostType = PostType.POST;

  @ApiPropertyOptional({ example: 'https://cdn.supabase.co/storage/...' })
  @IsOptional()
  @IsString()
  image_url?: string;

  @ApiPropertyOptional({ example: 'https://cdn.supabase.co/storage/...' })
  @IsOptional()
  @IsString()
  video_url?: string;

  @ApiPropertyOptional({ example: 'Golden hour at the harbour ✨' })
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @ApiPropertyOptional({ example: '😊' })
  @IsOptional()
  @IsString()
  mood?: string;

  @ApiProperty({ enum: PostPrivacy, default: PostPrivacy.PUBLIC })
  @IsEnum(PostPrivacy)
  privacy: PostPrivacy = PostPrivacy.PUBLIC;

  @ApiPropertyOptional({ type: [String], example: ['sunset', 'photography'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];
}
