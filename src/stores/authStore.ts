import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'doctor' | 'nurse' | 'receptionist';
  avatar?: string;
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
    try {
      // Sign in with Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) throw authError;

      if (authData.user) {
        // Get user profile from public.users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (userError) throw userError;

        const user: User = {
          id: userData.id,
          email: userData.email,
          name: userData.full_name,
          role: userData.role,
          avatar: userData.avatar
        };

        set({ isAuthenticated: true, user });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      set({ isAuthenticated: false, user: null });
      return false;
    }
  },
  logout: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ isAuthenticated: false, user: null });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}));