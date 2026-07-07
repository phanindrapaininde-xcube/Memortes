import {
  Body,
  Controller,
  Delete,
  ParseFilePipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { StorageService, StorageFolder } from './storage.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseJwtPayload } from '../common/guards/supabase-auth.guard';
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class DeleteFileDto {
  @ApiProperty({ example: 'posts/user-id/file.jpg' })
  @IsString()
  path: string;
}

@ApiTags('storage')
@Controller('storage')
@Version('1')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file to Supabase Storage' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiQuery({
    name: 'folder',
    enum: ['avatars', 'posts', 'stories', 'messages'],
    required: false,
  })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async upload(
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true }))
    file: Express.Multer.File,
    @CurrentUser() user: SupabaseJwtPayload,
    @Query('folder') folder: StorageFolder = 'posts',
  ) {
    return this.storageService.upload(file, folder, user.sub);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete a file from Supabase Storage by path' })
  async delete(
    @Body() dto: DeleteFileDto,
  ) {
    await this.storageService.delete(dto.path);
    return { message: 'File deleted' };
  }
}
