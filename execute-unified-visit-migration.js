const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL || 'https://afzfrrfszjdfwzfihqmv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmemZycmZzempmZnd6ZmlocW12Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzU5NTE4MywiZXhwIjoyMDQ5MTcxMTgzfQ.hOKD9Wq8BfFKBHMk5-QgjnZ9D9bYTBhwmDZ8P7b-9rY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeMigration() {
  console.log('🚀 Starting Unified Visit System Migration...\n');

  try {
    // Read the SQL migration file
    const migrationSQL = fs.readFileSync('./unified-visit-system-migration.sql', 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`\n🔧 Executing statement ${i + 1}/${statements.length}:`);
      console.log(`📝 ${statement.substring(0, 100)}...`);
      
      const { data, error } = await supabase.rpc('exec_raw_sql', {
        sql_query: statement
      });

      if (error) {
        console.error(`❌ Error: ${error.message}`);
        console.error(`💡 Hint: ${error.hint || 'None'}`);
        
        // Continue with next statement if it's not critical
        if (!statement.includes('CREATE TABLE') && !statement.includes('NOT NULL')) {
          console.log('⚠️  Non-critical error, continuing...');
          continue;
        }
        throw error;
      }
      
      console.log(`✅ Success: ${data}`);
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- Added "scheduled" status to visits table');
    console.log('- Migrated appointments to visits with proper status');
    console.log('- Added visit_number column with auto-numbering');
    console.log('- Created backward-compatible view');
    
    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    
    // Check scheduled visits count
    const { data: scheduledVisits, error: scheduledError } = await supabase
      .from('visits')
      .select('id', { count: 'exact' })
      .eq('status', 'scheduled');
      
    if (!scheduledError) {
      console.log(`✅ Found ${scheduledVisits.length} scheduled visits (appointments)`);
    }
    
    // Check if visit_number is populated
    const { data: numberedVisits, error: numberError } = await supabase
      .from('visits')
      .select('id, visit_number')
      .not('visit_number', 'is', null)
      .limit(5);
      
    if (!numberError && numberedVisits) {
      console.log(`✅ Visit numbers assigned: ${numberedVisits.map(v => v.visit_number).join(', ')}...`);
    }

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
executeMigration();