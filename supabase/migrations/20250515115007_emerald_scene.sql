/*
  # Storage Configuration

  1. Changes
    - Creates a public media bucket
    - Removes RLS restrictions
    - Ensures public access to media

  2. Security
    - Disables RLS for unrestricted access
    - Removes existing policies
*/

-- Create bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Remove any existing policies
delete from storage.policies
where bucket_id = 'media';

-- Allow public access to the bucket
update storage.buckets
set public = true
where id = 'media';