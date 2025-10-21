import pg from 'pg';
const { Client } = pg;

// Database connection string from Supabase
const connectionString = 'postgresql://postgres.jjxlfunlbyayxwvlpgwt:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA@aws-0-us-west-1.pooler.supabase.com:6543/postgres';

async function executeMigration() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🚀 Practice & Branch Columns Migration');
    console.log('==========================================\n');

    await client.connect();
    console.log('✅ Connected to Supabase PostgreSQL directly!\n');

    // Check current practices columns
    console.log('📊 STEP 1: Checking current PRACTICES table columns...\n');
    const practicesCheckQuery = `
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'practices'
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;

    const practicesResult = await client.query(practicesCheckQuery);
    console.log('Current PRACTICES columns:');
    practicesResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}) DEFAULT: ${row.column_default || 'NULL'}`);
    });

    // Check which columns need to be added
    const practicesNeededColumns = [
      'number_of_branches',
      'branch_names',
      'professional_email_count',
      'professional_email_addresses',
      'marketing_budget',
      'website_hosting_enabled',
      'total_monthly_premium',
      'base_price',
      'branches_cost',
      'website_cost',
      'emails_cost',
      'tax_number',
      'registration_number'
    ];

    const existingPracticesColumns = practicesResult.rows.map(r => r.column_name);
    const missingPracticesColumns = practicesNeededColumns.filter(
      col => !existingPracticesColumns.includes(col)
    );

    if (missingPracticesColumns.length > 0) {
      console.log('\n🔧 Adding missing columns to PRACTICES table...');
      console.log('Missing columns:', missingPracticesColumns.join(', '));

      // Execute ALTER TABLE for practices
      const alterPracticesQuery = `
        ALTER TABLE practices
        ADD COLUMN IF NOT EXISTS number_of_branches INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS branch_names TEXT[],
        ADD COLUMN IF NOT EXISTS professional_email_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS professional_email_addresses TEXT[],
        ADD COLUMN IF NOT EXISTS marketing_budget DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS website_hosting_enabled BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS total_monthly_premium DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS base_price DECIMAL(10,2) DEFAULT 1600,
        ADD COLUMN IF NOT EXISTS branches_cost DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS website_cost DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS emails_cost DECIMAL(10,2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS tax_number VARCHAR(100),
        ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);
      `;

      await client.query(alterPracticesQuery);
      console.log('✅ PRACTICES columns added successfully!');
    } else {
      console.log('\n✅ All PRACTICES columns already exist!');
    }

    // Check current branches columns
    console.log('\n📊 STEP 2: Checking current BRANCHES table columns...\n');
    const branchesCheckQuery = `
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'branches'
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;

    const branchesResult = await client.query(branchesCheckQuery);
    console.log('Current BRANCHES columns:');
    branchesResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type}) DEFAULT: ${row.column_default || 'NULL'}`);
    });

    // Check which columns need to be added
    const branchesNeededColumns = ['monthly_cost', 'is_main_branch'];
    const existingBranchesColumns = branchesResult.rows.map(r => r.column_name);
    const missingBranchesColumns = branchesNeededColumns.filter(
      col => !existingBranchesColumns.includes(col)
    );

    if (missingBranchesColumns.length > 0) {
      console.log('\n🔧 Adding missing columns to BRANCHES table...');
      console.log('Missing columns:', missingBranchesColumns.join(', '));

      // Execute ALTER TABLE for branches
      const alterBranchesQuery = `
        ALTER TABLE branches
        ADD COLUMN IF NOT EXISTS monthly_cost DECIMAL(10,2) DEFAULT 1000,
        ADD COLUMN IF NOT EXISTS is_main_branch BOOLEAN DEFAULT false;
      `;

      await client.query(alterBranchesQuery);
      console.log('✅ BRANCHES columns added successfully!');
    } else {
      console.log('\n✅ All BRANCHES columns already exist!');
    }

    // Verify practices columns
    console.log('\n📊 STEP 3: Verifying PRACTICES columns...\n');
    const verifyPracticesQuery = `
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'practices'
      AND table_schema = 'public'
      AND column_name IN (
        'number_of_branches', 'branch_names', 'professional_email_count',
        'professional_email_addresses', 'marketing_budget', 'website_hosting_enabled',
        'total_monthly_premium', 'base_price', 'branches_cost', 'website_cost',
        'emails_cost', 'tax_number', 'registration_number'
      )
      ORDER BY column_name;
    `;

    const verifyPracticesResult = await client.query(verifyPracticesQuery);
    console.log('✅ Verified PRACTICES columns:');
    verifyPracticesResult.rows.forEach(row => {
      console.log(`  ✅ ${row.column_name} (${row.data_type}) DEFAULT: ${row.column_default || 'NULL'}`);
    });

    // Verify branches columns
    console.log('\n📊 STEP 4: Verifying BRANCHES columns...\n');
    const verifyBranchesQuery = `
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'branches'
      AND table_schema = 'public'
      AND column_name IN ('monthly_cost', 'is_main_branch')
      ORDER BY column_name;
    `;

    const verifyBranchesResult = await client.query(verifyBranchesQuery);
    console.log('✅ Verified BRANCHES columns:');
    verifyBranchesResult.rows.forEach(row => {
      console.log(`  ✅ ${row.column_name} (${row.data_type}) DEFAULT: ${row.column_default || 'NULL'}`);
    });

    console.log('\n✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('==========================================');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
    console.log('\n👋 Connection closed');
  }
}

executeMigration();