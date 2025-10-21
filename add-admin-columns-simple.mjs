import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Using the anon key for now since service role key isn't in .env
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addAdminColumns() {
  console.log('🚀 Adding admin/manager columns to practices table...\n');

  // The SQL we need to execute
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

  console.log('📋 SQL to execute:');
  console.log('─'.repeat(80));
  console.log(sql);
  console.log('─'.repeat(80));

  console.log('\n⚠️  This SQL needs to be executed in the Supabase dashboard.\n');
  console.log('Steps:');
  console.log('1. Go to: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql/new');
  console.log('2. Paste the SQL above');
  console.log('3. Click "Run" to execute\n');

  // Let's verify if the columns already exist
  console.log('🔍 Checking if columns already exist...\n');

  try {
    const { data, error } = await supabase
      .from('practices')
      .select('id, admin_name, admin_email, admin_phone, admin_role, admin_job_title, admin_hpcsa_number')
      .limit(1);

    if (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log('❌ Columns do not exist yet - Please execute the SQL above in Supabase dashboard\n');
      } else {
        console.error('❌ Error checking columns:', error);
      }
    } else {
      console.log('✅ Columns already exist!\n');
      console.log('📋 Available admin columns:');
      const adminCols = Object.keys(data[0] || {}).filter(key => key.startsWith('admin_'));
      console.log(adminCols.length > 0 ? adminCols : 'None found in query result');
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
  }
}

addAdminColumns();
