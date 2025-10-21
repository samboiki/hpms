import { createClient } from '@supabase/supabase-js';

// Database credentials (using service role key for admin operations)
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

// Create Supabase client with service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkPracticeSettings() {
  console.log('🔍 Checking practice_settings table...\n');

  try {
    // Check if practice_settings table exists and get its columns
    const { data: columns, error } = await supabase
      .rpc('execute_sql', {
        query: `
          SELECT
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'practice_settings'
          ORDER BY ordinal_position;
        `
      });

    if (error) {
      // Try alternative method using direct query
      const { data: altData, error: altError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .eq('table_name', 'practice_settings')
        .order('ordinal_position');

      if (altError) {
        console.error('❌ Error fetching table structure:', altError);
        console.log('\n⚠️  Table may not exist. Checking if table exists...');

        // Check if table exists at all
        const { data: tableCheck, error: tableError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .eq('table_name', 'practice_settings')
          .single();

        if (tableError || !tableCheck) {
          console.log('❌ practice_settings table DOES NOT EXIST\n');
          return;
        }

        console.log('✅ Table exists but column query failed\n');
        return;
      }

      // Use alternative data
      console.log('📋 practice_settings table structure:\n');
      if (altData && altData.length > 0) {
        altData.forEach(col => {
          console.log(`  • ${col.column_name}`);
          console.log(`    Type: ${col.data_type}`);
          console.log(`    Nullable: ${col.is_nullable}`);
          if (col.column_default) {
            console.log(`    Default: ${col.column_default}`);
          }
          console.log('');
        });

        // Get row count
        const { count } = await supabase
          .from('practice_settings')
          .select('*', { count: 'exact', head: true });

        console.log(`\n📊 Total rows: ${count || 0}\n`);
      } else {
        console.log('  ⚠️  No columns found\n');
      }
      return;
    }

    // If RPC succeeded
    if (!columns || columns.length === 0) {
      console.log('❌ practice_settings table DOES NOT EXIST\n');
      return;
    }

    console.log('✅ practice_settings table EXISTS\n');
    console.log('📋 Table structure:\n');

    columns.forEach(col => {
      console.log(`  • ${col.column_name}`);
      console.log(`    Type: ${col.data_type}`);
      console.log(`    Nullable: ${col.is_nullable}`);
      if (col.column_default) {
        console.log(`    Default: ${col.column_default}`);
      }
      console.log('');
    });

    // Get row count
    const { count } = await supabase
      .from('practice_settings')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📊 Total rows: ${count || 0}\n`);

    // Get sample data if exists
    if (count > 0) {
      const { data: samples, error: sampleError } = await supabase
        .from('practice_settings')
        .select('*')
        .limit(3);

      if (!sampleError && samples && samples.length > 0) {
        console.log('📄 Sample data (first 3 rows):\n');
        samples.forEach((row, idx) => {
          console.log(`  Row ${idx + 1}:`);
          Object.entries(row).forEach(([key, value]) => {
            console.log(`    ${key}: ${JSON.stringify(value)}`);
          });
          console.log('');
        });
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

async function main() {
  console.log('🚀 Practice Settings Table Check\n');
  console.log(`🔗 Database: ${SUPABASE_URL}\n`);

  await checkPracticeSettings();

  console.log('✅ Check complete!\n');
}

main().catch(console.error);
