import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddPostDto {
  @ApiProperty({ example: 'uuid-of-post' })
  @IsUUID()
  post_id: string;
}
