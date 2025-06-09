import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNTQ4NDE3NywiZXhwIjoyMDMxMDYwMTc3fQ.zCdHxqPy6wJH8_FQDBTLgokd-K42ow73zT6wNO9ik7c'
);

async function createDocumentsTable() {
  try {
    console.log('Creating patient_documents table...');
    
    // First, create the table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS patient_documents (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
        file_name TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'general',
        tags TEXT[],
        uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    const { error: createError } = await supabase.from('patient_documents').select('id').limit(1);
    
    if (createError && createError.code === '42P01') {
      // Table doesn't exist, we need to create it
      console.log('Table does not exist, let me create it via a migration file instead...');
      
      // Let's check what tables already exist
      const { data: tables, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      console.log('Existing tables:', tables?.map(t => t.table_name) || 'Error getting tables');
      
    } else {
      console.log('Table already exists or other error:', createError);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

createDocumentsTable();