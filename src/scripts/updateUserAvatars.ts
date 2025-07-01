import { supabase } from '../lib/supabase';
import { getGenderAppropriateAvatar } from '../utils/avatarUtils';

// Map of known users to their gender based on names
const USER_GENDER_MAP: Record<string, 'male' | 'female'> = {
  'Admin User': 'male',
  'Andreas David': 'male',
  'Doctor User': 'male',
  'Josephine Hengari': 'female',
  'Mike Shoopala': 'male',
  'Reception Staff': 'female',
  'Nurse User': 'female'
};

export async function updateUserAvatarsWithGender() {
  try {
    console.log('Starting to update user avatars...');
    
    // First, fetch all users without avatars
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, email, avatar, gender')
      .is('avatar', null);
    
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }
    
    console.log(`Found ${users?.length || 0} users without avatars`);
    
    if (!users || users.length === 0) {
      console.log('No users need avatar updates');
      return;
    }
    
    // Update each user
    for (const user of users) {
      // Determine gender based on name or existing gender field
      let gender = user.gender;
      
      if (!gender && USER_GENDER_MAP[user.full_name]) {
        gender = USER_GENDER_MAP[user.full_name];
      }
      
      // Get appropriate avatar URL
      const avatarUrl = getGenderAppropriateAvatar(gender, user.email);
      
      console.log(`Updating ${user.full_name} with gender: ${gender || 'unspecified'} and avatar: ${avatarUrl}`);
      
      // Update user record with avatar and gender
      const { error: updateError } = await supabase
        .from('users')
        .update({
          avatar: avatarUrl,
          gender: gender || null
        })
        .eq('id', user.id);
      
      if (updateError) {
        console.error(`Error updating user ${user.full_name}:`, updateError);
      } else {
        console.log(`✅ Successfully updated ${user.full_name}`);
      }
    }
    
    console.log('Avatar update complete!');
  } catch (error) {
    console.error('Error in updateUserAvatarsWithGender:', error);
  }
}

// Run the update if this file is executed directly
if (import.meta.url === new URL(import.meta.url).href) {
  updateUserAvatarsWithGender();
}