-- ============================================================
-- Memortes Social Media App — Database Schema
-- Location: supabase/schema.sql
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";   -- full-text search support

-- ── Custom Enum Types ─────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_type') THEN
    create type post_type as enum ('post', 'reel');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'privacy_level') THEN
    create type privacy_level as enum ('public', 'friends', 'close_friends');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notif_type') THEN
    create type notif_type as enum ('like', 'comment', 'follow', 'mention', 'story_view', 'streak');
  END IF;
END $$;

-- ============================================================
-- CORE TABLES
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────
create table if not exists public.profiles (
  id                uuid        primary key references auth.users(id) on delete cascade,
  username          text        not null unique,
  display_name      text        default '',
  bio               text        default '',
  avatar_url        text,
  website           text,
  followers_count   integer     not null default 0,
  following_count   integer     not null default 0,
  posts_count       integer     not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint username_length check (char_length(username) >= 3 and char_length(username) <= 30),
  constraint username_format check (username ~ '^[a-z0-9_.]+$')
);

-- ── posts ────────────────────────────────────────────────────
create table if not exists public.posts (
  id              uuid          primary key default uuid_generate_v4(),
  user_id         uuid          not null references public.profiles(id) on delete cascade,
  type            post_type     not null default 'post',
  image_url       text,
  video_url       text,
  caption         text          default '',
  mood            text,
  privacy         privacy_level not null default 'public',
  likes_count     integer       not null default 0,
  comments_count  integer       not null default 0,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

create index if not exists idx_posts_user_id    on public.posts(user_id);
create index if not exists idx_posts_created_at on public.posts(created_at desc);
create index if not exists idx_posts_type       on public.posts(type);

-- ── stories ──────────────────────────────────────────────────
create table if not exists public.stories (
  id            uuid        primary key default uuid_generate_v4(),
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  image_url     text        not null,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_stories_user_id    on public.stories(user_id);
create index if not exists idx_stories_expires_at on public.stories(expires_at);

-- ── story_views ───────────────────────────────────────────────
create table if not exists public.story_views (
  story_id   uuid        not null references public.stories(id) on delete cascade,
  viewer_id  uuid        not null references public.profiles(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create index if not exists idx_story_views_story_id on public.story_views(story_id);

-- ── interests ────────────────────────────────────────────────
create table if not exists public.interests (
  id       uuid default uuid_generate_v4() primary key,
  name     text not null unique,
  category text
);

-- Seed interests
insert into public.interests (id, name, category) values
  (uuid_generate_v4(), 'Travel', 'lifestyle'),
  (uuid_generate_v4(), 'Food', 'lifestyle'),
  (uuid_generate_v4(), 'Music', 'entertainment'),
  (uuid_generate_v4(), 'Fashion', 'lifestyle'),
  (uuid_generate_v4(), 'Sports', 'activities'),
  (uuid_generate_v4(), 'Art', 'culture'),
  (uuid_generate_v4(), 'Tech', 'intellectual'),
  (uuid_generate_v4(), 'Gaming', 'entertainment'),
  (uuid_generate_v4(), 'Film', 'entertainment'),
  (uuid_generate_v4(), 'Books', 'intellectual'),
  (uuid_generate_v4(), 'Wellness', 'lifestyle'),
  (uuid_generate_v4(), 'Photography', 'culture'),
  (uuid_generate_v4(), 'Nature', 'activities'),
  (uuid_generate_v4(), 'Coffee', 'lifestyle'),
  (uuid_generate_v4(), 'Dance', 'culture'),
  (uuid_generate_v4(), 'Pets', 'lifestyle')
on conflict (name) do nothing;

-- ── user_interests ────────────────────────────────────────────
create table if not exists public.user_interests (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete cascade,
  primary key (user_id, interest_id)
);

-- ============================================================
-- SOCIAL GRAPH
-- ============================================================

-- ── follows ──────────────────────────────────────────────────
create table if not exists public.follows (
  follower_id  uuid        not null references public.profiles(id) on delete cascade,
  following_id uuid        not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id != following_id)
);

create index if not exists idx_follows_follower_id  on public.follows(follower_id);
create index if not exists idx_follows_following_id on public.follows(following_id);

-- ── post_likes ───────────────────────────────────────────────
create table if not exists public.post_likes (
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  post_id    uuid        not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists idx_post_likes_post_id on public.post_likes(post_id);
create index if not exists idx_post_likes_user_id on public.post_likes(user_id);

-- ── post_saves ───────────────────────────────────────────────
create table if not exists public.post_saves (
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  post_id    uuid        not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists idx_post_saves_user_id on public.post_saves(user_id);

-- ── post_comments ─────────────────────────────────────────────
create table if not exists public.post_comments (
  id          uuid        primary key default uuid_generate_v4(),
  post_id     uuid        not null references public.posts(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  text        text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint comment_text_length check (char_length(text) > 0 and char_length(text) <= 2000)
);

create index if not exists idx_post_comments_post_id   on public.post_comments(post_id);

-- ── hashtags ──────────────────────────────────────────────────
create table if not exists public.hashtags (
  id          uuid        primary key default uuid_generate_v4(),
  name        text        not null unique,
  posts_count integer     not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_hashtags_name on public.hashtags using gin (name gin_trgm_ops);

-- ── post_hashtags ─────────────────────────────────────────────
create table if not exists public.post_hashtags (
  post_id    uuid not null references public.posts(id) on delete cascade,
  hashtag_id uuid not null references public.hashtags(id) on delete cascade,
  primary key (post_id, hashtag_id)
);

-- ── notifications ─────────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid             primary key default uuid_generate_v4(),
  user_id    uuid             not null references public.profiles(id) on delete cascade,  -- recipient
  actor_id   uuid             references public.profiles(id) on delete set null,          -- who triggered it
  type       notif_type       not null,
  post_id    uuid             references public.posts(id) on delete cascade,
  message    text,
  read       boolean          not null default false,
  created_at timestamptz      not null default now()
);

create index if not exists idx_notifications_user_id    on public.notifications(user_id, read, created_at desc);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

-- ============================================================
-- MESSAGING
-- ============================================================

-- ── conversations ─────────────────────────────────────────────
create table if not exists public.conversations (
  id         uuid        primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── conversation_participants ─────────────────────────────────
create table if not exists public.conversation_participants (
  conversation_id uuid        not null references public.conversations(id) on delete cascade,
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists idx_conv_participants_user_id on public.conversation_participants(user_id);

-- ── messages ──────────────────────────────────────────────────
create table if not exists public.messages (
  id              uuid        primary key default uuid_generate_v4(),
  conversation_id uuid        not null references public.conversations(id) on delete cascade,
  sender_id       uuid        not null references public.profiles(id) on delete cascade,
  receiver_id     uuid        references public.profiles(id) on delete set null,
  text            text,
  image_url       text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_messages_conversation_id on public.messages(conversation_id, created_at desc);
create index if not exists idx_messages_sender_id       on public.messages(sender_id);

-- ── friendship_streaks ────────────────────────────────────────
create table if not exists public.friendship_streaks (
  id                  uuid        primary key default uuid_generate_v4(),
  user1_id            uuid        not null references public.profiles(id) on delete cascade,
  user2_id            uuid        not null references public.profiles(id) on delete cascade,
  streak_count        integer     not null default 1,
  last_interaction_at timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  unique (user1_id, user2_id),
  constraint ordered_users check (user1_id < user2_id)
);

create index if not exists idx_streaks_user1_id on public.friendship_streaks(user1_id);
create index if not exists idx_streaks_user2_id on public.friendship_streaks(user2_id);

-- ============================================================
-- COLLECTIONS & AI MEMORIES
-- ============================================================

-- ── collections ───────────────────────────────────────────────
create table if not exists public.collections (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  name       text        not null,
  cover_url  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_collections_user_id on public.collections(user_id);

-- ── collection_posts ──────────────────────────────────────────
create table if not exists public.collection_posts (
  collection_id uuid        not null references public.collections(id) on delete cascade,
  post_id       uuid        not null references public.posts(id) on delete cascade,
  added_at      timestamptz not null default now(),
  primary key (collection_id, post_id)
);

-- ── ai_memories ───────────────────────────────────────────────
create table if not exists public.ai_memories (
  id            uuid        primary key default uuid_generate_v4(),
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  title         text        not null,
  description   text,
  cover_url     text,
  generated     boolean     not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_ai_memories_user_id on public.ai_memories(user_id, created_at desc);

-- ── ai_memory_posts ───────────────────────────────────────────
create table if not exists public.ai_memory_posts (
  ai_memory_id     uuid  not null references public.ai_memories(id) on delete cascade,
  post_id          uuid  not null references public.posts(id) on delete cascade,
  primary key (ai_memory_id, post_id)
);

-- ============================================================
-- TRIGGERS — Maintain denormalized counts & updated_at
-- ============================================================

-- ── Helper trigger: set updated_at ────────────────────────────
create or replace function trg_set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function trg_set_updated_at();

create trigger trg_posts_updated_at
before update on public.posts
for each row execute function trg_set_updated_at();

create trigger trg_post_comments_updated_at
before update on public.post_comments
for each row execute function trg_set_updated_at();

create trigger trg_collections_updated_at
before update on public.collections
for each row execute function trg_set_updated_at();

-- ── profiles.followers_count & following_count ──────────────────
create or replace function trg_follows_counts() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.profiles set followers_count = followers_count + 1 where id = new.following_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
  elsif (tg_op = 'DELETE') then
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.following_id;
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
  end if;
  return null;
end;
$$;

create trigger trg_follows_counts
after insert or delete on public.follows
for each row execute function trg_follows_counts();

-- ── profiles.posts_count ──────────────────────────────────────
create or replace function trg_posts_count() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.profiles set posts_count = posts_count + 1 where id = new.user_id;
  elsif (tg_op = 'DELETE') then
    update public.profiles set posts_count = greatest(posts_count - 1, 0) where id = old.user_id;
  end if;
  return null;
end;
$$;

create trigger trg_posts_count
after insert or delete on public.posts
for each row execute function trg_posts_count();

-- ── posts.likes_count ─────────────────────────────────────────
create or replace function trg_post_likes_count() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set likes_count = likes_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger trg_post_likes_count
after insert or delete on public.post_likes
for each row execute function trg_post_likes_count();

-- ── posts.comments_count ──────────────────────────────────────
create or replace function trg_post_comments_count() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set comments_count = comments_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set comments_count = greatest(comments_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger trg_post_comments_count
after insert or delete on public.post_comments
for each row execute function trg_post_comments_count();

-- ── hashtags.posts_count ──────────────────────────────────────
create or replace function trg_hashtag_posts_count() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.hashtags set posts_count = posts_count + 1 where id = new.hashtag_id;
  elsif (tg_op = 'DELETE') then
    update public.hashtags set posts_count = greatest(posts_count - 1, 0) where id = old.hashtag_id;
  end if;
  return null;
end;
$$;

create trigger trg_hashtag_posts_count
after insert or delete on public.post_hashtags
for each row execute function trg_hashtag_posts_count();

-- ── Auto-create profile on auth.users insert ──────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      'user_' || substr(new.id::text, 1, 8)
    ),
    coalesce(
      new.raw_user_meta_data->>'display_name',
      'Moment User'
    )
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles                  enable row level security;
alter table public.posts                     enable row level security;
alter table public.stories                   enable row level security;
alter table public.story_views               enable row level security;
alter table public.interests                 enable row level security;
alter table public.user_interests            enable row level security;
alter table public.follows                   enable row level security;
alter table public.post_likes                enable row level security;
alter table public.post_saves                enable row level security;
alter table public.post_comments             enable row level security;
alter table public.hashtags                  enable row level security;
alter table public.post_hashtags             enable row level security;
alter table public.notifications             enable row level security;
alter table public.conversations             enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                  enable row level security;
alter table public.friendship_streaks        enable row level security;
alter table public.collections               enable row level security;
alter table public.collection_posts          enable row level security;
alter table public.ai_memories               enable row level security;
alter table public.ai_memory_posts           enable row level security;

-- ── profiles policies ─────────────────────────────────────────
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- ── posts policies ────────────────────────────────────────────
create policy "Public posts are viewable by authenticated users"
  on public.posts for select to authenticated
  using (privacy = 'public' or user_id = auth.uid());

create policy "Users can create their own posts"
  on public.posts for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their own posts"
  on public.posts for update to authenticated
  using (user_id = auth.uid());

create policy "Users can delete their own posts"
  on public.posts for delete to authenticated
  using (user_id = auth.uid());

-- ── stories policies ──────────────────────────────────────────
create policy "Stories are readable by following users or owner"
  on public.stories for select to authenticated
  using (expires_at > now() and (
    user_id = auth.uid()
    or exists (select 1 from public.follows where follower_id = auth.uid() and following_id = stories.user_id)
  ));

create policy "Users can create their own stories"
  on public.stories for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can delete their own stories"
  on public.stories for delete to authenticated
  using (user_id = auth.uid());

-- ── story_views policies ──────────────────────────────────────
create policy "Story views are viewable by story owner"
  on public.story_views for select to authenticated
  using (exists (select 1 from public.stories where id = story_id and user_id = auth.uid()));

create policy "Authenticated users can record story views"
  on public.story_views for insert to authenticated
  with check (viewer_id = auth.uid());

-- ── interests policies ────────────────────────────────────────
create policy "Interests are readable by all authenticated users"
  on public.interests for select to authenticated using (true);

-- ── user_interests policies ───────────────────────────────────
create policy "Users can manage their own interests"
  on public.user_interests for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── follows policies ──────────────────────────────────────────
create policy "Follows are viewable by authenticated users"
  on public.follows for select to authenticated using (true);

create policy "Users can follow/unfollow"
  on public.follows for insert to authenticated
  with check (follower_id = auth.uid());

create policy "Users can only unfollow themselves"
  on public.follows for delete to authenticated
  using (follower_id = auth.uid());

-- ── post_likes policies ───────────────────────────────────────
create policy "Post likes are viewable by authenticated users"
  on public.post_likes for select to authenticated using (true);

create policy "Users can like posts"
  on public.post_likes for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can unlike posts"
  on public.post_likes for delete to authenticated
  using (user_id = auth.uid());

-- ── post_saves policies ───────────────────────────────────────
create policy "Users can only see their own saves"
  on public.post_saves for select to authenticated
  using (user_id = auth.uid());

create policy "Users can save posts"
  on public.post_saves for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can unsave posts"
  on public.post_saves for delete to authenticated
  using (user_id = auth.uid());

-- ── post_comments policies ────────────────────────────────────
create policy "Comments on posts are viewable"
  on public.post_comments for select to authenticated using (true);

create policy "Authenticated users can comment"
  on public.post_comments for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can delete their own comments"
  on public.post_comments for delete to authenticated
  using (user_id = auth.uid());

-- ── hashtags policies ─────────────────────────────────────────
create policy "Hashtags are readable by all"
  on public.hashtags for select to authenticated using (true);

create policy "Authenticated users can create hashtags"
  on public.hashtags for insert to authenticated with check (true);

-- ── post_hashtags policies ────────────────────────────────────
create policy "Post hashtags are readable by all"
  on public.post_hashtags for select to authenticated using (true);

create policy "Post owners can manage hashtags"
  on public.post_hashtags for all to authenticated
  using (exists (select 1 from public.posts where id = post_id and user_id = auth.uid()));

-- ── notifications policies ────────────────────────────────────
create policy "Users can only see their own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "System can insert notifications"
  on public.notifications for insert to authenticated
  with check (true);

create policy "Users can mark their own notifications as read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid());

-- ── conversations policies ────────────────────────────────────
create policy "Users can see conversations they participate in"
  on public.conversations for select to authenticated
  using (exists (
    select 1 from public.conversation_participants
    where conversation_id = conversations.id and user_id = auth.uid()
  ));

create policy "Authenticated users can create conversations"
  on public.conversations for insert to authenticated with check (true);

-- ── conversation_participants policies ─────────────────────────
create policy "Participants can see their conversation memberships"
  on public.conversation_participants for select to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conversation_participants.conversation_id
    and cp.user_id = auth.uid()
  ));

create policy "Authenticated users can join conversations"
  on public.conversation_participants for insert to authenticated
  with check (true);

-- ── messages policies ─────────────────────────────────────────
create policy "Participants can read messages"
  on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversation_participants
    where conversation_id = messages.conversation_id and user_id = auth.uid()
  ));

create policy "Participants can send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversation_participants
      where conversation_id = messages.conversation_id and user_id = auth.uid()
    )
  );

-- ── friendship_streaks policies ───────────────────────────────
create policy "Users can see their own streaks"
  on public.friendship_streaks for select to authenticated
  using (user1_id = auth.uid() or user2_id = auth.uid());

create policy "Users can manage their streaks"
  on public.friendship_streaks for all to authenticated
  using (user1_id = auth.uid() or user2_id = auth.uid())
  with check (user1_id = auth.uid() or user2_id = auth.uid());

-- ── collections policies ──────────────────────────────────────
create policy "Users can only see their own collections"
  on public.collections for select to authenticated
  using (user_id = auth.uid());

create policy "Users can manage their own collections"
  on public.collections for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── collection_posts policies ─────────────────────────────────
create policy "Users can see posts in their collections"
  on public.collection_posts for select to authenticated
  using (exists (select 1 from public.collections where id = collection_id and user_id = auth.uid()));

create policy "Users can manage posts in their collections"
  on public.collection_posts for all to authenticated
  using (exists (select 1 from public.collections where id = collection_id and user_id = auth.uid()));

-- ── ai_memories policies ──────────────────────────────────────
create policy "Users can only see their own AI memories"
  on public.ai_memories for select to authenticated
  using (user_id = auth.uid());

create policy "System can create AI memories for users"
  on public.ai_memories for insert to authenticated
  with check (user_id = auth.uid());

-- ── ai_memory_posts policies ──────────────────────────────────
create policy "Users can see all posts in their AI memories"
  on public.ai_memory_posts for select to authenticated
  using (exists (select 1 from public.ai_memories where id = ai_memory_id and user_id = auth.uid()));

-- ============================================================
-- STORAGE BUCKETS SETUP & POLICIES
-- ============================================================

insert into storage.buckets (id, name, public)
  values ('posts',   'posts',   true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('stories', 'stories', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('reels',   'reels',   true)
  on conflict (id) do nothing;

-- ── posts bucket policies ─────────────────────────────────────
drop policy if exists "posts bucket: public read" on storage.objects;
create policy "posts bucket: public read"
  on storage.objects for select
  using (bucket_id = 'posts');

drop policy if exists "posts bucket: auth insert" on storage.objects;
create policy "posts bucket: auth insert"
  on storage.objects for insert
  with check (bucket_id = 'posts' and auth.role() = 'authenticated');

-- ── avatars bucket policies ───────────────────────────────────
drop policy if exists "avatars bucket: public read" on storage.objects;
create policy "avatars bucket: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars bucket: auth insert" on storage.objects;
create policy "avatars bucket: auth insert"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- ── stories bucket policies ───────────────────────────────────
drop policy if exists "stories bucket: public read" on storage.objects;
create policy "stories bucket: public read"
  on storage.objects for select
  using (bucket_id = 'stories');

drop policy if exists "stories bucket: auth insert" on storage.objects;
create policy "stories bucket: auth insert"
  on storage.objects for insert
  with check (bucket_id = 'stories' and auth.role() = 'authenticated');

-- ── reels bucket policies ─────────────────────────────────────
drop policy if exists "reels bucket: public read" on storage.objects;
create policy "reels bucket: public read"
  on storage.objects for select
  using (bucket_id = 'reels');

drop policy if exists "reels bucket: auth insert" on storage.objects;
create policy "reels bucket: auth insert"
  on storage.objects for insert
  with check (bucket_id = 'reels' and auth.role() = 'authenticated');
