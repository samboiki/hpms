const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

async function viewData() {
  try {
    console.log('🔍 Checking triggers on practices table...\n');

    // Query triggers using Supabase client
    const { data: triggers, error: triggerError } = await supabase
      .from('pg_trigger')
      .select(`
        tgname,
        pg_proc (proname)
      `)
      .eq('tgrelid', 'practices');

    if (triggerError) {
      console.log('⚠️  Could not query triggers directly. Trying alternate approach...');

      // Try using raw query through .rpc if available
      const { data: rawData, error: rawError } = await supabase
        .rpc('exec_raw_sql', {
          sql_query: `
            SELECT
                tgname AS trigger_name,
                tgrelid::regclass AS table_name,
                proname AS function_name
            FROM pg_trigger
            JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
            WHERE tgrelid = 'practices'::regclass;
          `
        });

      if (!rawError && rawData) {
        console.log('Triggers on practices table:', JSON.stringify(rawData, null, 2));
      } else {
        console.log('Could not retrieve triggers:', rawError?.message);
      }
    } else {
      console.log('Triggers found:', JSON.stringify(triggers, null, 2));
    }

    console.log('\n📋 Checking RLS policies for practice_settings and practice_features...\n');

    // Query policies
    const { data: policies, error: policiesError } = await supabase
      .rpc('exec_raw_sql', {
        sql_query: `
          SELECT
            schemaname,
            tablename,
            policyname,
            roles::text[],
            cmd,
            qual,
            with_check
          FROM pg_policies
          WHERE tablename IN ('practice_settings', 'practice_features', 'practices')
          ORDER BY tablename, policyname;
        `
      });

    if (policiesError) {
      console.log('❌ Error querying policies:', policiesError.message);
    } else {
      console.log('RLS Policies:');
      console.log(JSON.stringify(policies, null, 2));
    }

    console.log('\n🔍 Checking practice_settings table structure...\n');

    const { data: tableInfo, error: tableError } = await supabase
      .rpc('exec_raw_sql', {
        sql_query: `
          SELECT
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_name = 'practice_settings'
          ORDER BY ordinal_position;
        `
      });

    if (!tableError && tableInfo) {
      console.log('practice_settings columns:', JSON.stringify(tableInfo, null, 2));
    }

    console.log('\n✅ Data retrieval completed!');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error);
  }
}

viewData();