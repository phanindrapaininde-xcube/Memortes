import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Version,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseJwtPayload } from '../common/guards/supabase-auth.guard';

@ApiTags('posts')
@Controller('posts')
@Version('1')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new post or reel' })
  create(
    @CurrentUser() user: SupabaseJwtPayload,
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.createPost(user.sub, dto);
  }

  @Get('saved')
  @ApiOperation({ summary: 'Get posts saved by current user' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getSaved(
    @CurrentUser() user: SupabaseJwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 18,
  ) {
    return this.postsService.getSavedPosts(user.sub, +page, +limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single post by ID' })
  getOne(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.postsService.getPost(id, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update post caption / mood / privacy' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.updatePost(id, user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a post' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.postsService.deletePost(id, user.sub);
  }

  // ── Likes ──────────────────────────────────────────────────────────────

  @Post(':id/like')
  @ApiOperation({ summary: 'Like a post' })
  like(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.postsService.likePost(id, user.sub);
  }

  @Delete(':id/like')
  @ApiOperation({ summary: 'Unlike a post' })
  unlike(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.postsService.unlikePost(id, user.sub);
  }

  // ── Saves ──────────────────────────────────────────────────────────────

  @Post(':id/save')
  @ApiOperation({ summary: 'Save a post' })
  save(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.postsService.savePost(id, user.sub);
  }

  @Delete(':id/save')
  @ApiOperation({ summary: 'Unsave a post' })
  unsave(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.postsService.unsavePost(id, user.sub);
  }

  // ── Comments ────────────────────────────────────────────────────────────

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get comments on a post' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getComments(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.postsService.getComments(id, +page, +limit);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to a post' })
  addComment(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
    @Body() dto: CreateCommentDto,
  ) {
    return this.postsService.addComment(id, user.sub, dto);
  }

  @Delete('comments/:commentId')
  @ApiOperation({ summary: 'Delete a comment' })
  deleteComment(
    @Param('commentId') commentId: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.postsService.deleteComment(commentId, user.sub);
  }
}
