import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotifications(userId: string, page = 1, limit = 30) {
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { user_id: userId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          actor: {
            select: { id: true, username: true, display_name: true, avatar_url: true },
          },
          post: {
            select: { id: true, image_url: true, type: true },
          },
        },
      }),
      this.prisma.notification.count({ where: { user_id: userId } }),
      this.prisma.notification.count({ where: { user_id: userId, read: false } }),
    ]);

    return { data: notifications, total, unread_count: unreadCount, page, limit };
  }

  async markRead(notificationId: string, userId: string) {
    const notif = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notif) throw new NotFoundException('Notification not found');
    if (notif.user_id !== userId) throw new NotFoundException('Notification not found');

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });

    return { message: 'Marked as read' };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { user_id: userId, read: false },
      data: { read: true },
    });
    return { message: 'All notifications marked as read' };
  }

  /** Internal helper used by other services to push a notification. */
  async createNotification(params: {
    userId: string;
    actorId?: string;
    type: NotificationType;
    postId?: string;
    message?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        user_id: params.userId,
        actor_id: params.actorId,
        type: params.type,
        post_id: params.postId,
        message: params.message,
      },
    });
  }
}
