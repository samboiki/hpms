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
      // First check if the user exists in public.users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (userError) {
        console.error('Error checking user:', userError.message);
        return false;
      }

      if (!userData) {
        console.error('User not found');
        return false;
      }

      // Sign in with Supabase auth
      const { data: { user: authUser }, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.error('Auth error:', authError.message);
        return false;
      }

      if (!authUser) {
        console.error('Authentication failed');
        return false;
      }

      const user: User = {
        id: userData.id,
        email: userData.email,
        name: userData.full_name,
        role: userData.role,
        avatar: userData.avatar
      };

      // Update last login timestamp
      const { error: updateError } = await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating last login:', updateError.message);
      }

      set({ isAuthenticated: true, user });
      return true;
    } catch (error) {
      console.error('Login error:', error);
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
      throw error;
    }
  }
}));