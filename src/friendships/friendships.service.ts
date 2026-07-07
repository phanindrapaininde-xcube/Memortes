import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FriendshipsService {
  constructor(private readonly prisma: PrismaService) {}

  async follow(followerId: string, targetId: string) {
    if (followerId === targetId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    // Verify target exists
    const target = await this.prisma.profile.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('User not found');

    const existing = await this.prisma.follow.findUnique({
      where: { follower_id_following_id: { follower_id: followerId, following_id: targetId } },
    });
    if (existing) return { message: 'Already following' };

    await this.prisma.$transaction([
      this.prisma.follow.create({
        data: { follower_id: followerId, following_id: targetId },
      }),
      this.prisma.profile.update({
        where: { id: followerId },
        data: { following_count: { increment: 1 } },
      }),
      this.prisma.profile.update({
        where: { id: targetId },
        data: { followers_count: { increment: 1 } },
      }),
    ]);

    // Create or update friendship streak
    await this.upsertStreak(followerId, targetId);

    return { message: 'Followed successfully' };
  }

  async unfollow(followerId: string, targetId: string) {
    const existing = await this.prisma.follow.findUnique({
      where: { follower_id_following_id: { follower_id: followerId, following_id: targetId } },
    });
    if (!existing) return { message: 'Not following' };

    await this.prisma.$transaction([
      this.prisma.follow.delete({
        where: { follower_id_following_id: { follower_id: followerId, following_id: targetId } },
      }),
      this.prisma.profile.update({
        where: { id: followerId },
        data: { following_count: { decrement: 1 } },
      }),
      this.prisma.profile.update({
        where: { id: targetId },
        data: { followers_count: { decrement: 1 } },
      }),
    ]);

    return { message: 'Unfollowed successfully' };
  }

  async isFollowing(followerId: string, targetId: string) {
    const follow = await this.prisma.follow.findUnique({
      where: { follower_id_following_id: { follower_id: followerId, following_id: targetId } },
    });
    return { is_following: !!follow };
  }

  /** Get streaks for the current user. */
  async getStreaks(userId: string) {
    const streaks = await this.prisma.friendshipStreak.findMany({
      where: {
        OR: [{ user1_id: userId }, { user2_id: userId }],
      },
      orderBy: { streak_count: 'desc' },
      include: {
        user1: {
          select: { id: true, username: true, display_name: true, avatar_url: true },
        },
        user2: {
          select: { id: true, username: true, display_name: true, avatar_url: true },
        },
      },
    });

    return streaks.map((s) => ({
      id: s.id,
      streak_count: s.streak_count,
      last_interaction_at: s.last_interaction_at,
      friend: s.user1_id === userId ? s.user2 : s.user1,
    }));
  }

  /** Record an interaction (like, comment, DM) and bump streak. */
  async recordInteraction(userId: string, friendId: string) {
    if (userId === friendId) return;
    return this.upsertStreak(userId, friendId);
  }

  private async upsertStreak(userA: string, userB: string) {
    const [u1, u2] = [userA, userB].sort(); // canonical order
    const streak = await this.prisma.friendshipStreak.findUnique({
      where: { user1_id_user2_id: { user1_id: u1, user2_id: u2 } },
    });

    const now = new Date();

    if (!streak) {
      return this.prisma.friendshipStreak.create({
        data: { user1_id: u1, user2_id: u2, streak_count: 1, last_interaction_at: now },
      });
    }

    // If last interaction was within 48 h, increment; otherwise reset to 1
    const hoursSinceLast =
      (now.getTime() - streak.last_interaction_at.getTime()) / (1000 * 60 * 60);
    const newCount = hoursSinceLast < 48 ? streak.streak_count + 1 : 1;

    return this.prisma.friendshipStreak.update({
      where: { user1_id_user2_id: { user1_id: u1, user2_id: u2 } },
      data: { streak_count: newCount, last_interaction_at: now },
    });
  }
}
