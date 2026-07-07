import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseConfigService } from '../config/supabase.config';
import { v4 as uuidv4 } from 'uuid';

export type StorageFolder = 'avatars' | 'posts' | 'stories' | 'messages';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: string;

  constructor(
    private readonly supabase: SupabaseConfigService,
    private readonly config: ConfigService,
  ) {
    this.bucket = this.config.get<string>('STORAGE_BUCKET', 'memortes-media');
  }

  /**
   * Upload a file buffer to Supabase Storage.
   * Returns the public URL of the uploaded file.
   */
  async upload(
    file: Express.Multer.File,
    folder: StorageFolder,
    userId: string,
  ): Promise<{ url: string; path: string }> {
    this.validateFile(file);

    const ext = file.originalname.split('.').pop() ?? 'bin';
    const path = `${folder}/${userId}/${uuidv4()}.${ext}`;

    const { error } = await this.supabase.client.storage
      .from(this.bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Storage upload failed: ${error.message}`);
      throw new InternalServerErrorException('File upload failed');
    }

    const { data } = this.supabase.client.storage
      .from(this.bucket)
      .getPublicUrl(path);

    return { url: data.publicUrl, path };
  }

  /**
   * Delete a file from Supabase Storage by its path.
   */
  async delete(path: string): Promise<void> {
    const { error } = await this.supabase.client.storage
      .from(this.bucket)
      .remove([path]);

    if (error) {
      this.logger.warn(`Storage delete failed for path "${path}": ${error.message}`);
    }
  }

  /**
   * Generate a signed (temporary) URL for private assets.
   */
  async getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.supabase.client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new InternalServerErrorException('Could not generate signed URL');
    }

    return data.signedUrl;
  }

  private validateFile(file: Express.Multer.File) {
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.mimetype);

    if (!isImage && !isVideo) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: images and videos.`,
      );
    }

    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxBytes) {
      const maxMb = maxBytes / (1024 * 1024);
      throw new BadRequestException(
        `File too large. Maximum size is ${maxMb} MB.`,
      );
    }
  }
}
