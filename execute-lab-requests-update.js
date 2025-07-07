#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQL() {
  try {
    // Read SQL file
    const sqlFile = path.join(__dirname, 'update-lab-requests-simplified.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('🔗 Executing lab_requests table update...');
    console.log('📝 SQL content loaded');
    
    // Execute through exec_raw_sql function
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      sql_query: sqlContent
    });
    
    if (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
    
    console.log('✅ SQL executed successfully!');
    console.log('📊 Result:', data);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

executeSQL();