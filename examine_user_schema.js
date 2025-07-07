const { createClient } = require('@supabase/supabase-js');

// Database connection details from CLAUDE.md
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  console.error('Please set SUPABASE_SERVICE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function examineUserSchema() {
  console.log('Examining user table structures...\n');

  try {
    // 1. Get public.users table structure
    const { data: userColumns, error: userError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', 'users')
      .order('ordinal_position');

    if (userError) throw userError;

    console.log('1. PUBLIC.USERS TABLE STRUCTURE:');
    console.log('================================');
    if (userColumns && userColumns.length > 0) {
      userColumns.forEach(col => {
        console.log(`- ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
      });
    } else {
      console.log('No public.users table found');
    }

    // 2. Get auth.users table structure
    const { data: authColumns, error: authError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'auth')
      .eq('table_name', 'users')
      .order('ordinal_position');

    if (authError) throw authError;

    console.log('\n2. AUTH.USERS TABLE STRUCTURE:');
    console.log('==============================');
    if (authColumns && authColumns.length > 0) {
      authColumns.forEach(col => {
        console.log(`- ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }

    // 3. Check for foreign key relationships
    const { data: fkData, error: fkError } = await supabase
      .from('information_schema.table_constraints')
      .select('constraint_name, constraint_type')
      .eq('table_schema', 'public')
      .eq('table_name', 'users')
      .eq('constraint_type', 'FOREIGN KEY');

    if (fkError) throw fkError;

    console.log('\n3. FOREIGN KEY RELATIONSHIPS:');
    console.log('=============================');
    if (fkData && fkData.length > 0) {
      for (const fk of fkData) {
        // Get foreign key details
        const { data: fkDetails } = await supabase
          .from('information_schema.key_column_usage')
          .select('column_name')
          .eq('constraint_name', fk.constraint_name)
          .single();

        const { data: refDetails } = await supabase
          .from('information_schema.referential_constraints')
          .select('unique_constraint_name')
          .eq('constraint_name', fk.constraint_name)
          .single();

        console.log(`- ${fk.constraint_name}: ${fkDetails?.column_name || 'unknown'} -> ${refDetails?.unique_constraint_name || 'unknown'}`);
      }
    } else {
      console.log('No foreign key relationships found');
    }

    // 4. Get sample existing users
    const { data: sampleUsers, error: sampleError } = await supabase
      .from('users')
      .select('*')
      .limit(5);

    if (sampleError) throw sampleError;

    console.log('\n4. SAMPLE EXISTING USERS:');
    console.log('=========================');
    if (sampleUsers && sampleUsers.length > 0) {
      sampleUsers.forEach(user => {
        console.log(`- ${user.email}: role=${user.role}, practice_id=${user.practice_id}`);
      });
    } else {
      console.log('No users found in public.users table');
    }

    // 5. Check RLS policies on users table
    const { data: policies, error: policiesError } = await supabase
      .rpc('get_policies_for_table', { table_name: 'users' });

    if (!policiesError && policies) {
      console.log('\n5. RLS POLICIES ON USERS TABLE:');
      console.log('================================');
      policies.forEach(policy => {
        console.log(`- ${policy.policyname}: ${policy.cmd} (${policy.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'})`);
      });
    }

    // 6. Check if users table has indexes
    const { data: indexes, error: indexError } = await supabase
      .from('pg_indexes')
      .select('indexname, indexdef')
      .eq('schemaname', 'public')
      .eq('tablename', 'users');

    if (!indexError && indexes) {
      console.log('\n6. INDEXES ON USERS TABLE:');
      console.log('==========================');
      indexes.forEach(index => {
        console.log(`- ${index.indexname}`);
      });
    }

  } catch (error) {
    console.error('Error examining schema:', error);
  }
}

examineUserSchema();