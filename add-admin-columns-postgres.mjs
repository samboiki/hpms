import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL or SUPABASE_DB_URL environment variable');
  process.exit(1);
}

async function addAdminColumns() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🚀 Connecting to database...\n');
    await client.connect();
    console.log('✅ Connected successfully\n');

    console.log('📝 Adding admin/manager columns to practices table...\n');

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
    `;

    await client.query(sql);
    console.log('✅ Columns added successfully\n');

    console.log('📝 Adding column comments...\n');

    const commentSQL = `
      COMMENT ON COLUMN practices.admin_name IS 'Practice administrator/manager full name';
      COMMENT ON COLUMN practices.admin_email IS 'Practice administrator/manager email';
      COMMENT ON COLUMN practices.admin_phone IS 'Practice administrator/manager phone';
      COMMENT ON COLUMN practices.admin_role IS 'Practice administrator role (practice_admin, doctor, nurse, etc.)';
      COMMENT ON COLUMN practices.admin_job_title IS 'Practice administrator job title';
      COMMENT ON COLUMN practices.admin_hpcsa_number IS 'HPCSA number if administrator is a doctor';
      COMMENT ON COLUMN practices.admin_password IS 'Hashed password for admin user';
    `;

    await client.query(commentSQL);
    console.log('✅ Comments added successfully\n');

    console.log('🔍 Verifying columns...\n');

    const verifySQL = `
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'practices'
        AND column_name LIKE 'admin%'
      ORDER BY column_name;
    `;

    const result = await client.query(verifySQL);

    console.log('✅ Verification complete\n');
    console.log('📋 Admin columns in practices table:\n');
    console.table(result.rows);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

addAdminColumns();
