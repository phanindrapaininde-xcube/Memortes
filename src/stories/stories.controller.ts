import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseJwtPayload } from '../common/guards/supabase-auth.guard';

@ApiTags('stories')
@Controller('stories')
@Version('1')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new story (auto-expires in 24 h)' })
  create(
    @CurrentUser() user: SupabaseJwtPayload,
    @Body() dto: CreateStoryDto,
  ) {
    return this.storiesService.createStory(user.sub, dto);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Stories from followed users (feed)' })
  feed(@CurrentUser() user: SupabaseJwtPayload) {
    return this.storiesService.getFeedStories(user.sub);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Active stories for a specific user' })
  getUserStories(@Param('userId') userId: string) {
    return this.storiesService.getUserStories(userId);
  }

  @Post(':id/view')
  @ApiOperation({ summary: 'Mark a story as viewed' })
  view(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.storiesService.viewStory(id, user.sub);
  }

  @Get(':id/viewers')
  @ApiOperation({ summary: 'Get viewers of a story (owner only)' })
  viewers(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.storiesService.getStoryViewers(id, user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a story' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.storiesService.deleteStory(id, user.sub);
  }
}
