import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class AiMemoriesService {
  private readonly logger = new Logger(AiMemoriesService.name);
  private readonly anthropic: Anthropic | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.anthropic = apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.anthropic) {
      this.logger.warn('ANTHROPIC_API_KEY not set – AI generation is disabled');
    }
  }

  async listMemories(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [memories, total] = await this.prisma.$transaction([
      this.prisma.aiMemory.findMany({
        where: { user_id: userId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          ai_memory_posts: {
            include: {
              post: {
                select: { id: true, image_url: true, video_url: true, type: true },
              },
            },
          },
        },
      }),
      this.prisma.aiMemory.count({ where: { user_id: userId } }),
    ]);

    return { data: memories, total, page, limit };
  }

  async getMemory(memoryId: string, userId: string) {
    const memory = await this.prisma.aiMemory.findUnique({
      where: { id: memoryId },
      include: {
        ai_memory_posts: {
          include: {
            post: {
              include: {
                profile: {
                  select: { id: true, username: true, display_name: true, avatar_url: true },
                },
              },
            },
          },
        },
      },
    });

    if (!memory) throw new NotFoundException('Memory not found');
    if (memory.user_id !== userId)
      throw new NotFoundException('Memory not found');

    return memory;
  }

  /**
   * Phase 2 – trigger Claude to analyse recent posts and generate a memory.
   * Falls back gracefully if the API key is not configured.
   */
  async generateMemory(userId: string) {
    if (!this.anthropic) {
      return {
        message: 'AI generation is not enabled (Phase 2 feature). Set ANTHROPIC_API_KEY to enable.',
        phase: 2,
      };
    }

    // Pull the user's last 30 public posts as context
    const posts = await this.prisma.post.findMany({
      where: { user_id: userId },
      take: 30,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        caption: true,
        mood: true,
        created_at: true,
        type: true,
        image_url: true,
      },
    });

    if (posts.length === 0) {
      return {
        message: 'Not enough posts to generate a memory. Share more moments first!',
      };
    }

    const postsContext = posts
      .map(
        (p) =>
          `- [${p.created_at.toDateString()}] ${p.type} | mood: ${p.mood ?? 'none'} | caption: "${p.caption ?? ''}"`,
      )
      .join('\n');

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `You are helping create a "memory" for a social media app called Memortes.
Based on the following posts, write a short memory title (max 8 words) and a warm, evocative description (max 2 sentences).

Posts:
${postsContext}

Respond as JSON only: { "title": "...", "description": "..." }`,
          },
        ],
      });

      const raw = response.content[0].type === 'text' ? response.content[0].text : '';
      let parsed: { title: string; description: string };

      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = {
          title: 'A Special Moment',
          description: 'A collection of your recent memories.',
        };
      }

      // Persist the generated memory
      const memory = await this.prisma.aiMemory.create({
        data: {
          user_id: userId,
          title: parsed.title,
          description: parsed.description,
          cover_url: posts.find((p) => p.image_url)?.image_url ?? null,
          generated: true,
          ai_memory_posts: {
            createMany: {
              data: posts.slice(0, 10).map((p) => ({ post_id: p.id })),
              skipDuplicates: true,
            },
          },
        },
        include: { ai_memory_posts: true },
      });

      return { message: 'Memory generated', memory };
    } catch (err: any) {
      this.logger.error(`Anthropic API error: ${err.message}`);
      return { message: 'AI generation temporarily unavailable', error: err.message };
    }
  }

  async deleteMemory(memoryId: string, userId: string) {
    const memory = await this.prisma.aiMemory.findUnique({ where: { id: memoryId } });
    if (!memory || memory.user_id !== userId)
      throw new NotFoundException('Memory not found');

    await this.prisma.aiMemory.delete({ where: { id: memoryId } });
    return { message: 'Memory deleted' };
  }
}
