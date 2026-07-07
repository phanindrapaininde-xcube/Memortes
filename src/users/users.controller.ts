import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateInterestsDto } from './dto/update-interests.dto';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseJwtPayload } from '../common/guards/supabase-auth.guard';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMyProfile(@CurrentUser() user: SupabaseJwtPayload) {
    return this.usersService.getProfileById(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMyProfile(
    @CurrentUser() user: SupabaseJwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Put('me/interests')
  @ApiOperation({ summary: 'Replace current user interests' })
  updateInterests(
    @CurrentUser() user: SupabaseJwtPayload,
    @Body() dto: UpdateInterestsDto,
  ) {
    return this.usersService.updateInterests(user.sub, dto);
  }

  @Get('interests')
  @ApiOperation({ summary: 'List all available interests' })
  getAllInterests() {
    return this.usersService.getAllInterests();
  }

  @Get(':username')
  @ApiOperation({ summary: 'Get a user profile by username' })
  getProfile(@Param('username') username: string) {
    return this.usersService.getProfile(username);
  }

  @Get(':id/followers')
  @ApiOperation({ summary: 'List followers of a user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getFollowers(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.usersService.getFollowers(id, +page, +limit);
  }

  @Get(':id/following')
  @ApiOperation({ summary: 'List users that this user follows' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getFollowing(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.usersService.getFollowing(id, +page, +limit);
  }

  @Get(':id/posts')
  @ApiOperation({ summary: 'Get posts by a user (respects privacy)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getUserPosts(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 18,
  ) {
    return this.usersService.getUserPosts(id, user.sub, +page, +limit);
  }
}
