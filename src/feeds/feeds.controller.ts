import {
  Controller,
  Get,
  Query,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FeedsService } from './feeds.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseJwtPayload } from '../common/guards/supabase-auth.guard';

@ApiTags('feeds')
@Controller('feeds')
@Version('1')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class FeedsController {
  constructor(private readonly feedsService: FeedsService) {}

  @Get('home')
  @ApiOperation({ summary: 'Home feed – posts from followed users' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  home(
    @CurrentUser() user: SupabaseJwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.feedsService.getHomeFeed(user.sub, +page, +limit);
  }

  @Get('discover')
  @ApiOperation({ summary: 'Discover feed – trending public posts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  discover(
    @CurrentUser() user: SupabaseJwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.feedsService.getDiscoverFeed(user.sub, +page, +limit);
  }

  @Get('reels')
  @ApiOperation({ summary: 'Reels feed – public video posts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  reels(
    @CurrentUser() user: SupabaseJwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.feedsService.getReelsFeed(user.sub, +page, +limit);
  }
}
