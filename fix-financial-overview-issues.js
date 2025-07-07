import pg from 'pg';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Direct PostgreSQL connection (bolt.new style)
const connectionString = 'postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres';

async function fixFinancialOverviewIssues() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');

    // Check users table structure
    console.log('\n📊 Checking users table structure...');
    const userColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.log('Users table columns:', userColumns.rows);

    // Create users_with_names view
    console.log('\n🔨 Creating users_with_names view...');
    await client.query(`
      CREATE OR REPLACE VIEW users_with_names AS
      SELECT 
        id,
        email,
        full_name,
        -- Split full_name into first and last names
        SPLIT_PART(full_name, ' ', 1) as first_name,
        CASE 
          WHEN ARRAY_LENGTH(STRING_TO_ARRAY(full_name, ' '), 1) > 1 
          THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
          ELSE ''
        END as last_name,
        role,
        created_at,
        last_login,
        practice_id
      FROM users
    `);
    console.log('✅ Created users_with_names view');

    // Grant permissions
    await client.query('GRANT SELECT ON users_with_names TO authenticated');
    console.log('✅ Granted permissions on users_with_names');

    // Check practice structure
    console.log('\n📊 Checking practices table for practice_number column...');
    const practiceColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'practices'
      AND column_name = 'practice_number'
    `);
    
    if (practiceColumns.rows.length === 0) {
      console.log('⚠️  practice_number column missing, adding it...');
      
      // Add practice_number column
      await client.query('ALTER TABLE practices ADD COLUMN practice_number VARCHAR(50)');
      
      // Set default practice numbers
      await client.query(`
        UPDATE practices 
        SET practice_number = 'PRAC' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 4, '0')
        WHERE practice_number IS NULL
      `);
      
      // Make it not null and unique
      await client.query('ALTER TABLE practices ALTER COLUMN practice_number SET NOT NULL');
      await client.query('ALTER TABLE practices ADD CONSTRAINT practices_practice_number_unique UNIQUE (practice_number)');
      
      console.log('✅ Added practice_number column to practices table');
    } else {
      console.log('✅ practice_number column already exists');
    }

    // Check current batch data
    console.log('\n📊 Checking current batch data...');
    const batchSummary = await client.query(`
      SELECT 
        bh.practice_number,
        bh.practice_id,
        p.name as practice_name,
        COUNT(*) as batch_count,
        SUM(bh.total_amount) as total_amount
      FROM batch_headers bh
      LEFT JOIN practices p ON p.id = bh.practice_id
      GROUP BY bh.practice_number, bh.practice_id, p.name
    `);
    console.log('Batch summary by practice:', batchSummary.rows);

    // Check batch statuses
    const batchStatuses = await client.query(`
      SELECT status, COUNT(*) as count
      FROM batch_headers 
      GROUP BY status
    `);
    console.log('\nBatch status distribution:', batchStatuses.rows);

    // Create function to get practice batches
    console.log('\n🔨 Creating get_practice_batches function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION get_practice_batches(
        p_practice_id UUID DEFAULT NULL,
        p_practice_number VARCHAR DEFAULT NULL
      )
      RETURNS TABLE (
        batch_id UUID,
        practice_number VARCHAR,
        batch_number VARCHAR,
        batch_date DATE,
        medical_aid_reference VARCHAR,
        status VARCHAR,
        total_invoices INTEGER,
        total_amount NUMERIC,
        created_at TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        confirmed_at TIMESTAMPTZ,
        medical_aid_name VARCHAR,
        medical_aid_short_name VARCHAR,
        medical_aid_email VARCHAR,
        medical_aid_logo_url VARCHAR,
        medical_aid_theme_color VARCHAR,
        practice_name VARCHAR,
        practice_email VARCHAR,
        detail_transactions BIGINT,
        total_detail_transactions INTEGER,
        total_amount_detail_transactions NUMERIC,
        dat_filename TEXT
      )
      AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          bmv.batch_id,
          bmv.practice_number,
          bmv.batch_number,
          bmv.batch_date,
          bmv.medical_aid_reference,
          bmv.status,
          bmv.total_invoices,
          bmv.total_amount,
          bmv.created_at,
          bmv.sent_at,
          bmv.confirmed_at,
          bmv.medical_aid_name,
          bmv.medical_aid_short_name,
          bmv.medical_aid_email,
          map.logo_url as medical_aid_logo_url,
          map.theme_color as medical_aid_theme_color,
          bmv.practice_name,
          bmv.practice_email,
          bmv.detail_transactions,
          bmv.total_detail_transactions,
          bmv.total_amount_detail_transactions,
          bmv.dat_filename
        FROM batch_management_view bmv
        LEFT JOIN medical_aid_providers map ON map.medical_aid_reference = bmv.medical_aid_reference
        LEFT JOIN practices p ON p.practice_number = bmv.practice_number
        WHERE 
          (p_practice_id IS NULL OR p.id = p_practice_id)
          AND (p_practice_number IS NULL OR bmv.practice_number = p_practice_number);
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Created get_practice_batches function');

    // Grant execute permission
    await client.query('GRANT EXECUTE ON FUNCTION get_practice_batches TO authenticated');
    console.log('✅ Granted execute permission on get_practice_batches');

    // Create test data if needed
    console.log('\n📊 Checking if test data is needed...');
    const batchCount = await client.query('SELECT COUNT(*) as count FROM batch_headers');
    
    if (batchCount.rows[0].count === '0') {
      console.log('⚠️  No batches found, creating test data...');
      
      // Get first practice
      const practice = await client.query('SELECT id, practice_number FROM practices LIMIT 1');
      
      if (practice.rows.length > 0) {
        const practiceId = practice.rows[0].id;
        const practiceNumber = practice.rows[0].practice_number;
        
        // Create test batch
        await client.query(`
          INSERT INTO batch_headers (
            practice_id,
            practice_number,
            batch_number,
            batch_date,
            medical_aid_reference,
            status,
            total_invoices,
            total_amount
          ) VALUES (
            $1, $2, '001', CURRENT_DATE, 'NHPM', 'active', 5, 12500.00
          )
        `, [practiceId, practiceNumber]);
        
        console.log(`✅ Created test batch for practice ${practiceNumber}`);
      }
    } else {
      console.log(`✅ Found ${batchCount.rows[0].count} existing batches`);
    }

    // Final summary
    console.log('\n📊 Final batch summary:');
    const finalSummary = await client.query(`
      SELECT 
        'Total Batches' as metric,
        COUNT(*)::TEXT as value
      FROM batch_headers
      UNION ALL
      SELECT 
        'Active Batches',
        COUNT(*)::TEXT
      FROM batch_headers
      WHERE status = 'active'
      UNION ALL
      SELECT 
        'Total Amount in Active Batches',
        'N$' || COALESCE(SUM(total_amount), 0)::TEXT
      FROM batch_headers
      WHERE status = 'active'
    `);
    console.table(finalSummary.rows);

    // Test the batch management view
    console.log('\n📊 Testing batch_management_view...');
    const viewTest = await client.query(`
      SELECT 
        practice_number,
        practice_name,
        status,
        COUNT(*) as batch_count,
        SUM(total_amount) as total_amount
      FROM batch_management_view
      GROUP BY practice_number, practice_name, status
      LIMIT 10
    `);
    console.log('Batch management view results:');
    console.table(viewTest.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) console.error('Details:', error.detail);
    throw error;
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run the fix
console.log('🚀 Starting Financial Overview fixes...\n');
fixFinancialOverviewIssues()
  .then(() => {
    console.log('\n✨ All fixes applied successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Update any queries that use users.first_name to use users_with_names view instead');
    console.log('2. Update EnhancedFinancialModal to use get_practice_batches function or fix the practice_number filtering');
    console.log('3. Test the Financial Overview to ensure batches are now visible');
  })
  .catch((error) => {
    console.error('\n❌ Failed to apply fixes:', error);
    process.exit(1);
  });