import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNTQ4NDE3NywiZXhwIjoyMDMxMDYwMTc3fQ.zCdHxqPy6wJH8_FQDBTLgokd-K42ow73zT6wNO9ik7c'
);

async function checkAndCreateBucket() {
  try {
    // Check if documents bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }
    
    console.log('Existing buckets:', buckets.map(b => b.name));
    
    const documentsBucket = buckets.find(bucket => bucket.name === 'documents');
    
    if (!documentsBucket) {
      console.log('Creating documents bucket...');
      const { data, error } = await supabase.storage.createBucket('documents', {
        public: false,
        allowedMimeTypes: [
          'application/pdf',
          'image/jpeg',
          'image/png', 
          'image/gif',
          'image/webp',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ],
        fileSizeLimit: 50 * 1024 * 1024 // 50MB
      });
      
      if (error) {
        console.error('Error creating bucket:', error);
      } else {
        console.log('Documents bucket created successfully:', data);
      }
    } else {
      console.log('Documents bucket already exists');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAndCreateBucket().then(() => {
  console.log('Storage bucket check completed');
  process.exit(0);
});