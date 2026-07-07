import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AiMemoriesService } from './ai-memories.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseJwtPayload } from '../common/guards/supabase-auth.guard';

@ApiTags('ai-memories')
@Controller({ path: 'ai-memories', version: '1' })
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class AiMemoriesController {
  constructor(private readonly aiMemoriesService: AiMemoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List AI-generated memories for current user' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  list(
    @CurrentUser() user: SupabaseJwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.aiMemoriesService.listMemories(user.sub, +page, +limit);
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Trigger AI memory generation (Phase 2 – requires ANTHROPIC_API_KEY)',
  })
  generate(@CurrentUser() user: SupabaseJwtPayload) {
    return this.aiMemoriesService.generateMemory(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single memory with its posts' })
  getOne(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.aiMemoriesService.getMemory(id, user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an AI memory' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.aiMemoriesService.deleteMemory(id, user.sub);
  }
}
