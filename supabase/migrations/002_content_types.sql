-- Migration: Add content type to posts + reels support
-- Run in Supabase SQL Editor

-- Add type column to posts table
alter table public.posts
  add column if not exists type text default 'post'
    check (type in ('post', 'reel'));

-- Add video_url for reels
alter table public.posts
  add column if not exists video_url text;

-- Backfill existing rows to type='post'
update public.posts set type = 'post' where type is null;

-- Add storage bucket for reels
insert into storage.buckets (id, name, public)
  values ('reels', 'reels', true)
  on conflict (id) do nothing;

create policy "reels bucket: public read"
  on storage.objects for select
  using (bucket_id = 'reels');

create policy "reels bucket: auth insert"
  on storage.objects for insert
  with check (bucket_id = 'reels' and auth.role() = 'authenticated');
