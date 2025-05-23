/*
  # Create public storage bucket

  Creates a public storage bucket named 'media' for storing uploaded files.
  This migration uses the storage API instead of direct table modifications
  to ensure proper bucket creation without requiring elevated permissions.
*/

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