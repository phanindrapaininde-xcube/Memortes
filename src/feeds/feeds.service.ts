import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeedsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Home feed: chronological posts from users the requester follows + their own.
   */
  async getHomeFeed(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const follows = await this.prisma.follow.findMany({
      where: { follower_id: userId },
      select: { following_id: true },
    });
    const followingIds = follows.map((f) => f.following_id);
    followingIds.push(userId); // include own posts

    const [posts, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where: {
          user_id: { in: followingIds },
          privacy: { in: ['public', 'friends'] },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          profile: {
            select: { id: true, username: true, display_name: true, avatar_url: true },
          },
          _count: { select: { post_likes: true, post_comments: true } },
        },
      }),
      this.prisma.post.count({
        where: {
          user_id: { in: followingIds },
          privacy: { in: ['public', 'friends'] },
        },
      }),
    ]);

    // Annotate liked / saved status for the requester
    const postIds = posts.map((p) => p.id);
    const [likedRows, savedRows] = await this.prisma.$transaction([
      this.prisma.postLike.findMany({
        where: { user_id: userId, post_id: { in: postIds } },
        select: { post_id: true },
      }),
      this.prisma.postSave.findMany({
        where: { user_id: userId, post_id: { in: postIds } },
        select: { post_id: true },
      }),
    ]);

    const likedSet = new Set(likedRows.map((r) => r.post_id));
    const savedSet = new Set(savedRows.map((r) => r.post_id));

    return {
      data: posts.map((p) => ({
        ...p,
        is_liked: likedSet.has(p.id),
        is_saved: savedSet.has(p.id),
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Discover feed: trending public posts (most likes last 7 days).
   */
  async getDiscoverFeed(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [posts, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where: {
          privacy: 'public',
          created_at: { gte: since },
          user_id: { not: userId }, // exclude own posts from discover
        },
        skip,
        take: limit,
        orderBy: { likes_count: 'desc' },
        include: {
          profile: {
            select: { id: true, username: true, display_name: true, avatar_url: true },
          },
        },
      }),
      this.prisma.post.count({
        where: {
          privacy: 'public',
          created_at: { gte: since },
          user_id: { not: userId },
        },
      }),
    ]);

    return { data: posts, total, page, limit };
  }

  /**
   * Reels feed: video posts only (public), newest first.
   */
  async getReelsFeed(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [reels, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where: {
          type: 'reel',
          privacy: 'public',
          video_url: { not: null },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          profile: {
            select: { id: true, username: true, display_name: true, avatar_url: true },
          },
          _count: { select: { post_likes: true, post_comments: true } },
        },
      }),
      this.prisma.post.count({
        where: { type: 'reel', privacy: 'public', video_url: { not: null } },
      }),
    ]);

    const reelIds = reels.map((r) => r.id);
    const likedRows = await this.prisma.postLike.findMany({
      where: { user_id: userId, post_id: { in: reelIds } },
      select: { post_id: true },
    });
    const likedSet = new Set(likedRows.map((r) => r.post_id));

    return {
      data: reels.map((r) => ({ ...r, is_liked: likedSet.has(r.id) })),
      total,
      page,
      limit,
    };
  }
}
