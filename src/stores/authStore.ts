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
        
        // Get current auth session first
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.user) {
          console.error('❌ No valid session found');
          return false;
        }

        // Use auth user data as fallback
        const authUser = session.user;
        const user: User = {
          id: authUser.id,
          email: authUser.email || email,
          name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
          role: (authUser.user_metadata?.role as any) || 'admin',
          avatar: authUser.user_metadata?.avatar || null,
          practice_id: authUser.user_metadata?.practice_id || null,
          is_super_admin: authUser.user_metadata?.is_super_admin || false,
          can_manage_practices: authUser.user_metadata?.can_manage_practices || false
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

      // Try to fetch user profile from users table, but use auth metadata as fallback
      console.log('🔍 Trying to fetch user profile from users table...');
      let userData = null;
      let userError = null;
      
      try {
        const result = await supabase
          .from('users')
          .select('id, email, full_name, role, avatar, practice_id, is_super_admin, can_manage_practices, permissions, last_active_at')
          .eq('id', authUser.id)
          .single();
          
        userData = result.data;
        userError = result.error;
      } catch (e) {
        console.log('⚠️ Users table query failed, using auth metadata');
        userError = e;
      }

      let user: User;

      if (userError || !userData) {
        console.log('🔧 Using auth metadata as primary user source');
        // Use auth metadata as the primary source
        user = {
          id: authUser.id,
          email: authUser.email || email,
          name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
          role: (authUser.user_metadata?.role as any) || 'admin',
          avatar: authUser.user_metadata?.avatar || null,
          practice_id: authUser.user_metadata?.practice_id || null,
          is_super_admin: authUser.user_metadata?.is_super_admin || false,
          can_manage_practices: authUser.user_metadata?.can_manage_practices || false,
          permissions: authUser.user_metadata?.permissions || {},
          last_active_at: authUser.last_sign_in_at
        };
      } else {
        console.log('✅ User profile loaded from users table');
        user = {
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