import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoryDto } from './dto/create-story.dto';

@Injectable()
export class StoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a new story (expires in 24 h by default). */
  async createStory(userId: string, dto: CreateStoryDto) {
    const expires_at = dto.expires_at
      ? new Date(dto.expires_at)
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

    return this.prisma.story.create({
      data: {
        user_id: userId,
        image_url: dto.image_url,
        expires_at,
      },
      include: {
        profile: {
          select: { id: true, username: true, display_name: true, avatar_url: true },
        },
      },
    });
  }

  /** Active stories for a given user (not yet expired). */
  async getUserStories(userId: string) {
    return this.prisma.story.findMany({
      where: {
        user_id: userId,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
      include: {
        profile: {
          select: { id: true, username: true, display_name: true, avatar_url: true },
        },
        _count: { select: { story_views: true } },
      },
    });
  }

  /** Active stories from users the requester follows (home view). */
  async getFeedStories(requesterId: string) {
    // Get list of followed user IDs
    const follows = await this.prisma.follow.findMany({
      where: { follower_id: requesterId },
      select: { following_id: true },
    });
    const followingIds = follows.map((f) => f.following_id);
    // Always include own stories
    followingIds.push(requesterId);

    const stories = await this.prisma.story.findMany({
      where: {
        user_id: { in: followingIds },
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: 'desc' },
      include: {
        profile: {
          select: { id: true, username: true, display_name: true, avatar_url: true },
        },
      },
    });

    // Check which stories the requester has already viewed
    const viewedStoryIds = (
      await this.prisma.storyView.findMany({
        where: { viewer_id: requesterId },
        select: { story_id: true },
      })
    ).map((v) => v.story_id);
    const viewedSet = new Set(viewedStoryIds);

    return stories.map((s) => ({
      ...s,
      viewed: viewedSet.has(s.id),
    }));
  }

  /** Record a story view. */
  async viewStory(storyId: string, viewerId: string) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundException('Story not found');
    if (story.expires_at < new Date()) throw new NotFoundException('Story has expired');

    await this.prisma.storyView.upsert({
      where: { story_id_viewer_id: { story_id: storyId, viewer_id: viewerId } },
      create: { story_id: storyId, viewer_id: viewerId },
      update: { viewed_at: new Date() },
    });

    return { message: 'Viewed' };
  }

  /** Get viewers of a story (owner only). */
  async getStoryViewers(storyId: string, requesterId: string) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundException('Story not found');
    if (story.user_id !== requesterId)
      throw new ForbiddenException('Only the story owner can see viewers');

    return this.prisma.storyView.findMany({
      where: { story_id: storyId },
      orderBy: { viewed_at: 'desc' },
      include: {
        viewer: {
          select: { id: true, username: true, display_name: true, avatar_url: true },
        },
      },
    });
  }

  async deleteStory(storyId: string, userId: string) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundException('Story not found');
    if (story.user_id !== userId)
      throw new ForbiddenException('Cannot delete another user\'s story');

    await this.prisma.story.delete({ where: { id: storyId } });
    return { message: 'Story deleted' };
  }
}
