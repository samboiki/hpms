import pg from 'pg';
const { Client } = pg;

// Database connection configuration
const client = new Client({
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.jjxlfunlbyayxwvlpgwt',
  password: 'T@ngisasa200',
  ssl: {
    rejectUnauthorized: false
  }
});

async function addContactColumns() {
  try {
    console.log('🚀 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database successfully!');

    console.log('🔧 Adding contact columns to departments table...');

    const sql = `
      ALTER TABLE departments
      ADD COLUMN IF NOT EXISTS contact_email TEXT,
      ADD COLUMN IF NOT EXISTS contact_phone TEXT;
    `;

    const result = await client.query(sql);
    console.log('✅ SQL executed successfully!');

    // Verify the columns were added
    console.log('🔍 Verifying columns were added...');
    const verifyQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'departments'
      AND column_name IN ('contact_email', 'contact_phone')
      ORDER BY column_name;
    `;

    const verifyResult = await client.query(verifyQuery);
    console.log('📋 Column verification results:');
    verifyResult.rows.forEach(row => {
      console.log(`  ✅ ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    if (verifyResult.rows.length === 2) {
      console.log('🎉 Both contact_email and contact_phone columns added successfully!');
    } else {
      console.log('⚠️  Expected 2 columns, found:', verifyResult.rows.length);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('✅ Database connection closed.');
  }
}

addContactColumns().then(() => {
  console.log('✅ Migration completed successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});