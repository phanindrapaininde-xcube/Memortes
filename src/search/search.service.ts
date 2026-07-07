import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /** General-purpose search across people, hashtags in one call. */
  async search(query: string, userId: string) {
    const q = query.trim();
    if (!q) return { people: [], hashtags: [] };

    const [people, hashtags] = await Promise.all([
      this.searchPeople(q, userId, 1, 10),
      this.searchHashtags(q, 1, 10),
    ]);

    return { people: people.data, hashtags: hashtags.data };
  }

  async searchPeople(query: string, requesterId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const q = query.trim();

    const [people, total] = await this.prisma.$transaction([
      this.prisma.profile.findMany({
        where: {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { display_name: { contains: q, mode: 'insensitive' } },
          ],
          NOT: { id: requesterId },
        },
        skip,
        take: limit,
        orderBy: { followers_count: 'desc' },
        select: {
          id: true,
          username: true,
          display_name: true,
          avatar_url: true,
          followers_count: true,
          bio: true,
        },
      }),
      this.prisma.profile.count({
        where: {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { display_name: { contains: q, mode: 'insensitive' } },
          ],
          NOT: { id: requesterId },
        },
      }),
    ]);

    return { data: people, total, page, limit };
  }

  async searchHashtags(query: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const q = query.replace(/^#/, '').trim();

    const [hashtags, total] = await this.prisma.$transaction([
      this.prisma.hashtag.findMany({
        where: { name: { contains: q, mode: 'insensitive' } },
        skip,
        take: limit,
        orderBy: { posts_count: 'desc' },
      }),
      this.prisma.hashtag.count({
        where: { name: { contains: q, mode: 'insensitive' } },
      }),
    ]);

    return { data: hashtags, total, page, limit };
  }

  async getPostsByHashtag(hashtag: string, userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const tag = hashtag.replace(/^#/, '').toLowerCase();

    const ht = await this.prisma.hashtag.findUnique({ where: { name: tag } });
    if (!ht) return { data: [], total: 0, page, limit, hashtag: tag };

    const [posts, total] = await this.prisma.$transaction([
      this.prisma.postHashtag.findMany({
        where: { hashtag_id: ht.id },
        skip,
        take: limit,
        include: {
          post: {
            include: {
              profile: {
                select: { id: true, username: true, display_name: true, avatar_url: true },
              },
            },
          },
        },
      }),
      this.prisma.postHashtag.count({ where: { hashtag_id: ht.id } }),
    ]);

    return { data: posts.map((p) => p.post), total, page, limit, hashtag: tag };
  }

  /** Top hashtags sorted by posts_count. */
  async getTrendingHashtags(limit = 20) {
    return this.prisma.hashtag.findMany({
      take: limit,
      orderBy: { posts_count: 'desc' },
    });
  }
}
