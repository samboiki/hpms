import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNTQ4NDE3NywiZXhwIjoyMDMxMDYwMTc3fQ.zCdHxqPy6wJH8_FQDBTLgokd-K42ow73zT6wNO9ik7c'
);

async function applyMigration() {
  try {
    console.log('🚀 Applying patient_documents table migration...');
    
    // Read the migration SQL
    const migrationSQL = fs.readFileSync('./supabase/migrations/20250610000000_create_patient_documents_table.sql', 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { data, error } = await supabase.rpc('exec', {
          sql: statement
        });
        
        if (error) {
          console.error(`Error in statement ${i + 1}:`, error);
          if (!error.message.includes('already exists')) {
            throw error;
          } else {
            console.log(`Statement ${i + 1}: Already exists, skipping...`);
          }
        } else {
          console.log(`Statement ${i + 1}: Success ✅`);
        }
      } catch (statementError) {
        console.error(`Failed to execute statement ${i + 1}:`, statementError.message);
        if (!statementError.message.includes('already exists')) {
          throw statementError;
        }
      }
    }
    
    console.log('🎉 Migration completed successfully!');
    
    // Verify the table was created
    console.log('🔍 Verifying table creation...');
    const { data: tableCheck, error: checkError } = await supabase
      .from('patient_documents')
      .select('count', { count: 'exact', head: true });
    
    if (checkError) {
      console.error('Table verification failed:', checkError);
    } else {
      console.log('✅ Table verified successfully - patient_documents table is ready!');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    // Try alternative approach - create table directly
    console.log('🔄 Trying alternative approach...');
    
    try {
      const { error: directError } = await supabase.rpc('sql', {
        query: `
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
          );
        `
      });
      
      if (directError) {
        console.error('Direct creation also failed:', directError);
      } else {
        console.log('✅ Table created using direct approach');
      }
    } catch (directErr) {
      console.error('Direct creation error:', directErr);
    }
  }
}

applyMigration();