import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { AddPostDto } from './dto/add-post.dto';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCollection(userId: string, dto: CreateCollectionDto) {
    return this.prisma.collection.create({
      data: {
        user_id: userId,
        name: dto.name,
        cover_url: dto.cover_url,
      },
    });
  }

  async getMyCollections(userId: string) {
    return this.prisma.collection.findMany({
      where: { user_id: userId },
      orderBy: { updated_at: 'desc' },
      include: {
        _count: { select: { collection_posts: true } },
      },
    });
  }

  async getCollection(collectionId: string, userId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        collection_posts: {
          include: {
            post: {
              include: {
                profile: {
                  select: { id: true, username: true, display_name: true, avatar_url: true },
                },
              },
            },
          },
          orderBy: { added_at: 'desc' },
        },
      },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.user_id !== userId)
      throw new ForbiddenException('Not your collection');
    return collection;
  }

  async updateCollection(
    collectionId: string,
    userId: string,
    dto: Partial<CreateCollectionDto>,
  ) {
    await this.assertOwner(collectionId, userId);
    return this.prisma.collection.update({
      where: { id: collectionId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.cover_url !== undefined && { cover_url: dto.cover_url }),
      },
    });
  }

  async deleteCollection(collectionId: string, userId: string) {
    await this.assertOwner(collectionId, userId);
    await this.prisma.collection.delete({ where: { id: collectionId } });
    return { message: 'Collection deleted' };
  }

  async addPost(collectionId: string, userId: string, dto: AddPostDto) {
    await this.assertOwner(collectionId, userId);

    const post = await this.prisma.post.findUnique({ where: { id: dto.post_id } });
    if (!post) throw new NotFoundException('Post not found');

    try {
      await this.prisma.collectionPost.create({
        data: { collection_id: collectionId, post_id: dto.post_id },
      });
    } catch {
      throw new ConflictException('Post already in collection');
    }

    return { message: 'Post added to collection' };
  }

  async removePost(collectionId: string, postId: string, userId: string) {
    await this.assertOwner(collectionId, userId);
    await this.prisma.collectionPost.deleteMany({
      where: { collection_id: collectionId, post_id: postId },
    });
    return { message: 'Post removed from collection' };
  }

  private async assertOwner(collectionId: string, userId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.user_id !== userId)
      throw new ForbiddenException('Not your collection');
    return collection;
  }
}
