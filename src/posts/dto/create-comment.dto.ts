import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Beautiful shot! 😍' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text: string;
}
