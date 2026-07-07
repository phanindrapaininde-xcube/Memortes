import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Conversations ─────────────────────────────────────────────────────────

  /** Create or return existing 1-to-1 / group conversation. */
  async getOrCreateConversation(
    userId: string,
    dto: CreateConversationDto,
  ) {
    const allParticipantIds = Array.from(
      new Set([userId, ...dto.participant_ids]),
    );

    // For 1-to-1, try to find existing
    if (allParticipantIds.length === 2) {
      const existing = await this.prisma.conversation.findFirst({
        where: {
          participants: {
            every: { user_id: { in: allParticipantIds } },
          },
        },
        include: {
          participants: {
            include: {
              profile: {
                select: { id: true, username: true, display_name: true, avatar_url: true },
              },
            },
          },
        },
      });
      if (existing) return existing;
    }

    // Create new conversation
    return this.prisma.conversation.create({
      data: {
        participants: {
          createMany: {
            data: allParticipantIds.map((id) => ({ user_id: id })),
            skipDuplicates: true,
          },
        },
      },
      include: {
        participants: {
          include: {
            profile: {
              select: { id: true, username: true, display_name: true, avatar_url: true },
            },
          },
        },
      },
    });
  }

  /** List all conversations for a user, ordered by latest message. */
  async getConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: { some: { user_id: userId } },
      },
      orderBy: { updated_at: 'desc' },
      include: {
        participants: {
          where: { user_id: { not: userId } },
          include: {
            profile: {
              select: { id: true, username: true, display_name: true, avatar_url: true },
            },
          },
        },
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });

    return conversations;
  }

  async getConversation(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            profile: {
              select: { id: true, username: true, display_name: true, avatar_url: true },
            },
          },
        },
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    this.assertParticipant(conv, userId);
    return conv;
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  async getMessages(conversationId: string, userId: string, page = 1, limit = 40) {
    await this.getConversation(conversationId, userId); // auth check
    const skip = (page - 1) * limit;

    const [messages, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where: { conversation_id: conversationId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          sender: {
            select: { id: true, username: true, display_name: true, avatar_url: true },
          },
        },
      }),
      this.prisma.message.count({ where: { conversation_id: conversationId } }),
    ]);

    // Mark unread messages from others as read
    await this.prisma.message.updateMany({
      where: {
        conversation_id: conversationId,
        sender_id: { not: userId },
        read_at: null,
      },
      data: { read_at: new Date() },
    });

    return { data: messages.reverse(), total, page, limit };
  }

  async sendMessage(
    conversationId: string,
    userId: string,
    dto: SendMessageDto,
  ) {
    if (!dto.text && !dto.image_url) {
      throw new BadRequestException('Message must have text or image_url');
    }

    const conv = await this.getConversation(conversationId, userId);

    // Determine receiver_id for 1-to-1 conversations
    const otherParticipant = conv.participants.find(
      (p) => p.user_id !== userId,
    );

    const message = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversation_id: conversationId,
          sender_id: userId,
          receiver_id: otherParticipant?.user_id,
          text: dto.text,
          image_url: dto.image_url,
        },
        include: {
          sender: {
            select: { id: true, username: true, display_name: true, avatar_url: true },
          },
        },
      });

      // Touch conversation so list re-orders
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updated_at: new Date() },
      });

      return msg;
    });

    return message;
  }

  async deleteMessage(messageId: string, userId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.sender_id !== userId)
      throw new ForbiddenException('Cannot delete another user\'s message');

    await this.prisma.message.delete({ where: { id: messageId } });
    return { message: 'Message deleted' };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private assertParticipant(
    conv: { participants: { user_id: string }[] },
    userId: string,
  ) {
    const isParticipant = conv.participants.some((p) => p.user_id === userId);
    if (!isParticipant) throw new ForbiddenException('Not a participant');
  }
}
