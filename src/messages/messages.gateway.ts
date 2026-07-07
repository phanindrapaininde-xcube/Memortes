import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';

interface AuthenticatedSocket extends Socket {
  userId: string;
}

@WebSocketGateway({
  namespace: 'messages',
  cors: { origin: '*', credentials: true },
})
export class MessagesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('Messages WebSocket gateway initialised');
  }

  /** Validate JWT on connection and attach userId to socket. */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ??
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) throw new Error('No token');

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.getOrThrow('JWT_SECRET'),
      });

      client.userId = payload.sub as string;
      // Join a personal room so we can push notifications
      await client.join(`user:${client.userId}`);
      this.logger.debug(`Client connected: ${client.userId}`);
    } catch {
      this.logger.warn(`Unauthorized WS connection attempt: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /** Join a conversation room to receive real-time messages. */
  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversation_id: string },
  ) {
    // Verify the user is a participant before letting them join
    try {
      await this.messagesService.getConversation(
        payload.conversation_id,
        client.userId,
      );
      await client.join(`conv:${payload.conversation_id}`);
      return { event: 'joined', data: { conversation_id: payload.conversation_id } };
    } catch (err: any) {
      throw new WsException(err?.message ?? 'Cannot join conversation');
    }
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversation_id: string },
  ) {
    await client.leave(`conv:${payload.conversation_id}`);
    return { event: 'left', data: { conversation_id: payload.conversation_id } };
  }

  /** Send a message via WebSocket; broadcasts to the conversation room. */
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversation_id: string } & SendMessageDto,
  ) {
    try {
      const { conversation_id, ...dto } = payload;
      const message = await this.messagesService.sendMessage(
        conversation_id,
        client.userId,
        dto,
      );

      // Broadcast to all participants in the conversation room
      this.server
        .to(`conv:${conversation_id}`)
        .emit('new_message', { data: message });

      return { event: 'message_sent', data: message };
    } catch (err: any) {
      throw new WsException(err?.message ?? 'Failed to send message');
    }
  }

  /** Typing indicator – broadcast to conversation room without persisting. */
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversation_id: string; is_typing: boolean },
  ) {
    client.to(`conv:${payload.conversation_id}`).emit('typing', {
      user_id: client.userId,
      is_typing: payload.is_typing,
    });
  }

  /** Utility: push an event to a specific user's personal room. */
  notifyUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
