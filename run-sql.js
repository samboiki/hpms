import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNDEzNjAwNywiZXhwIjoyMDI5NzEyMDA3fQ.pMI9eXs0W0CDONxdvLIGhPEp5Kt8HW8TqYhyI2hR93s'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runSQL() {
  try {
    console.log('🔗 Executing SQL...')
    
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: `
        -- Add AI extraction fields to lab_requests table
        ALTER TABLE lab_requests 
        ADD COLUMN IF NOT EXISTS request_form_file_ids UUID[],
        ADD COLUMN IF NOT EXISTS extracted_request_data JSONB,
        ADD COLUMN IF NOT EXISTS extracted_results_data JSONB,
        ADD COLUMN IF NOT EXISTS ai_processing_status TEXT DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
      `
    })

    if (error) {
      console.error('❌ Error:', error)
    } else {
      console.log('✅ Success:', data)
    }
  } catch (error) {
    console.error('💥 Exception:', error)
  }
}

runSQL()