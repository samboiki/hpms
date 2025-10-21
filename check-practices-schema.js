import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function getPracticesSchema() {
  console.log('🔍 Checking PRACTICES table schema...\n');

  try {
    // Use raw SQL query to get column details from information_schema
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT
          column_name,
          data_type,
          character_maximum_length,
          column_default,
          is_nullable,
          ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'practices'
        ORDER BY ordinal_position;
      `
    });

    if (error) {
      console.error('❌ Error fetching schema:', error);
      console.log('\n⚠️  Trying alternative method...\n');

      // Try direct query on the table to infer columns
      const { data: practiceData, error: practiceError } = await supabase
        .from('practices')
        .select('*')
        .limit(1);

      if (practiceError) {
        console.error('❌ Error fetching from practices:', practiceError);
        return;
      }

      if (practiceData && practiceData.length > 0) {
        console.log('✅ Successfully fetched practices table. Columns found:');
        console.log('='.repeat(100));
        Object.keys(practiceData[0]).forEach((key, index) => {
          const value = practiceData[0][key];
          const type = typeof value;
          console.log(`${index + 1}. ${key}`);
          console.log(`   Inferred Type: ${type}`);
          console.log(`   Sample Value: ${JSON.stringify(value)}`);
          console.log('');
        });
        console.log('='.repeat(100));
      }
      return;
    }

    if (!data || data.length === 0) {
      console.log('❌ practices table does not exist or has no columns');
      return;
    }

    console.log('📋 PRACTICES TABLE SCHEMA:');
    console.log('='.repeat(100));
    console.log('');

    data.forEach((col, index) => {
      console.log(`${index + 1}. ${col.column_name}`);
      console.log(`   Type: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
      console.log(`   Nullable: ${col.is_nullable}`);
      console.log(`   Default: ${col.column_default || 'None'}`);
      console.log('');
    });

    console.log('='.repeat(100));
    console.log(`\n✅ Total columns: ${data.length}\n`);

    // Also get a sample row to see actual data
    const { data: sampleData, error: sampleError } = await supabase
      .from('practices')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.log('⚠️  Could not fetch sample data:', sampleError.message);
    } else if (sampleData && sampleData.length > 0) {
      console.log('📊 SAMPLE DATA (First Row):');
      console.log('='.repeat(100));
      console.log(JSON.stringify(sampleData[0], null, 2));
      console.log('='.repeat(100));
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

getPracticesSchema().catch(console.error);