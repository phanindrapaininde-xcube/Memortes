-- ============================================================
-- Moment App — Database Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id              uuid references auth.users on delete cascade primary key,
  username        text unique not null,
  display_name    text,
  bio             text,
  avatar_url      text,
  followers_count integer default 0,
  following_count integer default 0,
  posts_count     integer default 0,
  created_at      timestamptz default now()
);

-- Posts (includes regular posts and reels)
create table if not exists public.posts (
  id             uuid default uuid_generate_v4() primary key,
  user_id        uuid references public.profiles(id) on delete cascade not null,
  type           text default 'post' check (type in ('post', 'reel')),
  image_url      text,
  video_url      text,
  caption        text,
  mood           text,
  privacy        text default 'public' check (privacy in ('public','friends','close_friends')),
  likes_count    integer default 0,
  comments_count integer default 0,
  created_at     timestamptz default now()
);

-- Likes
create table if not exists public.likes (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  post_id    uuid references public.posts(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, post_id)
);

-- Comments
create table if not exists public.comments (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  post_id    uuid references public.posts(id) on delete cascade not null,
  text       text not null,
  created_at timestamptz default now()
);

-- Messages
create table if not exists public.messages (
  id          uuid default uuid_generate_v4() primary key,
  sender_id   uuid references public.profiles(id) on delete cascade not null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  text        text,
  created_at  timestamptz default now()
);

-- Stories (ephemeral — expire after 24 hours)
create table if not exists public.stories (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  image_url  text not null,
  expires_at timestamptz default (now() + interval '24 hours'),
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.posts    enable row level security;
alter table public.likes    enable row level security;
alter table public.comments enable row level security;
alter table public.messages enable row level security;
alter table public.stories  enable row level security;

-- Profiles policies
create policy "profiles: public read"
  on public.profiles for select using (true);
create policy "profiles: own insert"
  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: own update"
  on public.profiles for update using (auth.uid() = id);

-- Posts policies
create policy "posts: public read"
  on public.posts for select
  using (privacy = 'public' or auth.uid() = user_id);
create policy "posts: own insert"
  on public.posts for insert with check (auth.uid() = user_id);
create policy "posts: own update"
  on public.posts for update using (auth.uid() = user_id);
create policy "posts: own delete"
  on public.posts for delete using (auth.uid() = user_id);

-- Likes policies
create policy "likes: public read"
  on public.likes for select using (true);
create policy "likes: own insert"
  on public.likes for insert with check (auth.uid() = user_id);
create policy "likes: own delete"
  on public.likes for delete using (auth.uid() = user_id);

-- Comments policies
create policy "comments: public read"
  on public.comments for select using (true);
create policy "comments: own insert"
  on public.comments for insert with check (auth.uid() = user_id);
create policy "comments: own delete"
  on public.comments for delete using (auth.uid() = user_id);

-- Messages policies
create policy "messages: own read"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "messages: own insert"
  on public.messages for insert with check (auth.uid() = sender_id);

-- Stories policies
create policy "stories: public read"
  on public.stories for select using (expires_at > now());
create policy "stories: own insert"
  on public.stories for insert with check (auth.uid() = user_id);
create policy "stories: own delete"
  on public.stories for delete using (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGN-UP
-- ============================================================

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
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- STORAGE BUCKETS
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

-- Storage policies
create policy "posts bucket: public read"
  on storage.objects for select
  using (bucket_id = 'posts');

create policy "posts bucket: auth insert"
  on storage.objects for insert
  with check (bucket_id = 'posts' and auth.role() = 'authenticated');

create policy "avatars bucket: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars bucket: auth insert"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

create policy "stories bucket: public read"
  on storage.objects for select
  using (bucket_id = 'stories');

create policy "stories bucket: auth insert"
  on storage.objects for insert
  with check (bucket_id = 'stories' and auth.role() = 'authenticated');

create policy "reels bucket: public read"
  on storage.objects for select
  using (bucket_id = 'reels');

create policy "reels bucket: auth insert"
  on storage.objects for insert
  with check (bucket_id = 'reels' and auth.role() = 'authenticated');
