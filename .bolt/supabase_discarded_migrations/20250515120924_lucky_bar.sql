/*
  # Storage Configuration

  1. Changes
    - Creates a public media bucket for storing files
    - Sets up RLS policies for authenticated users to manage files
    - Enables public read access to media files

  2. Security
    - Authenticated users can upload, update, and delete files
    - Public users can view files
    - All operations are restricted to the media bucket
*/

-- Create the storage schema if it doesn't exist
create schema if not exists storage;

-- Create the media bucket
insert into storage.buckets (id, name)
values ('media', 'media')
on conflict (id) do nothing;

-- Enable RLS
alter table storage.objects enable row level security;

-- Create policies for authenticated users
create policy "Authenticated users can upload media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'media');

create policy "Authenticated users can update own media"
on storage.objects for update
to authenticated
using (bucket_id = 'media' and auth.uid() = owner);

create policy "Authenticated users can delete own media"
on storage.objects for delete
to authenticated
using (bucket_id = 'media' and auth.uid() = owner);

create policy "Anyone can view media"
on storage.objects for select
to public
using (bucket_id = 'media');