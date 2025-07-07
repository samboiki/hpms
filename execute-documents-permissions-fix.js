import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Use service role for full database access
const supabase = createClient(
  'https://jjxlfunlbyayxwvlpgwt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA'
);

async function executeDocumentsPermissionsFix() {
  console.log('🔧 Fixing documents permissions for frontend access...');
  console.log('=======================================================');

  try {
    // Read the SQL file
    const sqlContent = readFileSync('./FIX_DOCUMENTS_PERMISSIONS_FOR_FRONTEND.sql', 'utf8');
    console.log('📄 Loaded SQL file');

    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0 && !statement.startsWith('--'));

    console.log('📋 Found', statements.length, 'SQL statements to execute');

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.includes('DO $$')) {
        // Handle DO blocks specially
        const doBlock = statements.slice(i).join(';').split('END $$')[0] + 'END $$';
        console.log(`\n${i + 1}. Executing DO block...`);
        
        try {
          const { error } = await supabase.rpc('exec', { sql: doBlock });
          if (error) {
            console.error('❌ Error:', error.message);
            errorCount++;
          } else {
            console.log('✅ DO block executed successfully');
            successCount++;
          }
        } catch (err) {
          console.error('❌ Exception:', err.message);
          errorCount++;
        }
        break; // Skip remaining statements as they're part of the DO block
      } else {
        console.log(`\n${i + 1}. Executing: ${statement.substring(0, 60)}...`);
        
        try {
          const { error } = await supabase.rpc('exec', { sql: statement });
          if (error) {
            console.error('❌ Error:', error.message);
            errorCount++;
          } else {
            console.log('✅ Success');
            successCount++;
          }
        } catch (err) {
          console.error('❌ Exception:', err.message);
          errorCount++;
        }
      }
    }

    console.log('\n📊 Execution Summary:');
    console.log('✅ Successful:', successCount);
    console.log('❌ Errors:', errorCount);

    // Test the setup
    console.log('\n🧪 Testing the setup...');
    
    // Test 1: Check if table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from('patient_documents')
      .select('count', { count: 'exact', head: true });
    
    if (tableError) {
      console.error('❌ Table test failed:', tableError.message);
    } else {
      console.log('✅ Table exists and is accessible');
    }

    // Test 2: Check bucket
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.error('❌ Bucket test failed:', bucketsError.message);
    } else {
      const documentsBucket = buckets.find(b => b.name === 'documents');
      if (documentsBucket) {
        console.log('✅ Documents bucket exists');
      } else {
        console.error('❌ Documents bucket not found');
      }
    }

    // Test 3: Test with anon key (simulating frontend)
    console.log('\n🔬 Testing with anon key (frontend simulation)...');
    const anonSupabase = createClient(
      'https://jjxlfunlbyayxwvlpgwt.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM'
    );

    // Check if we can access the table with anon key (should fail without auth)
    const { data: anonTableCheck, error: anonTableError } = await anonSupabase
      .from('patient_documents')
      .select('count', { count: 'exact', head: true });
    
    if (anonTableError) {
      console.log('⚠️ Anon access blocked (expected):', anonTableError.message);
    } else {
      console.log('✅ Anon can access table structure');
    }

    console.log('\n🎉 Permissions fix completed!');
    console.log('\nNext steps:');
    console.log('1. Frontend users must be authenticated to upload documents');
    console.log('2. Check that users have proper practice_id relationships');
    console.log('3. Test the DocumentUploadModal with a logged-in user');

  } catch (error) {
    console.error('💥 Failed to execute permissions fix:', error);
  }
}

executeDocumentsPermissionsFix();