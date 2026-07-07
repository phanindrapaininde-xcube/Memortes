-- ============================================================
-- Memortes — Initial Schema
-- Migration: 001_initial_schema
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";   -- full-text search support

-- ── Custom Enum Types ─────────────────────────────────────────
create type post_type      as enum ('post', 'reel');
create type privacy_level  as enum ('public', 'friends', 'close_friends');
create type convo_type     as enum ('direct', 'group');
create type message_type   as enum ('text', 'image', 'voice', 'memory', 'story_reply');
create type notif_type     as enum ('like', 'comment', 'follow', 'mention', 'story_view', 'reel_view', 'birthday');
create type streak_badge   as enum ('best_friend', 'close_friend', 'active', 'new_friend');

-- ============================================================
-- CORE TABLES
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────
-- Extends auth.users — created automatically via trigger on sign-up
create table public.profiles (
  id                uuid        primary key references auth.users(id) on delete cascade,
  username          text        not null unique,
  display_name      text        not null default '',
  bio               text        default '',
  avatar_url        text,
  cover_url         text,
  website           text,
  is_private        boolean     not null default false,
  is_verified       boolean     not null default false,
  moment_mode       boolean     not null default true,
  followers_count   integer     not null default 0,
  following_count   integer     not null default 0,
  posts_count       integer     not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint username_length check (char_length(username) >= 3 and char_length(username) <= 30),
  constraint username_format check (username ~ '^[a-z0-9_.]+$')
);

-- ── posts ────────────────────────────────────────────────────
create table public.posts (
  id              uuid          primary key default uuid_generate_v4(),
  user_id         uuid          not null references public.profiles(id) on delete cascade,
  type            post_type     not null default 'post',
  media_url       text          not null,
  thumbnail_url   text,
  caption         text          default '',
  location        text,
  mood            text,
  privacy         privacy_level not null default 'public',
  likes_count     integer       not null default 0,
  comments_count  integer       not null default 0,
  saves_count     integer       not null default 0,
  views_count     integer       not null default 0,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

create index idx_posts_user_id    on public.posts(user_id);
create index idx_posts_created_at on public.posts(created_at desc);
create index idx_posts_type       on public.posts(type);

-- ── stories ──────────────────────────────────────────────────
create table public.stories (
  id            uuid        primary key default uuid_generate_v4(),
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  media_url     text        not null,
  views_count   integer     not null default 0,
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  created_at    timestamptz not null default now()
);

create index idx_stories_user_id    on public.stories(user_id);
create index idx_stories_expires_at on public.stories(expires_at);

-- ── interests ────────────────────────────────────────────────
create table public.interests (
  id          text primary key,  -- e.g. 'travel', 'food'
  label       text not null,
  emoji       text not null,
  posts_count integer not null default 0
);

-- Seed interests
insert into public.interests (id, label, emoji) values
  ('travel',      'Travel',       '✈️'),
  ('food',        'Food',         '🍜'),
  ('music',       'Music',        '🎵'),
  ('fashion',     'Fashion',      '👗'),
  ('sports',      'Sports',       '⚽'),
  ('art',         'Art',          '🎨'),
  ('tech',        'Tech',         '💻'),
  ('gaming',      'Gaming',       '🎮'),
  ('film',        'Film',         '🎬'),
  ('books',       'Books',        '📚'),
  ('wellness',    'Wellness',     '🧘'),
  ('photography', 'Photography',  '📸'),
  ('nature',      'Nature',       '🌿'),
  ('coffee',      'Coffee',       '☕'),
  ('dance',       'Dance',        '💃'),
  ('pets',        'Pets',         '🐾');

-- ── user_interests ────────────────────────────────────────────
create table public.user_interests (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  interest_id text not null references public.interests(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, interest_id)
);

-- ============================================================
-- SOCIAL GRAPH
-- ============================================================

-- ── follows ──────────────────────────────────────────────────
create table public.follows (
  id           uuid        primary key default uuid_generate_v4(),
  follower_id  uuid        not null references public.profiles(id) on delete cascade,
  following_id uuid        not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (follower_id, following_id),
  constraint no_self_follow check (follower_id != following_id)
);

create index idx_follows_follower_id  on public.follows(follower_id);
create index idx_follows_following_id on public.follows(following_id);

-- ── post_likes ───────────────────────────────────────────────
create table public.post_likes (
  id         uuid        primary key default uuid_generate_v4(),
  post_id    uuid        not null references public.posts(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index idx_post_likes_post_id on public.post_likes(post_id);
create index idx_post_likes_user_id on public.post_likes(user_id);

-- ── post_saves ───────────────────────────────────────────────
create table public.post_saves (
  id            uuid        primary key default uuid_generate_v4(),
  post_id       uuid        not null references public.posts(id) on delete cascade,
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  collection_id uuid,       -- FK added after collections table
  created_at    timestamptz not null default now(),
  unique (post_id, user_id)
);

create index idx_post_saves_user_id on public.post_saves(user_id);

-- ── post_comments ─────────────────────────────────────────────
create table public.post_comments (
  id          uuid        primary key default uuid_generate_v4(),
  post_id     uuid        not null references public.posts(id) on delete cascade,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  parent_id   uuid        references public.post_comments(id) on delete cascade,
  text        text        not null,
  likes_count integer     not null default 0,
  created_at  timestamptz not null default now(),

  constraint comment_text_length check (char_length(text) > 0 and char_length(text) <= 2000)
);

create index idx_post_comments_post_id   on public.post_comments(post_id);
create index idx_post_comments_parent_id on public.post_comments(parent_id);

-- ── comment_likes ─────────────────────────────────────────────
create table public.comment_likes (
  id         uuid        primary key default uuid_generate_v4(),
  comment_id uuid        not null references public.post_comments(id) on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

-- ── story_views ───────────────────────────────────────────────
create table public.story_views (
  id         uuid        primary key default uuid_generate_v4(),
  story_id   uuid        not null references public.stories(id) on delete cascade,
  viewer_id  uuid        not null references public.profiles(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  unique (story_id, viewer_id)
);

create index idx_story_views_story_id on public.story_views(story_id);

-- ── hashtags ──────────────────────────────────────────────────
create table public.hashtags (
  id          uuid    primary key default uuid_generate_v4(),
  name        text    not null unique,
  posts_count integer not null default 0
);

create index idx_hashtags_name on public.hashtags using gin (name gin_trgm_ops);

-- ── post_hashtags ─────────────────────────────────────────────
create table public.post_hashtags (
  post_id    uuid not null references public.posts(id) on delete cascade,
  hashtag_id uuid not null references public.hashtags(id) on delete cascade,
  primary key (post_id, hashtag_id)
);

-- ── notifications ─────────────────────────────────────────────
create table public.notifications (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,  -- recipient
  actor_id    uuid        not null references public.profiles(id) on delete cascade,  -- who triggered it
  type        notif_type  not null,
  entity_type text        not null,  -- 'post' | 'comment' | 'story' | 'profile'
  entity_id   uuid        not null,
  is_read     boolean     not null default false,
  created_at  timestamptz not null default now()
);

create index idx_notifications_user_id    on public.notifications(user_id, is_read, created_at desc);
create index idx_notifications_created_at on public.notifications(created_at desc);

-- ============================================================
-- MESSAGING
-- ============================================================

-- ── conversations ─────────────────────────────────────────────
create table public.conversations (
  id              uuid        primary key default uuid_generate_v4(),
  type            convo_type  not null default 'direct',
  name            text,       -- for group chats
  last_message_at timestamptz,
  created_at      timestamptz not null default now()
);

-- ── conversation_participants ─────────────────────────────────
create table public.conversation_participants (
  id              uuid        primary key default uuid_generate_v4(),
  conversation_id uuid        not null references public.conversations(id) on delete cascade,
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create index idx_conv_participants_user_id on public.conversation_participants(user_id);

-- ── messages ──────────────────────────────────────────────────
create table public.messages (
  id                  uuid         primary key default uuid_generate_v4(),
  conversation_id     uuid         not null references public.conversations(id) on delete cascade,
  sender_id           uuid         not null references public.profiles(id) on delete cascade,
  type                message_type not null default 'text',
  text                text,
  media_url           text,
  duration_sec        integer,     -- for voice messages
  referenced_post_id  uuid         references public.posts(id) on delete set null,
  is_read             boolean      not null default false,
  created_at          timestamptz  not null default now()
);

create index idx_messages_conversation_id on public.messages(conversation_id, created_at desc);
create index idx_messages_sender_id       on public.messages(sender_id);

-- ── friendship_streaks ────────────────────────────────────────
create table public.friendship_streaks (
  id                  uuid         primary key default uuid_generate_v4(),
  user_id_1           uuid         not null references public.profiles(id) on delete cascade,
  user_id_2           uuid         not null references public.profiles(id) on delete cascade,
  streak_days         integer      not null default 0,
  last_interaction_at timestamptz  not null default now(),
  expires_at          timestamptz  not null default (now() + interval '24 hours'),
  badge               streak_badge not null default 'new_friend',
  created_at          timestamptz  not null default now(),
  unique (user_id_1, user_id_2),
  constraint ordered_users check (user_id_1 < user_id_2)
);

create index idx_streaks_user_id_1 on public.friendship_streaks(user_id_1);
create index idx_streaks_user_id_2 on public.friendship_streaks(user_id_2);

-- ============================================================
-- COLLECTIONS & AI MEMORIES
-- ============================================================

-- ── collections ───────────────────────────────────────────────
create table public.collections (
  id               uuid        primary key default uuid_generate_v4(),
  user_id          uuid        not null references public.profiles(id) on delete cascade,
  name             text        not null,
  emoji            text        default '📁',
  is_ai_generated  boolean     not null default false,
  posts_count      integer     not null default 0,
  created_at       timestamptz not null default now()
);

create index idx_collections_user_id on public.collections(user_id);

-- ── collection_posts ──────────────────────────────────────────
create table public.collection_posts (
  id            uuid        primary key default uuid_generate_v4(),
  collection_id uuid        not null references public.collections(id) on delete cascade,
  post_id       uuid        not null references public.posts(id) on delete cascade,
  added_at      timestamptz not null default now(),
  unique (collection_id, post_id)
);

-- ── ai_memories ───────────────────────────────────────────────
-- Phase 2 — AI-generated memory albums
create table public.ai_memories (
  id            uuid        primary key default uuid_generate_v4(),
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  title         text        not null,
  summary       text,
  cover_url     text,
  mood          text,
  generated_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index idx_ai_memories_user_id on public.ai_memories(user_id, created_at desc);

-- ── ai_memory_posts ───────────────────────────────────────────
create table public.ai_memory_posts (
  memory_id        uuid  not null references public.ai_memories(id) on delete cascade,
  post_id          uuid  not null references public.posts(id) on delete cascade,
  relevance_score  real  default 0.0,
  primary key (memory_id, post_id)
);

-- ── Add FK from post_saves to collections ─────────────────────
alter table public.post_saves
  add constraint post_saves_collection_id_fkey
  foreign key (collection_id) references public.collections(id) on delete set null;

-- ============================================================
-- TRIGGERS — Maintain denormalized counts
-- ============================================================

-- ── Helper: increment/decrement ───────────────────────────────
create or replace function increment_count(tbl text, col text, row_id uuid, delta int)
returns void language plpgsql as $$
begin
  execute format('update %I set %I = %I + $1 where id = $2', tbl, col, col)
  using delta, row_id;
end;
$$;

-- ── profiles.followers_count ──────────────────────────────────
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

-- ── posts.saves_count ─────────────────────────────────────────
create or replace function trg_post_saves_count() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set saves_count = saves_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set saves_count = greatest(saves_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger trg_post_saves_count
after insert or delete on public.post_saves
for each row execute function trg_post_saves_count();

-- ── stories.views_count ───────────────────────────────────────
create or replace function trg_story_views_count() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.stories set views_count = views_count + 1 where id = new.story_id;
  end if;
  return null;
end;
$$;

create trigger trg_story_views_count
after insert on public.story_views
for each row execute function trg_story_views_count();

-- ── collections.posts_count ───────────────────────────────────
create or replace function trg_collection_posts_count() returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.collections set posts_count = posts_count + 1 where id = new.collection_id;
  elsif (tg_op = 'DELETE') then
    update public.collections set posts_count = greatest(posts_count - 1, 0) where id = old.collection_id;
  end if;
  return null;
end;
$$;

create trigger trg_collection_posts_count
after insert or delete on public.collection_posts
for each row execute function trg_collection_posts_count();

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

-- ── profiles.updated_at ───────────────────────────────────────
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

-- ── Auto-create profile on auth.users insert ──────────────────
create or replace function public.handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substring(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles                  enable row level security;
alter table public.posts                     enable row level security;
alter table public.stories                   enable row level security;
alter table public.interests                 enable row level security;
alter table public.user_interests            enable row level security;
alter table public.follows                   enable row level security;
alter table public.post_likes                enable row level security;
alter table public.post_saves                enable row level security;
alter table public.post_comments             enable row level security;
alter table public.comment_likes             enable row level security;
alter table public.story_views               enable row level security;
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

-- ── profiles ──────────────────────────────────────────────────
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- ── posts ─────────────────────────────────────────────────────
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

-- ── stories ───────────────────────────────────────────────────
create policy "Non-expired stories are viewable by authenticated users"
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

-- ── interests ─────────────────────────────────────────────────
create policy "Interests are readable by all authenticated users"
  on public.interests for select to authenticated using (true);

-- ── user_interests ────────────────────────────────────────────
create policy "Users can manage their own interests"
  on public.user_interests for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── follows ───────────────────────────────────────────────────
create policy "Follows are viewable by authenticated users"
  on public.follows for select to authenticated using (true);

create policy "Users can follow/unfollow"
  on public.follows for insert to authenticated
  with check (follower_id = auth.uid());

create policy "Users can only unfollow themselves"
  on public.follows for delete to authenticated
  using (follower_id = auth.uid());

-- ── post_likes ────────────────────────────────────────────────
create policy "Post likes are viewable by authenticated users"
  on public.post_likes for select to authenticated using (true);

create policy "Users can like posts"
  on public.post_likes for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can unlike posts"
  on public.post_likes for delete to authenticated
  using (user_id = auth.uid());

-- ── post_saves ────────────────────────────────────────────────
create policy "Users can only see their own saves"
  on public.post_saves for select to authenticated
  using (user_id = auth.uid());

create policy "Users can save posts"
  on public.post_saves for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can unsave posts"
  on public.post_saves for delete to authenticated
  using (user_id = auth.uid());

create policy "Users can update their saves (change collection)"
  on public.post_saves for update to authenticated
  using (user_id = auth.uid());

-- ── post_comments ─────────────────────────────────────────────
create policy "Comments on public posts are viewable"
  on public.post_comments for select to authenticated using (true);

create policy "Authenticated users can comment"
  on public.post_comments for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can delete their own comments"
  on public.post_comments for delete to authenticated
  using (user_id = auth.uid());

-- ── comment_likes ─────────────────────────────────────────────
create policy "Comment likes are viewable"
  on public.comment_likes for select to authenticated using (true);

create policy "Users can like/unlike comments"
  on public.comment_likes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── story_views ───────────────────────────────────────────────
create policy "Story views are viewable by story owner"
  on public.story_views for select to authenticated
  using (exists (select 1 from public.stories where id = story_id and user_id = auth.uid()));

create policy "Authenticated users can record story views"
  on public.story_views for insert to authenticated
  with check (viewer_id = auth.uid());

-- ── hashtags ──────────────────────────────────────────────────
create policy "Hashtags are readable by all"
  on public.hashtags for select to authenticated using (true);

create policy "Authenticated users can create hashtags"
  on public.hashtags for insert to authenticated with check (true);

-- ── post_hashtags ─────────────────────────────────────────────
create policy "Post hashtags are readable by all"
  on public.post_hashtags for select to authenticated using (true);

create policy "Post owners can manage hashtags"
  on public.post_hashtags for all to authenticated
  using (exists (select 1 from public.posts where id = post_id and user_id = auth.uid()));

-- ── notifications ─────────────────────────────────────────────
create policy "Users can only see their own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "System can insert notifications"
  on public.notifications for insert to authenticated
  with check (true);

create policy "Users can mark their own notifications as read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid());

-- ── conversations ─────────────────────────────────────────────
create policy "Users can see conversations they participate in"
  on public.conversations for select to authenticated
  using (exists (
    select 1 from public.conversation_participants
    where conversation_id = conversations.id and user_id = auth.uid()
  ));

create policy "Authenticated users can create conversations"
  on public.conversations for insert to authenticated with check (true);

-- ── conversation_participants ─────────────────────────────────
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

-- ── messages ──────────────────────────────────────────────────
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

-- ── friendship_streaks ────────────────────────────────────────
create policy "Users can see their own streaks"
  on public.friendship_streaks for select to authenticated
  using (user_id_1 = auth.uid() or user_id_2 = auth.uid());

create policy "System can manage streaks"
  on public.friendship_streaks for all to authenticated
  using (user_id_1 = auth.uid() or user_id_2 = auth.uid())
  with check (user_id_1 = auth.uid() or user_id_2 = auth.uid());

-- ── collections ───────────────────────────────────────────────
create policy "Users can only see their own collections"
  on public.collections for select to authenticated
  using (user_id = auth.uid());

create policy "Users can manage their own collections"
  on public.collections for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── collection_posts ──────────────────────────────────────────
create policy "Users can see posts in their collections"
  on public.collection_posts for select to authenticated
  using (exists (select 1 from public.collections where id = collection_id and user_id = auth.uid()));

create policy "Users can manage posts in their collections"
  on public.collection_posts for all to authenticated
  using (exists (select 1 from public.collections where id = collection_id and user_id = auth.uid()));

-- ── ai_memories ───────────────────────────────────────────────
create policy "Users can only see their own AI memories"
  on public.ai_memories for select to authenticated
  using (user_id = auth.uid());

create policy "System can create AI memories for users"
  on public.ai_memories for insert to authenticated
  with check (user_id = auth.uid());

create policy "System can see all posts in AI memories"
  on public.ai_memory_posts for select to authenticated
  using (exists (select 1 from public.ai_memories where id = memory_id and user_id = auth.uid()));

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
-- Run these in Supabase dashboard or via CLI:
--
-- insert into storage.buckets (id, name, public) values ('posts', 'posts', true);
-- insert into storage.buckets (id, name, public) values ('stories', 'stories', true);
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
-- insert into storage.buckets (id, name, public) values ('covers', 'covers', true);
--
-- Storage RLS:
-- create policy "Authenticated users can upload to posts"
--   on storage.objects for insert to authenticated
--   with check (bucket_id = 'posts' and auth.uid()::text = (storage.foldername(name))[1]);
--
-- create policy "Post media is publicly readable"
--   on storage.objects for select using (bucket_id in ('posts', 'stories', 'avatars', 'covers'));
--
-- create policy "Users can delete their own uploads"
--   on storage.objects for delete to authenticated
--   using (bucket_id in ('posts', 'stories', 'avatars', 'covers')
--     and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- REALTIME
-- ============================================================
-- Enable realtime on these tables (run in Supabase dashboard):
-- alter publication supabase_realtime add table public.messages;
-- alter publication supabase_realtime add table public.notifications;
-- alter publication supabase_realtime add table public.friendship_streaks;
