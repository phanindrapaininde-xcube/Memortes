import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FriendshipsService } from './friendships.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseJwtPayload } from '../common/guards/supabase-auth.guard';

@ApiTags('friendships')
@Controller('friendships')
@Version('1')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class FriendshipsController {
  constructor(private readonly friendshipsService: FriendshipsService) {}

  @Post(':targetId/follow')
  @ApiOperation({ summary: 'Follow a user' })
  follow(
    @Param('targetId') targetId: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.friendshipsService.follow(user.sub, targetId);
  }

  @Delete(':targetId/follow')
  @ApiOperation({ summary: 'Unfollow a user' })
  unfollow(
    @Param('targetId') targetId: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.friendshipsService.unfollow(user.sub, targetId);
  }

  @Get(':targetId/is-following')
  @ApiOperation({ summary: 'Check if current user follows target' })
  isFollowing(
    @Param('targetId') targetId: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.friendshipsService.isFollowing(user.sub, targetId);
  }

  @Get('streaks')
  @ApiOperation({ summary: 'Get friendship streaks for current user' })
  getStreaks(@CurrentUser() user: SupabaseJwtPayload) {
    return this.friendshipsService.getStreaks(user.sub);
  }
}
