const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase with service role key
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createDrPolinaUsers() {
  console.log('🏥 Creating Dr. Polina users...\n');
  
  try {
    // First, get the Dr. Polina practice
    const { data: practice, error: practiceError } = await supabase
      .from('practices')
      .select('id, name')
      .eq('slug', 'dr-polina-aesthetics')
      .single();

    if (practiceError || !practice) {
      console.error('❌ Error finding Dr. Polina practice:', practiceError);
      return;
    }

    console.log('✅ Found practice:', practice.name, '(ID:', practice.id, ')\n');

    // Users to create
    const users = [
      {
        email: 'admin@drpolina.com',
        password: 'admin123',
        full_name: 'Admin User',
        role: 'admin'
      },
      {
        email: 'doctor@drpolina.com',
        password: 'doctor123',
        full_name: 'Dr. Polina',
        role: 'doctor'
      },
      {
        email: 'reception@drpolina.com',
        password: 'reception123',
        full_name: 'Reception Staff',
        role: 'receptionist'
      }
    ];

    for (const userToCreate of users) {
      console.log(`\n📝 Creating user: ${userToCreate.email}`);
      
      // Step 1: Create auth user using Admin API
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userToCreate.email,
        password: userToCreate.password,
        email_confirm: true,
        user_metadata: {
          full_name: userToCreate.full_name,
          role: userToCreate.role,
          practice_id: practice.id
        }
      });

      if (authError) {
        if (authError.message.includes('already been registered')) {
          console.log('⚠️  User already exists in auth, updating...');
          
          // Get existing user
          const { data: { users: existingUsers } } = await supabase.auth.admin.listUsers({
            filter: `email.eq.${userToCreate.email}`
          });
          
          if (existingUsers && existingUsers.length > 0) {
            const existingUser = existingUsers[0];
            
            // Update password
            const { error: updateError } = await supabase.auth.admin.updateUserById(
              existingUser.id,
              { password: userToCreate.password }
            );
            
            if (updateError) {
              console.error('❌ Error updating password:', updateError);
              continue;
            }
            
            // Use existing user ID for users table
            authData.user = existingUser;
          }
        } else {
          console.error('❌ Error creating auth user:', authError);
          continue;
        }
      }

      if (!authData || !authData.user) {
        console.error('❌ No user data returned');
        continue;
      }

      console.log('✅ Auth user created/found with ID:', authData.user.id);

      // Step 2: Create/update in users table with SAME ID
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: authData.user.id, // CRITICAL: Use same ID as auth
          email: userToCreate.email,
          full_name: userToCreate.full_name,
          role: userToCreate.role,
          practice_id: practice.id,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (userError) {
        console.error('❌ Error creating user profile:', userError);
      } else {
        console.log('✅ User profile created/updated');
        console.log(`   📧 Email: ${userToCreate.email}`);
        console.log(`   🔑 Password: ${userToCreate.password}`);
      }
    }

    // Verify what we created
    console.log('\n\n📊 Verification - Users in database:');
    console.log('=====================================');
    
    const { data: allUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('practice_id', practice.id);

    if (fetchError) {
      console.error('❌ Error fetching users:', fetchError);
    } else {
      allUsers.forEach(user => {
        console.log(`✅ ${user.email} - ${user.full_name} (${user.role})`);
      });
    }

    console.log('\n\n✨ Done! Try logging in with:');
    console.log('================================');
    console.log('1. admin@drpolina.com / admin123');
    console.log('2. doctor@drpolina.com / doctor123');
    console.log('3. reception@drpolina.com / reception123');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run it
createDrPolinaUsers();