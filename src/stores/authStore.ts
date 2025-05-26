import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'doctor' | 'nurse' | 'receptionist';
  avatar?: string | null;
  practice_id?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  login: async (email: string, password: string) => {
    console.log('🔐 Login attempt for:', email);
    
    try {
      // If no password provided, assume we're restoring a session
      if (!password) {
        console.log('📌 Restoring session for:', email);
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email, full_name, role, avatar, practice_id')
          .eq('email', email)
          .single();

        if (userError) {
          console.error('❌ Error fetching user data:', userError);
          return false;
        }

        if (!userData) {
          console.error('❌ No user profile found');
          return false;
        }

        const user: User = {
          id: userData.id,
          email: userData.email,
          name: userData.full_name,
          role: userData.role,
          avatar: userData.avatar || null,
          practice_id: userData.practice_id
        };

        set({ isAuthenticated: true, user });
        console.log('✅ Session restored successfully');
        return true;
      }

      // Otherwise, perform password authentication
      console.log('🔑 Attempting password authentication...');
      const { data: { user: authUser }, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.error('❌ Authentication error:', {
          message: authError.message,
          status: authError.status,
          name: authError.name,
          details: authError
        });
        return false;
      }

      if (!authUser) {
        console.error('❌ Authentication failed - no user returned');
        return false;
      }

      console.log('✅ Auth successful, user ID:', authUser.id);
      console.log('📊 Auth user metadata:', authUser.user_metadata);

      // Fetch the user profile data
      console.log('🔍 Fetching user profile from users table...');
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, full_name, role, avatar, practice_id')
        .eq('id', authUser.id)
        .single();

      if (userError) {
        console.error('❌ Error fetching user profile:', {
          message: userError.message,
          details: userError.details,
          hint: userError.hint,
          code: userError.code
        });
        
        // Try to fetch by email as fallback
        console.log('🔄 Trying to fetch by email as fallback...');
        const { data: userByEmail, error: emailError } = await supabase
          .from('users')
          .select('id, email, full_name, role, avatar, practice_id')
          .eq('email', email)
          .single();
          
        if (emailError || !userByEmail) {
          console.error('❌ Fallback also failed:', emailError);
          return false;
        }
        
        console.log('⚠️ Found user by email, but IDs do not match!');
        console.log('Auth ID:', authUser.id);
        console.log('User table ID:', userByEmail.id);
      }

      if (!userData) {
        console.error('❌ No user profile found in users table');
        return false;
      }

      const user: User = {
        id: userData.id,
        email: userData.email,
        name: userData.full_name,
        role: userData.role,
        avatar: userData.avatar || null,
        practice_id: userData.practice_id
      };

      console.log('✅ User profile loaded:', user);

      // Update last login timestamp
      const { error: updateError } = await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) {
        console.error('⚠️ Error updating last login:', updateError.message);
        // Don't fail the login if this update fails
      }

      set({ isAuthenticated: true, user });
      console.log('✅ Login complete!');
      return true;
    } catch (error) {
      console.error('💥 Unexpected login error:', error);
      return false;
    }
  },
  logout: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ isAuthenticated: false, user: null });
      console.log('👋 Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }
}));