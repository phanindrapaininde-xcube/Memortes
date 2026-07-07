import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { AddPostDto } from './dto/add-post.dto';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseJwtPayload } from '../common/guards/supabase-auth.guard';

@ApiTags('collections')
@Controller('collections')
@Version('1')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a collection' })
  create(
    @CurrentUser() user: SupabaseJwtPayload,
    @Body() dto: CreateCollectionDto,
  ) {
    return this.collectionsService.createCollection(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List current user collections' })
  list(@CurrentUser() user: SupabaseJwtPayload) {
    return this.collectionsService.getMyCollections(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a collection with its posts' })
  getOne(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.collectionsService.getCollection(id, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update collection name / cover' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
    @Body() dto: Partial<CreateCollectionDto>,
  ) {
    return this.collectionsService.updateCollection(id, user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a collection' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.collectionsService.deleteCollection(id, user.sub);
  }

  @Post(':id/posts')
  @ApiOperation({ summary: 'Add a post to a collection' })
  addPost(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
    @Body() dto: AddPostDto,
  ) {
    return this.collectionsService.addPost(id, user.sub, dto);
  }

  @Delete(':id/posts/:postId')
  @ApiOperation({ summary: 'Remove a post from a collection' })
  removePost(
    @Param('id') id: string,
    @Param('postId') postId: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.collectionsService.removePost(id, postId, user.sub);
  }
}
