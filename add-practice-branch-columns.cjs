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

  const { data: practicesSchema, error: e1 } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable, column_default')
    .eq('table_schema', 'public')
    .eq('table_name', 'practices')
    .order('ordinal_position');

  if (e1) {
    console.error('Error getting practices schema:', e1);
  } else {
    console.log('Current PRACTICES columns:');
    console.table(practicesSchema);
  }

  console.log('\n🔍 STEP 2: Getting current BRANCHES table schema...\n');

  const { data: branchesSchema, error: e2 } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable, column_default')
    .eq('table_schema', 'public')
    .eq('table_name', 'branches')
    .order('ordinal_position');

  if (e2) {
    console.error('Error getting branches schema:', e2);
  } else {
    console.log('Current BRANCHES columns:');
    console.table(branchesSchema);
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

  const { data: alterPractices, error: e3 } = await supabase.rpc('exec_sql', {
    sql: alterPracticesSQL
  });

  if (e3) {
    console.error('Error altering practices table:', e3);
    console.log('Trying alternative method with pg-sql-query...');

    // Try using raw SQL execution
    const { error: e3b } = await supabase.rpc('execute_sql', {
      query: alterPracticesSQL
    });

    if (e3b) {
      console.error('Alternative method also failed:', e3b);
    } else {
      console.log('✅ Successfully added columns to PRACTICES table using alternative method');
    }
  } else {
    console.log('✅ Successfully added columns to PRACTICES table');
    console.log('Result:', alterPractices);
  }

  console.log('\n⚡ STEP 4: Adding columns to BRANCHES table...\n');

  const alterBranchesSQL = `
    ALTER TABLE branches
    ADD COLUMN IF NOT EXISTS monthly_cost DECIMAL(10,2) DEFAULT 1000,
    ADD COLUMN IF NOT EXISTS is_main_branch BOOLEAN DEFAULT false;
  `;

  const { data: alterBranches, error: e4 } = await supabase.rpc('exec_sql', {
    sql: alterBranchesSQL
  });

  if (e4) {
    console.error('Error altering branches table:', e4);
    console.log('Trying alternative method...');

    const { error: e4b } = await supabase.rpc('execute_sql', {
      query: alterBranchesSQL
    });

    if (e4b) {
      console.error('Alternative method also failed:', e4b);
    } else {
      console.log('✅ Successfully added columns to BRANCHES table using alternative method');
    }
  } else {
    console.log('✅ Successfully added columns to BRANCHES table');
    console.log('Result:', alterBranches);
  }

  console.log('\n🔍 STEP 5: Verifying PRACTICES table schema after changes...\n');

  const { data: newPracticesSchema, error: e5 } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable, column_default')
    .eq('table_schema', 'public')
    .eq('table_name', 'practices')
    .order('ordinal_position');

  if (e5) {
    console.error('Error getting updated practices schema:', e5);
  } else {
    console.log('Updated PRACTICES columns:');
    console.table(newPracticesSchema);
  }

  console.log('\n🔍 STEP 6: Verifying BRANCHES table schema after changes...\n');

  const { data: newBranchesSchema, error: e6 } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable, column_default')
    .eq('table_schema', 'public')
    .eq('table_name', 'branches')
    .order('ordinal_position');

  if (e6) {
    console.error('Error getting updated branches schema:', e6);
  } else {
    console.log('Updated BRANCHES columns:');
    console.table(newBranchesSchema);
  }

  console.log('\n✅ MIGRATION COMPLETE!');
}

main().catch(console.error);