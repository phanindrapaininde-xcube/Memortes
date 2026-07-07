import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class UpdateInterestsDto {
  @ApiProperty({ description: 'Array of interest IDs', type: [String] })
  @IsArray()
  @IsUUID('all', { each: true })
  interest_ids: string[];
}
