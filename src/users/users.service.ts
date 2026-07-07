import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateInterestsDto } from './dto/update-interests.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(username: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        display_name: true,
        bio: true,
        avatar_url: true,
        website: true,
        followers_count: true,
        following_count: true,
        posts_count: true,
        created_at: true,
      },
    });
    if (!profile) throw new NotFoundException(`User @${username} not found`);
    return profile;
  }

  async getProfileById(id: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        display_name: true,
        bio: true,
        avatar_url: true,
        website: true,
        followers_count: true,
        following_count: true,
        posts_count: true,
        created_at: true,
      },
    });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.username) {
      const conflict = await this.prisma.profile.findFirst({
        where: { username: dto.username, NOT: { id: userId } },
      });
      if (conflict) throw new ConflictException('Username already taken');
    }

    return this.prisma.profile.update({
      where: { id: userId },
      data: {
        ...(dto.username && { username: dto.username }),
        ...(dto.display_name !== undefined && { display_name: dto.display_name }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.avatar_url !== undefined && { avatar_url: dto.avatar_url }),
      },
    });
  }

  async getFollowers(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [followers, total] = await this.prisma.$transaction([
      this.prisma.follow.findMany({
        where: { following_id: userId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          follower: {
            select: {
              id: true,
              username: true,
              display_name: true,
              avatar_url: true,
            },
          },
        },
      }),
      this.prisma.follow.count({ where: { following_id: userId } }),
    ]);

    return {
      data: followers.map((f) => f.follower),
      total,
      page,
      limit,
    };
  }

  async getFollowing(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [following, total] = await this.prisma.$transaction([
      this.prisma.follow.findMany({
        where: { follower_id: userId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          following: {
            select: {
              id: true,
              username: true,
              display_name: true,
              avatar_url: true,
            },
          },
        },
      }),
      this.prisma.follow.count({ where: { follower_id: userId } }),
    ]);

    return {
      data: following.map((f) => f.following),
      total,
      page,
      limit,
    };
  }

  async updateInterests(userId: string, dto: UpdateInterestsDto) {
    // Validate all interest IDs exist
    const interests = await this.prisma.interest.findMany({
      where: { id: { in: dto.interest_ids } },
    });
    if (interests.length !== dto.interest_ids.length) {
      throw new NotFoundException('One or more interest IDs are invalid');
    }

    // Replace all current interests
    await this.prisma.$transaction([
      this.prisma.userInterest.deleteMany({ where: { user_id: userId } }),
      this.prisma.userInterest.createMany({
        data: dto.interest_ids.map((id) => ({
          user_id: userId,
          interest_id: id,
        })),
        skipDuplicates: true,
      }),
    ]);

    return { message: 'Interests updated' };
  }

  async getAllInterests() {
    return this.prisma.interest.findMany({ orderBy: { category: 'asc' } });
  }

  async getUserPosts(userId: string, requesterId: string, page = 1, limit = 18) {
    const skip = (page - 1) * limit;
    const isOwner = userId === requesterId;

    const where = {
      user_id: userId,
      ...(!isOwner && {
        privacy: { in: ['public' as const] },
      }),
    };

    const [posts, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          type: true,
          image_url: true,
          video_url: true,
          likes_count: true,
          comments_count: true,
          created_at: true,
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return { data: posts, total, page, limit };
  }
}
