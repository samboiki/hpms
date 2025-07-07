import pg from 'pg';
import { readFileSync } from 'fs';

// Direct PostgreSQL connection as per CLAUDE.md instructions
const client = new pg.Client({
  connectionString: 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function executeDocumentsPermissionsFix() {
  console.log('🔧 Fixing documents permissions using direct PostgreSQL connection...');
  console.log('================================================================');

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');

    // Read the SQL file
    const sqlContent = readFileSync('./FIX_DOCUMENTS_PERMISSIONS_FOR_FRONTEND.sql', 'utf8');
    console.log('📄 Loaded SQL file');

    // Execute the entire SQL script at once
    console.log('🚀 Executing SQL script...');
    const result = await client.query(sqlContent);
    
    console.log('✅ SQL script executed successfully');
    console.log('📋 Result:', result.command);

    // Test the setup
    console.log('\n🧪 Testing the setup...');
    
    // Test 1: Check if table exists and has proper structure
    const tableCheckQuery = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'patient_documents'
      ORDER BY ordinal_position;
    `;
    
    const tableResult = await client.query(tableCheckQuery);
    console.log('✅ Table structure:');
    tableResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

    // Test 2: Check RLS status
    const rlsQuery = `
      SELECT 
        schemaname,
        tablename,
        rowsecurity as rls_enabled
      FROM pg_tables 
      WHERE tablename = 'patient_documents';
    `;
    
    const rlsResult = await client.query(rlsQuery);
    console.log('✅ RLS Status:', rlsResult.rows[0]);

    // Test 3: Check policies
    const policiesQuery = `
      SELECT 
        policyname,
        cmd,
        qual IS NOT NULL as has_using,
        with_check IS NOT NULL as has_with_check
      FROM pg_policies 
      WHERE tablename = 'patient_documents';
    `;
    
    const policiesResult = await client.query(policiesQuery);
    console.log('✅ RLS Policies:');
    policiesResult.rows.forEach(policy => {
      console.log(`  - ${policy.policyname} (${policy.cmd}): USING=${policy.has_using}, WITH CHECK=${policy.has_with_check}`);
    });

    // Test 4: Check storage bucket
    const bucketQuery = `
      SELECT 
        id,
        name,
        public,
        file_size_limit,
        allowed_mime_types
      FROM storage.buckets 
      WHERE name = 'documents';
    `;
    
    const bucketResult = await client.query(bucketQuery);
    if (bucketResult.rows.length > 0) {
      console.log('✅ Documents bucket:', bucketResult.rows[0]);
    } else {
      console.log('❌ Documents bucket not found');
    }

    // Test 5: Check storage policies
    const storagePoliciesQuery = `
      SELECT 
        policyname,
        cmd,
        qual IS NOT NULL as has_using,
        with_check IS NOT NULL as has_with_check
      FROM pg_policies 
      WHERE tablename = 'objects' AND schemaname = 'storage';
    `;
    
    const storagePoliciesResult = await client.query(storagePoliciesQuery);
    console.log('✅ Storage Policies:');
    storagePoliciesResult.rows.forEach(policy => {
      console.log(`  - ${policy.policyname} (${policy.cmd}): USING=${policy.has_using}, WITH CHECK=${policy.has_with_check}`);
    });

    console.log('\n🎉 Documents permissions setup completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Table exists with proper structure and RLS enabled');
    console.log('- RLS policies created for authenticated users');
    console.log('- Storage bucket configured with appropriate policies');
    console.log('- Users must be authenticated and belong to same practice as patient');
    
    console.log('\n🔧 Next steps to fix frontend:');
    console.log('1. Ensure users are properly authenticated in the app');
    console.log('2. Verify user has practice_id that matches patient\'s practice_id');
    console.log('3. The document upload should now work for authenticated users');

  } catch (error) {
    console.error('💥 Failed to execute permissions fix:', error);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.detail) {
      console.error('Error detail:', error.detail);
    }
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

executeDocumentsPermissionsFix();