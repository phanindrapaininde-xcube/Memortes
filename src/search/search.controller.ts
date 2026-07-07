import { Controller, Get, Param, Query, UseGuards, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseJwtPayload } from '../common/guards/supabase-auth.guard';

@ApiTags('search')
@Controller('search')
@Version('1')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'General search across people and hashtags' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  search(
    @Query('q') q: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.searchService.search(q ?? '', user.sub);
  }

  @Get('people')
  @ApiOperation({ summary: 'Search users by username or display name' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  searchPeople(
    @Query('q') q: string,
    @CurrentUser() user: SupabaseJwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.searchService.searchPeople(q ?? '', user.sub, +page, +limit);
  }

  @Get('hashtags')
  @ApiOperation({ summary: 'Search hashtags' })
  @ApiQuery({ name: 'q', description: 'Hashtag name (with or without #)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  searchHashtags(
    @Query('q') q: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.searchService.searchHashtags(q ?? '', +page, +limit);
  }

  @Get('hashtags/trending')
  @ApiOperation({ summary: 'Top trending hashtags' })
  @ApiQuery({ name: 'limit', required: false })
  trending(@Query('limit') limit = 20) {
    return this.searchService.getTrendingHashtags(+limit);
  }

  @Get('hashtags/:tag/posts')
  @ApiOperation({ summary: 'Get posts for a hashtag' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  postsByHashtag(
    @Param('tag') tag: string,
    @CurrentUser() user: SupabaseJwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.searchService.getPostsByHashtag(tag, user.sub, +page, +limit);
  }
}
