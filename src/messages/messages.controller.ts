import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupabaseJwtPayload } from '../common/guards/supabase-auth.guard';

@ApiTags('messages')
@Controller('messages')
@Version('1')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Create or retrieve a conversation' })
  createConversation(
    @CurrentUser() user: SupabaseJwtPayload,
    @Body() dto: CreateConversationDto,
  ) {
    return this.messagesService.getOrCreateConversation(user.sub, dto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List all conversations for the current user' })
  listConversations(@CurrentUser() user: SupabaseJwtPayload) {
    return this.messagesService.getConversations(user.sub);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a single conversation' })
  getConversation(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.messagesService.getConversation(id, user.sub);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Paginated messages in a conversation' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getMessages(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 40,
  ) {
    return this.messagesService.getMessages(id, user.sub, +page, +limit);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message (REST fallback; prefer WebSocket)' })
  sendMessage(
    @Param('id') id: string,
    @CurrentUser() user: SupabaseJwtPayload,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(id, user.sub, dto);
  }

  @Delete(':messageId')
  @ApiOperation({ summary: 'Delete a message' })
  deleteMessage(
    @Param('messageId') messageId: string,
    @CurrentUser() user: SupabaseJwtPayload,
  ) {
    return this.messagesService.deleteMessage(messageId, user.sub);
  }
}
