const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('ERROR: No Supabase key found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 STEP 1: Getting current PRACTICES table schema...\n');

  const { data: practicesSchema, error: e1 } = await supabase.rpc('execute_raw_sql', {
    query_text: `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'practices' ORDER BY ordinal_position;`
  });

  if (e1) {
    console.error('Error getting practices schema:', e1);
  } else {
    console.log('Current PRACTICES columns:');
    console.log(JSON.stringify(practicesSchema, null, 2));
  }

  console.log('\n🔍 STEP 2: Getting current BRANCHES table schema...\n');

  const { data: branchesSchema, error: e2 } = await supabase.rpc('execute_raw_sql', {
    query_text: `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' ORDER BY ordinal_position;`
  });

  if (e2) {
    console.error('Error getting branches schema:', e2);
  } else {
    console.log('Current BRANCHES columns:');
    console.log(JSON.stringify(branchesSchema, null, 2));
  }

  console.log('\n⚡ STEP 3: Adding columns to PRACTICES table...\n');

  const alterPracticesSQL = `
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

  const { data: alterPractices, error: e3 } = await supabase.rpc('execute_raw_sql', {
    query_text: alterPracticesSQL
  });

  if (e3) {
    console.error('Error altering practices table:', e3);
  } else {
    console.log('✅ Successfully added columns to PRACTICES table');
    console.log('Result:', JSON.stringify(alterPractices, null, 2));
  }

  console.log('\n⚡ STEP 4: Adding columns to BRANCHES table...\n');

  const alterBranchesSQL = `
    ALTER TABLE branches
    ADD COLUMN IF NOT EXISTS monthly_cost DECIMAL(10,2) DEFAULT 1000,
    ADD COLUMN IF NOT EXISTS is_main_branch BOOLEAN DEFAULT false;
  `;

  const { data: alterBranches, error: e4 } = await supabase.rpc('execute_raw_sql', {
    query_text: alterBranchesSQL
  });

  if (e4) {
    console.error('Error altering branches table:', e4);
  } else {
    console.log('✅ Successfully added columns to BRANCHES table');
    console.log('Result:', JSON.stringify(alterBranches, null, 2));
  }

  console.log('\n🔍 STEP 5: Verifying PRACTICES table schema after changes...\n');

  const { data: newPracticesSchema, error: e5 } = await supabase.rpc('execute_raw_sql', {
    query_text: `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'practices' ORDER BY ordinal_position;`
  });

  if (e5) {
    console.error('Error getting updated practices schema:', e5);
  } else {
    console.log('Updated PRACTICES columns:');
    console.log(JSON.stringify(newPracticesSchema, null, 2));
  }

  console.log('\n🔍 STEP 6: Verifying BRANCHES table schema after changes...\n');

  const { data: newBranchesSchema, error: e6 } = await supabase.rpc('execute_raw_sql', {
    query_text: `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' ORDER BY ordinal_position;`
  });

  if (e6) {
    console.error('Error getting updated branches schema:', e6);
  } else {
    console.log('Updated BRANCHES columns:');
    console.log(JSON.stringify(newBranchesSchema, null, 2));
  }

  console.log('\n✅ MIGRATION COMPLETE!');
}

main().catch(console.error);