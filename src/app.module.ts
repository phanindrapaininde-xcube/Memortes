import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { StoriesModule } from './stories/stories.module';
import { FeedsModule } from './feeds/feeds.module';
import { MessagesModule } from './messages/messages.module';
import { FriendshipsModule } from './friendships/friendships.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CollectionsModule } from './collections/collections.module';
import { SearchModule } from './search/search.module';
import { StorageModule } from './storage/storage.module';
import { AiMemoriesModule } from './ai-memories/ai-memories.module';

@Module({
  imports: [
    // Config must be first so other modules can inject ConfigService
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    PrismaModule,

    // Feature modules
    AuthModule,
    UsersModule,
    PostsModule,
    StoriesModule,
    FeedsModule,
    MessagesModule,
    FriendshipsModule,
    NotificationsModule,
    CollectionsModule,
    SearchModule,
    StorageModule,
    AiMemoriesModule,
  ],
})
export class AppModule {}
