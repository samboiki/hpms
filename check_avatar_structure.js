import { createClient } from '@supabase/supabase-js';

// Database credentials (using service role key for admin operations)
const SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA';

// Create Supabase client with service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkUsersTableSchema() {
  console.log('🔍 Checking users table schema and avatar column...\n');

  try {
    // Let's just try to select from users table to see what columns exist
    const { data: sampleUser, error: sampleError } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('❌ Error fetching sample user:', sampleError);
      return;
    }

    if (sampleUser && sampleUser.length > 0) {
      console.log('📋 Users table columns found:');
      const columns = Object.keys(sampleUser[0]);
      columns.forEach(col => {
        const isAvatar = col === 'avatar';
        const icon = isAvatar ? '🎯' : '  ';
        console.log(`${icon} ${col}`);
      });

      // Check if avatar column exists specifically
      if (columns.includes('avatar')) {
        console.log('\n✅ Avatar column found in users table!');
        console.log('   Based on the migration files found, avatar is stored as TEXT type');
      } else {
        console.log('\n❌ Avatar column not found in users table');
        return;
      }
    } else {
      console.log('❌ No users found to analyze table structure');
      return;
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

async function checkUsersWithAvatars() {
  console.log('\n🔍 Checking users with avatar data...\n');

  try {
    // Execute the requested query
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, avatar, email, role, job_title')
      .not('practice_id', 'is', null)
      .not('avatar', 'is', null)
      .limit(5);

    if (error) {
      console.error('❌ Error fetching users with avatars:', error);
      return;
    }

    if (!users || users.length === 0) {
      console.log('ℹ️  No users found with both practice_id and avatar data');

      // Let's check if there are any users with avatars at all
      const { data: anyAvatarUsers, error: anyError } = await supabase
        .from('users')
        .select('id, full_name, avatar, email, role, job_title')
        .not('avatar', 'is', null)
        .limit(5);

      if (anyError) {
        console.error('❌ Error fetching any users with avatars:', anyError);
        return;
      }

      if (anyAvatarUsers && anyAvatarUsers.length > 0) {
        console.log('\n📋 Found users with avatars (without practice_id filter):');
        anyAvatarUsers.forEach((user, index) => {
          console.log(`\n${index + 1}. User: ${user.full_name || 'N/A'}`);
          console.log(`   Email: ${user.email}`);
          console.log(`   Role: ${user.role || 'N/A'}`);
          console.log(`   Job Title: ${user.job_title || 'N/A'}`);
          console.log(`   Avatar: ${user.avatar}`);
          console.log(`   Avatar Type: ${analyzeAvatarType(user.avatar)}`);
        });
      } else {
        console.log('❌ No users found with avatar data at all');
      }

      return;
    }

    console.log('📋 Users with practice_id and avatar data:');
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. User: ${user.full_name || 'N/A'}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role || 'N/A'}`);
      console.log(`   Job Title: ${user.job_title || 'N/A'}`);
      console.log(`   Avatar: ${user.avatar}`);
      console.log(`   Avatar Type: ${analyzeAvatarType(user.avatar)}`);
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

function analyzeAvatarType(avatar) {
  if (!avatar) return 'None';

  // Check for different avatar formats
  if (avatar.startsWith('data:')) {
    return 'Base64 Data URI';
  } else if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return 'HTTP URL';
  } else if (avatar.startsWith('/')) {
    return 'Relative Path';
  } else if (avatar.includes('supabase')) {
    return 'Supabase Storage URL';
  } else if (avatar.includes('gravatar')) {
    return 'Gravatar URL';
  } else if (avatar.includes('blob')) {
    return 'Blob URL';
  } else {
    return `Text/Other (${avatar.length} chars)`;
  }
}

async function checkTableCounts() {
  console.log('\n📊 Checking user table statistics...\n');

  try {
    // Total users
    const { count: totalUsers, error: totalError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (!totalError) {
      console.log(`📈 Total users: ${totalUsers}`);
    }

    // Users with practice_id
    const { count: usersWithPractice, error: practiceError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .not('practice_id', 'is', null);

    if (!practiceError) {
      console.log(`🏥 Users with practice_id: ${usersWithPractice}`);
    }

    // Users with avatars
    const { count: usersWithAvatar, error: avatarError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .not('avatar', 'is', null);

    if (!avatarError) {
      console.log(`🎭 Users with avatar: ${usersWithAvatar}`);
    }

    // Users with both practice_id and avatar
    const { count: usersWithBoth, error: bothError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .not('practice_id', 'is', null)
      .not('avatar', 'is', null);

    if (!bothError) {
      console.log(`🎯 Users with both practice_id and avatar: ${usersWithBoth}`);
    }

  } catch (error) {
    console.error('❌ Error getting counts:', error);
  }
}

async function main() {
  console.log('🎭 Avatar Structure Analysis Tool\n');
  console.log(`🔗 Database: ${SUPABASE_URL}\n`);

  await checkUsersTableSchema();
  await checkTableCounts();
  await checkUsersWithAvatars();

  console.log('\n✅ Avatar analysis complete!');
}

main().catch(console.error);