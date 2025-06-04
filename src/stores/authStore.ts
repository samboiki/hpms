import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'doctor' | 'nurse' | 'receptionist';
  avatar?: string | null;
  practice_id?: string;
  is_super_admin?: boolean;
  can_manage_practices?: boolean;
  permissions?: Record<string, any>;
  last_active_at?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  selectedPracticeId: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  switchPractice: (practiceId: string) => Promise<boolean>;
  getUserPractices: () => Promise<any[]>;
  isSuperAdmin: () => boolean;
  canManagePractices: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  selectedPracticeId: null,
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

      // Fetch the user profile data with admin capabilities
      console.log('🔍 Fetching user profile from users table...');
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, full_name, role, avatar, practice_id, is_super_admin, can_manage_practices, permissions, last_active_at')
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
          .select('id, email, full_name, role, avatar, practice_id, is_super_admin, can_manage_practices, permissions')
          .eq('email', email)
          .single();
          
        if (emailError || !userByEmail) {
          console.error('❌ Fallback also failed:', emailError);
          
          // For Dr. Polina users, use metadata from auth
          if (email.includes('drpolina') && authUser.user_metadata) {
            console.log('🔧 Using auth metadata for Dr. Polina user');
            const user: User = {
              id: authUser.id,
              email: authUser.email || email,
              name: authUser.user_metadata.full_name || 'Admin User',
              role: (authUser.user_metadata.role as any) || 'admin',
              avatar: null,
              practice_id: authUser.user_metadata.practice_id
            };
            set({ isAuthenticated: true, user });
            console.log('✅ Login complete with metadata!');
            return true;
          }
          
          return false;
        }
        
        console.log('⚠️ Found user by email, but IDs do not match!');
        console.log('Auth ID:', authUser.id);
        console.log('User table ID:', userByEmail.id);
      }

      if (!userData) {
        console.error('❌ No user profile found in users table');
        
        // For Dr. Polina users, use metadata from auth
        if (email.includes('drpolina') && authUser.user_metadata) {
          console.log('🔧 Using auth metadata for Dr. Polina user (no user table entry)');
          const user: User = {
            id: authUser.id,
            email: authUser.email || email,
            name: authUser.user_metadata.full_name || 'Admin User',
            role: (authUser.user_metadata.role as any) || 'admin',
            avatar: null,
            practice_id: authUser.user_metadata.practice_id
          };
          set({ isAuthenticated: true, user });
          console.log('✅ Login complete with metadata!');
          return true;
        }
        
        return false;
      }

      const user: User = {
        id: userData.id,
        email: userData.email,
        name: userData.full_name,
        role: userData.role,
        avatar: userData.avatar || null,
        practice_id: userData.practice_id,
        is_super_admin: userData.is_super_admin || false,
        can_manage_practices: userData.can_manage_practices || false,
        permissions: userData.permissions || {},
        last_active_at: userData.last_active_at
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

      // Set selected practice ID to user's practice or null if super admin
      const selectedPracticeId = user.is_super_admin ? null : user.practice_id || null;
      
      set({ 
        isAuthenticated: true, 
        user,
        selectedPracticeId
      });
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
      set({ isAuthenticated: false, user: null, selectedPracticeId: null });
      console.log('👋 Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },
  switchPractice: async (practiceId: string) => {
    try {
      const user = get().user;
      if (!user) return false;

      // Super admins can switch to any practice
      if (user.is_super_admin) {
        set({ selectedPracticeId: practiceId });
        return true;
      }

      // Regular users can only access their assigned practices
      const userPractices = await get().getUserPractices();
      const hasAccess = userPractices.some(p => p.id === practiceId);
      
      if (hasAccess) {
        set({ selectedPracticeId: practiceId });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error switching practice:', error);
      return false;
    }
  },
  getUserPractices: async () => {
    try {
      const user = get().user;
      if (!user) return [];

      // Super admins can see all practices
      if (user.is_super_admin) {
        const { data: practices, error } = await supabase
          .from('practices')
          .select('*')
          .order('name');
        
        if (error) throw error;
        return practices || [];
      }

      // Regular users see practices they're assigned to
      const { data: practices, error } = await supabase
        .from('practices')
        .select('*')
        .eq('id', user.practice_id);
        
      if (error) throw error;
      return practices || [];
    } catch (error) {
      console.error('Error getting user practices:', error);
      return [];
    }
  },
  isSuperAdmin: () => {
    const user = get().user;
    return user?.is_super_admin || false;
  },
  canManagePractices: () => {
    const user = get().user;
    return user?.is_super_admin || user?.can_manage_practices || false;
  }
}));