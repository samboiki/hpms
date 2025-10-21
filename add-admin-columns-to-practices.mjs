import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addAdminColumns() {
  console.log('🚀 Adding admin/manager columns to practices table...\n');

  const sql = `
    -- Add admin/manager columns to practices table
    ALTER TABLE practices
    ADD COLUMN IF NOT EXISTS admin_name TEXT,
    ADD COLUMN IF NOT EXISTS admin_email TEXT,
    ADD COLUMN IF NOT EXISTS admin_phone TEXT,
    ADD COLUMN IF NOT EXISTS admin_role TEXT,
    ADD COLUMN IF NOT EXISTS admin_job_title TEXT,
    ADD COLUMN IF NOT EXISTS admin_hpcsa_number TEXT,
    ADD COLUMN IF NOT EXISTS admin_password TEXT;

    -- Add comments to document these fields
    COMMENT ON COLUMN practices.admin_name IS 'Practice administrator/manager full name';
    COMMENT ON COLUMN practices.admin_email IS 'Practice administrator/manager email';
    COMMENT ON COLUMN practices.admin_phone IS 'Practice administrator/manager phone';
    COMMENT ON COLUMN practices.admin_role IS 'Practice administrator role (practice_admin, doctor, nurse, etc.)';
    COMMENT ON COLUMN practices.admin_job_title IS 'Practice administrator job title';
    COMMENT ON COLUMN practices.admin_hpcsa_number IS 'HPCSA number if administrator is a doctor';
    COMMENT ON COLUMN practices.admin_password IS 'Hashed password for admin user';
  `;

  try {
    // Try exec_raw_sql first
    let { data, error } = await supabase.rpc('exec_raw_sql', { query: sql });

    if (error) {
      console.error('❌ Error with exec_raw_sql:', error);

      // Try alternative approach using REST API directly
      console.log('\n🔄 Attempting Supabase Management API...\n');

      const managementApiUrl = `https://api.supabase.com/v1/projects/jjxlfunlbyayxwvlpgwt/database/query`;

      const response = await fetch(managementApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ query: sql })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Management API execution failed:', errorText);
        console.log('\n⚠️  Manual execution required. Please run this SQL in Supabase dashboard:\n');
        console.log(sql);
        process.exit(1);
      }

      const result = await response.json();
      console.log('✅ Columns added successfully via Management API\n');
      console.log('Result:', result);
    } else {
      console.log('✅ Columns added successfully\n');
    }

    // Verify columns were created
    console.log('🔍 Verifying columns...\n');

    // Try querying directly from the table
    const { data: practiceData, error: practiceError } = await supabase
      .from('practices')
      .select('admin_name, admin_email, admin_phone, admin_role, admin_job_title, admin_hpcsa_number, admin_password')
      .limit(1);

    if (practiceError) {
      console.error('❌ Verification failed:', practiceError);
      console.log('\n📝 Note: Columns may have been added but verification query failed.');
      console.log('Please check the Supabase dashboard to confirm.');
    } else {
      console.log('✅ Columns verified successfully\n');
      console.log('📋 Available admin columns:');
      console.log(Object.keys(practiceData[0] || {
        admin_name: null,
        admin_email: null,
        admin_phone: null,
        admin_role: null,
        admin_job_title: null,
        admin_hpcsa_number: null,
        admin_password: null
      }).filter(key => key.startsWith('admin_')));
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

addAdminColumns();
