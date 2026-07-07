import { Module } from '@nestjs/common';
import { AiMemoriesController } from './ai-memories.controller';
import { AiMemoriesService } from './ai-memories.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AiMemoriesController],
  providers: [AiMemoriesService],
})
export class AiMemoriesModule {}
