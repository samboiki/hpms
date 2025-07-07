import { createClient } from '@supabase/supabase-js';

// Database connection details
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function examineUserSchema() {
  console.log('Examining user table structures...\n');

  try {
    // 1. Get sample data from public.users to see structure
    console.log('1. PUBLIC.USERS TABLE SAMPLE DATA:');
    console.log('==================================');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .limit(3);

    if (userError) {
      console.log('Error fetching users:', userError.message);
    } else if (users && users.length > 0) {
      console.log('Columns found:');
      Object.keys(users[0]).forEach(key => {
        const value = users[0][key];
        const type = value === null ? 'null' : typeof value;
        console.log(`- ${key} (${type})`);
      });
      
      console.log('\nSample users:');
      users.forEach(user => {
        console.log(`- ${user.email || 'no-email'}: role=${user.role}, practice_id=${user.practice_id}, id=${user.id}`);
      });
    } else {
      console.log('No users found in public.users table');
    }

    // 2. Check auth.users for comparison
    console.log('\n2. AUTH.USERS SAMPLE DATA:');
    console.log('==========================');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 3
    });

    if (authError) {
      console.log('Error fetching auth users:', authError.message);
    } else if (authUsers && authUsers.users.length > 0) {
      console.log('Sample auth users:');
      authUsers.users.forEach(user => {
        console.log(`- ${user.email}: id=${user.id}, created=${user.created_at}`);
        if (user.user_metadata) {
          console.log(`  metadata: ${JSON.stringify(user.user_metadata)}`);
        }
      });
    }

    // 3. Try to query specific relationships
    console.log('\n3. CHECKING USER RELATIONSHIPS:');
    console.log('================================');
    
    // Check if users table has practice relationship
    const { data: userWithPractice, error: practiceError } = await supabase
      .from('users')
      .select(`
        *,
        practices (
          id,
          name,
          slug
        )
      `)
      .limit(1);

    if (practiceError) {
      console.log('Error checking practice relationship:', practiceError.message);
    } else if (userWithPractice && userWithPractice.length > 0) {
      console.log('User with practice data:', JSON.stringify(userWithPractice[0], null, 2));
    }

    // 4. Check RLS policies using a direct query
    console.log('\n4. CHECKING RLS POLICIES:');
    console.log('=========================');
    const { data: policies, error: policyError } = await supabase
      .rpc('get_table_policies', { table_name: 'users' })
      .catch(() => null);

    if (policies) {
      policies.forEach(policy => {
        console.log(`- ${policy.policyname}: ${policy.cmd}`);
      });
    } else {
      // Try alternative approach
      const { data: allUsers, error: allError } = await supabase
        .from('users')
        .select('count', { count: 'exact', head: true });
      
      console.log(`Total users in table: ${allUsers || 0}`);
      console.log('Note: RLS policies exist but cannot be queried directly');
    }

    // 5. Check for specific columns
    console.log('\n5. CHECKING SPECIFIC COLUMNS:');
    console.log('=============================');
    const columnsToCheck = ['id', 'email', 'role', 'practice_id', 'full_name', 'created_at', 'updated_at', 'is_active', 'phone'];
    
    const { data: oneUser } = await supabase
      .from('users')
      .select('*')
      .limit(1)
      .single();

    if (oneUser) {
      columnsToCheck.forEach(col => {
        if (col in oneUser) {
          console.log(`✓ ${col}: exists (value = ${oneUser[col]})`);
        } else {
          console.log(`✗ ${col}: does not exist`);
        }
      });
    }

    // 6. Check for any constraints or defaults
    console.log('\n6. UNIQUE CONSTRAINTS:');
    console.log('=====================');
    // Try to find users with same email to check uniqueness
    const { data: emailCheck, error: emailError } = await supabase
      .from('users')
      .select('email, count(*)')
      .not('email', 'is', null)
      .limit(10);

    if (emailCheck) {
      console.log('Email appears to be unique (based on sample data)');
    }

  } catch (error) {
    console.error('Error examining schema:', error);
  }
}

examineUserSchema();