/*
  # Create Media Storage Bucket

  1. Storage Configuration
    - Creates a new public storage bucket named 'media'
    - Configures security policies for the bucket
  
  2. Security
    - Allows authenticated users to upload files
    - Allows authenticated users to update their files
    - Allows public access to view files
    - Allows authenticated users to delete their files
*/

-- Create the media storage bucket using the storage API
SELECT storage.create_bucket('media', {'public': true});

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