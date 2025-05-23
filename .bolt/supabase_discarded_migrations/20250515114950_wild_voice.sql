-- Disable RLS on storage.objects table
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "authenticated can upload media" ON storage.objects;
DROP POLICY IF EXISTS "authenticated can update media" ON storage.objects;
DROP POLICY IF EXISTS "public can view media" ON storage.objects;
DROP POLICY IF EXISTS "authenticated can delete media" ON storage.objects;

-- Create a function to ensure the bucket exists
create or replace function create_storage_bucket()
returns void as $$
begin
  insert into storage.buckets (id, name, public)
  values ('media', 'media', true)
  on conflict (id) do nothing;
end;
$$ language plpgsql;

-- Execute the function
select create_storage_bucket();

-- Clean up by dropping the function
drop function if exists create_storage_bucket();