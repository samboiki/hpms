const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function addIsProcessedColumn() {
  console.log('🔧 Adding is_processed column to patient_documents table...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseServiceKey) {
    console.log('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false
    }
  });

  try {
    // Step 1: Add the column
    console.log('📝 Executing: ALTER TABLE patient_documents ADD COLUMN...');
    
    const { data: alterResult, error: alterError } = await supabase.rpc('exec_raw_sql', {
      sql_query: 'ALTER TABLE patient_documents ADD COLUMN IF NOT EXISTS is_processed BOOLEAN DEFAULT FALSE;'
    });
    
    if (alterError) {
      console.log('❌ Error adding column:', alterError);
    } else {
      console.log('✅ Column addition result:', alterResult);
    }

    // Step 2: Add comment
    console.log('📝 Adding column comment...');
    
    const { data: commentResult, error: commentError } = await supabase.rpc('exec_raw_sql', {
      sql_query: "COMMENT ON COLUMN patient_documents.is_processed IS 'Indicates whether the document has been processed/reviewed by staff';"
    });
    
    if (commentError) {
      console.log('⚠️  Comment error (non-critical):', commentError);
    } else {
      console.log('✅ Comment added:', commentResult);
    }

    // Step 3: Verify the column exists
    console.log('🔍 Verifying column was added...');
    
    const { data: verifyResult, error: verifyError } = await supabase.rpc('exec_raw_sql', {
      sql_query: `SELECT column_name, data_type, is_nullable, column_default 
                  FROM information_schema.columns 
                  WHERE table_name = 'patient_documents' 
                  AND column_name = 'is_processed';`
    });
    
    if (verifyError) {
      console.log('❌ Verification error:', verifyError);
    } else {
      console.log('🔍 Verification result:', verifyResult);
    }

    // Step 4: Test insert to make sure it works
    console.log('🧪 Testing column access...');
    
    const { data: testResult, error: testError } = await supabase.rpc('exec_raw_sql', {
      sql_query: `SELECT COUNT(*) as total_docs, 
                         COUNT(CASE WHEN is_processed = true THEN 1 END) as processed_docs,
                         COUNT(CASE WHEN is_processed = false THEN 1 END) as unprocessed_docs
                  FROM patient_documents;`
    });
    
    if (testError) {
      console.log('❌ Test query error:', testError);
    } else {
      console.log('✅ Test query successful:', testResult);
    }

    console.log('🎉 Migration completed successfully!');
    console.log('📋 Next steps:');
    console.log('   1. Restart your development server');
    console.log('   2. Try uploading documents again');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  }
}

addIsProcessedColumn();