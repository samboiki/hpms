import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNTQ4NDE3NywiZXhwIjoyMDMxMDYwMTc3fQ.zCdHxqPy6wJH8_FQDBTLgokd-K42ow73zT6wNO9ik7c'
);

async function createDocumentsTable() {
  try {
    console.log('Creating patient_documents table...');
    
    const { data, error } = await supabase.rpc('execute_sql', {
      sql: `
        -- Create patient_documents table to track uploaded files
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

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id ON patient_documents(patient_id);
        CREATE INDEX IF NOT EXISTS idx_patient_documents_visit_id ON patient_documents(visit_id);
        CREATE INDEX IF NOT EXISTS idx_patient_documents_category ON patient_documents(category);
        CREATE INDEX IF NOT EXISTS idx_patient_documents_created_at ON patient_documents(created_at);
      `
    });

    if (error) {
      console.error('Error creating table:', error);
      return;
    }

    console.log('✅ patient_documents table created successfully');

    // Now enable RLS and create policies
    console.log('Setting up RLS policies...');
    
    const { error: rlsError } = await supabase.rpc('execute_sql', {
      sql: `
        -- Enable RLS
        ALTER TABLE patient_documents ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies
        CREATE POLICY "Users can view patient documents for their practice" ON patient_documents
          FOR SELECT 
          USING (
            patient_id IN (
              SELECT p.id 
              FROM patients p
              JOIN users u ON u.practice_id IS NOT NULL
              WHERE auth.uid() = u.id
            )
          );

        CREATE POLICY "Users can insert patient documents for their practice" ON patient_documents
          FOR INSERT 
          WITH CHECK (
            patient_id IN (
              SELECT p.id 
              FROM patients p
              JOIN users u ON u.practice_id IS NOT NULL
              WHERE auth.uid() = u.id
            )
          );

        CREATE POLICY "Users can update patient documents for their practice" ON patient_documents
          FOR UPDATE 
          USING (
            patient_id IN (
              SELECT p.id 
              FROM patients p
              JOIN users u ON u.practice_id IS NOT NULL
              WHERE auth.uid() = u.id
            )
          );

        CREATE POLICY "Users can delete patient documents for their practice" ON patient_documents
          FOR DELETE 
          USING (
            patient_id IN (
              SELECT p.id 
              FROM patients p
              JOIN users u ON u.practice_id IS NOT NULL
              WHERE auth.uid() = u.id
            )
          );
      `
    });

    if (rlsError) {
      console.error('Error setting up RLS:', rlsError);
    } else {
      console.log('✅ RLS policies created successfully');
    }

    // Create trigger
    const { error: triggerError } = await supabase.rpc('execute_sql', {
      sql: `
        -- Create updated_at trigger
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';

        CREATE TRIGGER update_patient_documents_updated_at 
          BEFORE UPDATE ON patient_documents 
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column();
      `
    });

    if (triggerError) {
      console.error('Error creating trigger:', triggerError);
    } else {
      console.log('✅ Triggers created successfully');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

createDocumentsTable();