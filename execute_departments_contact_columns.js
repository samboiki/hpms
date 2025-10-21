import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMjAzMTQzOCwiZXhwIjoyMDQ3NjA3NDM4fQ.oUhBLKOKoNnmYCgxpAJK6FIAOuADgtSGVHzTlnGNpLs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQL() {
  console.log('🚀 Executing SQL to add contact columns to departments table...');

  const sql = `
    ALTER TABLE departments
    ADD COLUMN IF NOT EXISTS contact_email TEXT,
    ADD COLUMN IF NOT EXISTS contact_phone TEXT;
  `;

  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: sql
    });

    if (error) {
      console.error('❌ Error executing SQL:', error);
      // Try direct SQL execution
      console.log('🔄 Trying direct SQL execution...');
      const { data: directData, error: directError } = await supabase
        .from('departments')
        .select('*')
        .limit(1);

      if (directError) {
        console.error('❌ Direct query also failed:', directError);
        process.exit(1);
      }

      console.log('✅ Direct query successful, proceeding with raw SQL...');

      // Execute the ALTER TABLE command via raw SQL
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql_query: sql })
      });

      if (!response.ok) {
        console.error('❌ Raw SQL execution failed:', await response.text());
        process.exit(1);
      }

      console.log('✅ Raw SQL execution successful!');
    } else {
      console.log('✅ SQL executed successfully!', data);
    }

    // Verify the columns were added
    console.log('🔍 Verifying columns were added...');
    const { data: schemaData, error: schemaError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'departments')
      .in('column_name', ['contact_email', 'contact_phone']);

    if (schemaError) {
      console.error('❌ Error checking schema:', schemaError);
    } else {
      console.log('✅ Schema verification:', schemaData);
      if (schemaData && schemaData.length === 2) {
        console.log('🎉 Both contact_email and contact_phone columns added successfully!');
      } else {
        console.log('⚠️  Some columns may not have been added. Current columns:', schemaData);
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

executeSQL().then(() => {
  console.log('✅ Department contact columns migration completed!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Failed to execute migration:', error);
  process.exit(1);
});