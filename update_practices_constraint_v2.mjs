import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

// Parse the database URL
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Missing database URL');
  console.error('Please set SUPABASE_DB_URL or DATABASE_URL in .env file');
  process.exit(1);
}

async function updatePracticesConstraint() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🚀 Connecting to Supabase database...\n');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Drop the old constraint
    console.log('📋 Step 1: Dropping old constraint...');
    await client.query('ALTER TABLE practices DROP CONSTRAINT IF EXISTS practices_status_check;');
    console.log('✅ Old constraint dropped (if existed)\n');

    // Add new constraint with all statuses
    console.log('📋 Step 2: Adding new constraint with Kanban statuses...');
    const addConstraintSql = `
ALTER TABLE practices ADD CONSTRAINT practices_status_check
CHECK (status IN ('lead', 'contacted', 'qualified', 'onboarding', 'active', 'inactive', 'pending', 'suspended'));
    `.trim();

    await client.query(addConstraintSql);
    console.log('✅ New constraint added successfully!\n');

    // Verify the constraint
    console.log('📋 Step 3: Verifying constraint...');
    const result = await client.query(`
      SELECT
        con.conname AS constraint_name,
        pg_get_constraintdef(con.oid) AS constraint_definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'practices'
        AND con.conname = 'practices_status_check';
    `);

    if (result.rows.length > 0) {
      console.log('✅ Constraint verified successfully!');
      console.log('Constraint definition:', result.rows[0].constraint_definition);
    } else {
      console.log('⚠️ Could not find constraint (might still be working)');
    }

    console.log('\n🎉 SUCCESS: practices table now supports all Kanban statuses:');
    console.log('   • lead (new)');
    console.log('   • contacted (new)');
    console.log('   • qualified (new)');
    console.log('   • onboarding (new)');
    console.log('   • active');
    console.log('   • inactive');
    console.log('   • pending (backward compatibility)');
    console.log('   • suspended (backward compatibility)');

    await client.end();
    console.log('\n✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error updating constraint:', error.message);
    console.error('Full error:', error);
    await client.end();
    process.exit(1);
  }
}

updatePracticesConstraint();