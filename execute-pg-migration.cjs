const { Client } = require('pg');
const fs = require('fs');

// Supabase connection details
const connectionString = process.env.DATABASE_URL ||
  `postgresql://postgres.jjxlfunlbyayxwvlpgwt:${process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;

async function executeMigration() {
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connecting to Supabase PostgreSQL...\n');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    console.log('📖 Reading migration file...\n');
    const migrationSQL = fs.readFileSync('supabase/migrations/20250930_add_practice_branch_columns.sql', 'utf8');

    // Split into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`\n⚡ Executing statement ${i + 1}/${statements.length}...`);
      console.log(`Preview: ${stmt.substring(0, 80)}...`);

      try {
        const result = await client.query(stmt);
        console.log(`✅ Statement ${i + 1} executed successfully`);
        if (result.rowCount !== null) {
          console.log(`   Rows affected: ${result.rowCount}`);
        }
      } catch (err) {
        console.error(`❌ Error executing statement ${i + 1}:`, err.message);
      }
    }

    console.log('\n\n✅ Migration execution complete!');
    console.log('\n🔍 Verifying the schema changes...\n');

    // Verify practices table columns
    const practicesCheck = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'practices'
        AND column_name IN (
          'number_of_branches', 'branch_names', 'professional_email_count',
          'professional_email_addresses', 'marketing_budget', 'website_hosting_enabled',
          'total_monthly_premium', 'base_price', 'branches_cost', 'website_cost',
          'emails_cost', 'tax_number', 'registration_number'
        )
      ORDER BY column_name;
    `);

    console.log('\n✅ PRACTICES table - New columns:');
    console.table(practicesCheck.rows);

    // Verify branches table columns
    const branchesCheck = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'branches'
        AND column_name IN ('monthly_cost', 'is_main_branch')
      ORDER BY column_name;
    `);

    console.log('\n✅ BRANCHES table - New columns:');
    console.table(branchesCheck.rows);

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error(err.stack);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

executeMigration().catch(console.error);