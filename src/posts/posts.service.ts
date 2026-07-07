import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async createPost(userId: string, dto: CreatePostDto) {
    const post = await this.prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          user_id: userId,
          type: dto.type as any,
          image_url: dto.image_url,
          video_url: dto.video_url,
          caption: dto.caption,
          mood: dto.mood,
          privacy: dto.privacy as any,
        },
        include: { profile: true },
      });

      // Increment posts_count
      await tx.profile.update({
        where: { id: userId },
        data: { posts_count: { increment: 1 } },
      });

      // Handle hashtags
      if (dto.hashtags?.length) {
        for (const tag of dto.hashtags) {
          const normalised = tag.toLowerCase().replace(/[^a-z0-9_]/g, '');
          if (!normalised) continue;

          const hashtag = await tx.hashtag.upsert({
            where: { name: normalised },
            create: { name: normalised, posts_count: 1 },
            update: { posts_count: { increment: 1 } },
          });

          await tx.postHashtag.upsert({
            where: { post_id_hashtag_id: { post_id: created.id, hashtag_id: hashtag.id } },
            create: { post_id: created.id, hashtag_id: hashtag.id },
            update: {},
          });
        }
      }

      return created;
    });

    return post;
  }

  async getPost(postId: string, requesterId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        profile: {
          select: {
            id: true, username: true, display_name: true, avatar_url: true,
          },
        },
        post_hashtags: { include: { hashtag: true } },
        _count: { select: { post_likes: true, post_comments: true } },
      },
    });

    if (!post) throw new NotFoundException('Post not found');

    const isLiked = await this.prisma.postLike.findUnique({
      where: { user_id_post_id: { user_id: requesterId, post_id: postId } },
    });
    const isSaved = await this.prisma.postSave.findUnique({
      where: { user_id_post_id: { user_id: requesterId, post_id: postId } },
    });

    return { ...post, is_liked: !!isLiked, is_saved: !!isSaved };
  }

  async updatePost(postId: string, userId: string, dto: UpdatePostDto) {
    await this.assertOwner(postId, userId);
    return this.prisma.post.update({
      where: { id: postId },
      data: {
        ...(dto.caption !== undefined && { caption: dto.caption }),
        ...(dto.mood !== undefined && { mood: dto.mood }),
        ...(dto.privacy && { privacy: dto.privacy as any }),
      },
    });
  }

  async deletePost(postId: string, userId: string) {
    await this.assertOwner(postId, userId);

    await this.prisma.$transaction([
      this.prisma.post.delete({ where: { id: postId } }),
      this.prisma.profile.update({
        where: { id: userId },
        data: { posts_count: { decrement: 1 } },
      }),
    ]);

    return { message: 'Post deleted' };
  }

  // ── Likes ─────────────────────────────────────────────────────────────────

  async likePost(postId: string, userId: string) {
    await this.findPostOrFail(postId);

    await this.prisma.$transaction(async (tx) => {
      await tx.postLike.upsert({
        where: { user_id_post_id: { user_id: userId, post_id: postId } },
        create: { user_id: userId, post_id: postId },
        update: {},
      });
      await tx.post.update({
        where: { id: postId },
        data: { likes_count: { increment: 1 } },
      });
    });

    return { message: 'Post liked' };
  }

  async unlikePost(postId: string, userId: string) {
    await this.findPostOrFail(postId);

    const like = await this.prisma.postLike.findUnique({
      where: { user_id_post_id: { user_id: userId, post_id: postId } },
    });
    if (!like) return { message: 'Not liked' };

    await this.prisma.$transaction([
      this.prisma.postLike.delete({
        where: { user_id_post_id: { user_id: userId, post_id: postId } },
      }),
      this.prisma.post.update({
        where: { id: postId },
        data: { likes_count: { decrement: 1 } },
      }),
    ]);

    return { message: 'Post unliked' };
  }

  // ── Saves ─────────────────────────────────────────────────────────────────

  async savePost(postId: string, userId: string) {
    await this.findPostOrFail(postId);
    await this.prisma.postSave.upsert({
      where: { user_id_post_id: { user_id: userId, post_id: postId } },
      create: { user_id: userId, post_id: postId },
      update: {},
    });
    return { message: 'Post saved' };
  }

  async unsavePost(postId: string, userId: string) {
    await this.findPostOrFail(postId);
    await this.prisma.postSave.deleteMany({
      where: { user_id: userId, post_id: postId },
    });
    return { message: 'Post unsaved' };
  }

  async getSavedPosts(userId: string, page = 1, limit = 18) {
    const skip = (page - 1) * limit;
    const [saves, total] = await this.prisma.$transaction([
      this.prisma.postSave.findMany({
        where: { user_id: userId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
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
      this.prisma.postSave.count({ where: { user_id: userId } }),
    ]);

    return { data: saves.map((s) => s.post), total, page, limit };
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  async getComments(postId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [comments, total] = await this.prisma.$transaction([
      this.prisma.postComment.findMany({
        where: { post_id: postId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          profile: {
            select: { id: true, username: true, display_name: true, avatar_url: true },
          },
        },
      }),
      this.prisma.postComment.count({ where: { post_id: postId } }),
    ]);

    return { data: comments, total, page, limit };
  }

  async addComment(postId: string, userId: string, dto: CreateCommentDto) {
    await this.findPostOrFail(postId);

    const comment = await this.prisma.$transaction(async (tx) => {
      const c = await tx.postComment.create({
        data: { post_id: postId, user_id: userId, text: dto.text },
        include: {
          profile: {
            select: { id: true, username: true, display_name: true, avatar_url: true },
          },
        },
      });
      await tx.post.update({
        where: { id: postId },
        data: { comments_count: { increment: 1 } },
      });
      return c;
    });

    return comment;
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await this.prisma.postComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.user_id !== userId)
      throw new ForbiddenException('Cannot delete another user\'s comment');

    await this.prisma.$transaction([
      this.prisma.postComment.delete({ where: { id: commentId } }),
      this.prisma.post.update({
        where: { id: comment.post_id },
        data: { comments_count: { decrement: 1 } },
      }),
    ]);

    return { message: 'Comment deleted' };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async findPostOrFail(postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  private async assertOwner(postId: string, userId: string) {
    const post = await this.findPostOrFail(postId);
    if (post.user_id !== userId)
      throw new ForbiddenException('You do not own this post');
    return post;
  }
}
