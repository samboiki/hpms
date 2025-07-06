import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role key
const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createNewCharmDoctor() {
  console.log('🦷 Creating New Charm Dental Practice doctor user...\n');
  
  try {
    // Practice details
    const practiceId = 'ffed1160-00ec-4c4f-8810-913a24348d90';
    const practiceName = 'New Charm Dental Practice';
    
    // User details
    const userToCreate = {
      email: 'admin@newcharmdentalpractice.com',
      password: 'newcharm123',
      full_name: 'Dr. Hilma Amalwa',
      role: 'doctor'
    };

    console.log(`📝 Creating doctor user for ${practiceName}`);
    console.log(`   Practice ID: ${practiceId}`);
    console.log(`   Email: ${userToCreate.email}`);
    console.log(`   Name: ${userToCreate.full_name}\n`);
    
    // Step 1: Create auth user using Admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userToCreate.email,
      password: userToCreate.password,
      email_confirm: true,
      user_metadata: {
        full_name: userToCreate.full_name,
        role: userToCreate.role,
        practice_id: practiceId
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
            { 
              password: userToCreate.password,
              user_metadata: {
                full_name: userToCreate.full_name,
                role: userToCreate.role,
                practice_id: practiceId
              }
            }
          );
          
          if (updateError) {
            console.error('❌ Error updating user:', updateError);
            return;
          }
          
          console.log('✅ Auth user updated with new password');
          authData.user = existingUser;
        }
      } else {
        console.error('❌ Error creating auth user:', authError);
        return;
      }
    } else {
      console.log('✅ Auth user created successfully');
    }

    if (!authData || !authData.user) {
      console.error('❌ No user data returned');
      return;
    }

    console.log('   User ID:', authData.user.id);

    // Step 2: Create/update in users table with SAME ID
    const { error: userError } = await supabase
      .from('users')
      .upsert({
        id: authData.user.id, // CRITICAL: Use same ID as auth
        email: userToCreate.email,
        full_name: userToCreate.full_name,
        role: userToCreate.role,
        practice_id: practiceId,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (userError) {
      console.error('❌ Error creating user profile:', userError);
      return;
    }
    
    console.log('✅ User profile created/updated in users table');

    // Step 3: Verify the user was created
    const { data: createdUser, error: verifyError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (verifyError || !createdUser) {
      console.error('❌ Error verifying user creation:', verifyError);
      return;
    }

    console.log('\n✨ Doctor user created successfully!');
    console.log('=====================================');
    console.log('📧 Email:', createdUser.email);
    console.log('👨‍⚕️ Name:', createdUser.full_name);
    console.log('🏥 Role:', createdUser.role);
    console.log('🦷 Practice ID:', createdUser.practice_id);
    console.log('🔑 Password:', userToCreate.password);
    console.log('\n✅ Dr. Hilma Amalwa can now log in at:');
    console.log('   https://www.newcharmdentalpractice.com');
    console.log('   or the main portal with practice selection');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run it
createNewCharmDoctor();