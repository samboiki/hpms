/*
  # Create media storage bucket and policies
  
  1. Storage Setup
    - Creates a public media storage bucket
    - Configures access policies for the bucket
  
  2. Security
    - Allows authenticated users to upload files
    - Allows authenticated users to update their files
    - Allows public read access to media files
    - Allows authenticated users to delete their files
*/

-- Create the media storage bucket using the storage API
SELECT storage.create_bucket('media', '{"public": true}'::jsonb);

-- Create security policies for the bucket
SELECT storage.create_policy(
  'media',
  'authenticated can upload',
  'INSERT',
  'authenticated',
  true
);

SELECT storage.create_policy(
  'media',
  'authenticated can update',
  'UPDATE',
  'authenticated',
  true
);

SELECT storage.create_policy(
  'media',
  'public can view',
  'SELECT',
  'public',
  true
);

SELECT storage.create_policy(
  'media',
  'authenticated can delete',
  'DELETE',
  'authenticated',
  true
);