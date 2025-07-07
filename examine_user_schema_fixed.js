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
  console.log('=== COMPLETE USER TABLE ANALYSIS ===\n');

  try {
    // 1. Get complete users table structure
    console.log('1. PUBLIC.USERS TABLE STRUCTURE:');
    console.log('================================');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .limit(5);

    if (!userError && users && users.length > 0) {
      console.log('\nColumns in public.users:');
      const sampleUser = users[0];
      Object.entries(sampleUser).forEach(([key, value]) => {
        const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
        console.log(`- ${key}: ${type} ${value === null ? '' : `(sample: ${JSON.stringify(value).substring(0, 50)}...)`}`);
      });
      
      console.log('\nAll users in database:');
      console.log('---------------------');
      users.forEach(user => {
        console.log(`ID: ${user.id}`);
        console.log(`Email: ${user.email}`);
        console.log(`Role: ${user.role}`);
        console.log(`Practice ID: ${user.practice_id}`);
        console.log(`Full Name: ${user.full_name}`);
        console.log(`Is Super Admin: ${user.is_super_admin}`);
        console.log(`Can Manage Practices: ${user.can_manage_practices}`);
        console.log(`Permissions: ${JSON.stringify(user.permissions)}`);
        console.log('---');
      });
    }

    // 2. Get all users to see complete picture
    console.log('\n2. ALL USERS IN SYSTEM:');
    console.log('=======================');
    const { data: allUsers, error: allError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (!allError && allUsers) {
      console.log(`Total users: ${allUsers.length}`);
      console.log('\nUser breakdown by role:');
      const roleCount = {};
      allUsers.forEach(user => {
        roleCount[user.role] = (roleCount[user.role] || 0) + 1;
      });
      Object.entries(roleCount).forEach(([role, count]) => {
        console.log(`- ${role}: ${count}`);
      });

      console.log('\nSuper admins:');
      allUsers.filter(u => u.is_super_admin).forEach(u => {
        console.log(`- ${u.email} (${u.full_name})`);
      });

      console.log('\nUsers who can manage practices:');
      allUsers.filter(u => u.can_manage_practices).forEach(u => {
        console.log(`- ${u.email} (${u.full_name})`);
      });
    }

    // 3. Check auth.users mapping
    console.log('\n3. AUTH.USERS TO PUBLIC.USERS MAPPING:');
    console.log('======================================');
    const { data: authData } = await supabase.auth.admin.listUsers();
    
    if (authData && authData.users) {
      console.log(`Total auth.users: ${authData.users.length}`);
      
      // Check if all auth users have corresponding public users
      for (const authUser of authData.users.slice(0, 5)) {
        const { data: publicUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();
          
        console.log(`\nAuth user: ${authUser.email} (${authUser.id})`);
        if (publicUser) {
          console.log(`✓ Has public.users record: role=${publicUser.role}, practice_id=${publicUser.practice_id}`);
        } else {
          console.log(`✗ NO public.users record found!`);
        }
      }
    }

    // 4. Check practices table
    console.log('\n4. PRACTICES TABLE:');
    console.log('===================');
    const { data: practices } = await supabase
      .from('practices')
      .select('*');
      
    if (practices) {
      practices.forEach(p => {
        console.log(`- ${p.name} (id: ${p.id}, slug: ${p.slug})`);
      });
    }

    // 5. Summary and recommendations
    console.log('\n5. SUMMARY - HOW TO CREATE ADMIN USERS:');
    console.log('========================================');
    console.log('Based on the analysis, to create an admin user you need to:');
    console.log('\n1. Create an auth.users record using supabase.auth.admin.createUser()');
    console.log('2. Create a corresponding public.users record with:');
    console.log('   - id: same as auth.users.id');
    console.log('   - email: user email');
    console.log('   - full_name: user full name');
    console.log('   - role: "admin"');
    console.log('   - practice_id: UUID of the practice (or null for super admin)');
    console.log('   - is_super_admin: true/false');
    console.log('   - can_manage_practices: true/false');
    console.log('   - permissions: {} or specific permissions object');
    console.log('   - created_at: timestamp');
    console.log('\nThe tables are linked by the id field (auth.users.id = public.users.id)');

  } catch (error) {
    console.error('Error:', error);
  }
}

examineUserSchema();