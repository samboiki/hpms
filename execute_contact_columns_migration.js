#!/usr/bin/env node

// Direct Supabase SQL execution for adding contact columns to departments table
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// You need to get the service role key from the Supabase dashboard
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addContactColumnsToDepartments() {
  console.log('🚀 Adding contact_email and contact_phone columns to departments table...');

  try {
    // SQL to add the contact columns
    const sql = `
      ALTER TABLE departments
      ADD COLUMN IF NOT EXISTS contact_email TEXT,
      ADD COLUMN IF NOT EXISTS contact_phone TEXT;
    `;

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Error executing SQL:', error);
      console.error('Error details:', error.message);

      // Try alternative approach using direct SQL execution
      console.log('🔄 Trying alternative approach...');

      const { data: altData, error: altError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'departments')
        .eq('table_schema', 'public');

      if (!altError) {
        console.log('📊 Current departments table columns:', altData.map(col => col.column_name));
      }

      return;
    }

    console.log('✅ Successfully added contact columns to departments table');
    console.log('📄 SQL executed:', sql);

    // Verify the columns were added
    const { data: verifyData, error: verifyError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'departments')
      .eq('table_schema', 'public')
      .in('column_name', ['contact_email', 'contact_phone']);

    if (!verifyError && verifyData) {
      console.log('✅ Verification - New columns found:', verifyData);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the function
addContactColumnsToDepartments().then(() => {
  console.log('🏁 Migration script completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});