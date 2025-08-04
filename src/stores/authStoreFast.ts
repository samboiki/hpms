import { create } from 'zustand';
import { supabaseFast, fastAuth } from '../lib/supabaseFast';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'doctor' | 'nurse' | 'receptionist';
  avatar?: string | null;
  signature_url?: string | null;
  practice_id?: string;
  practices?: {
    id: string;
    name: string;
  };
  is_super_admin?: boolean;
  can_manage_practices?: boolean;
  permissions?: Record<string, any>;
  last_active_at?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  selectedPracticeId: string | null;
  sessionCacheTime: number;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  switchPractice: (practiceId: string) => Promise<boolean>;
  getUserPractices: () => Promise<any[]>;
  isSuperAdmin: () => boolean;
  canManagePractices: () => boolean;
  restoreSession: () => Promise<boolean>;
}

// Session cache duration - 10 minutes
const SESSION_CACHE_DURATION = 10 * 60 * 1000;

export const useAuthStoreFast = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  selectedPracticeId: null,
  sessionCacheTime: 0,
  
  restoreSession: async () => {
    const state = get();
    
    // If we have a cached session that's fresh, return immediately
    if (state.isAuthenticated && state.user && 
        Date.now() - state.sessionCacheTime < SESSION_CACHE_DURATION) {
      console.log('⚡ Auth session cache HIT - no network call needed');
      return true;
    }
    
    try {
      // Use fast auth helper
      const { data: { session }, error } = await fastAuth.getSession();
      
      if (error || !session?.user) {
        return false;
      }
      
      // Check if we already have this user data cached
      if (state.user?.id === session.user.id && 
          Date.now() - state.sessionCacheTime < SESSION_CACHE_DURATION) {
        console.log('⚡ User data cache HIT');
        set({ isAuthenticated: true, sessionCacheTime: Date.now() });
        return true;
      }
      
      // Fetch user data only if not cached
      const { data: dbUser } = await supabaseFast
        .from('users')
        .select(`
          id, email, full_name, role, avatar, signature_url,
          practice_id, is_super_admin, can_manage_practices, 
          permissions, last_active_at,
          practices:practice_id (id, name)
        `)
        .eq('id', session.user.id)
        .single();
      
      if (dbUser) {
        const user: User = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.full_name,
          role: dbUser.role,
          avatar: dbUser.avatar,
          signature_url: dbUser.signature_url,
          practice_id: dbUser.practice_id,
          practices: dbUser.practices,
          is_super_admin: dbUser.is_super_admin,
          can_manage_practices: dbUser.can_manage_practices,
          permissions: dbUser.permissions,
          last_active_at: dbUser.last_active_at
        };
        
        set({
          isAuthenticated: true,
          user,
          selectedPracticeId: dbUser.practice_id,
          sessionCacheTime: Date.now()
        });
        
        console.log('✅ Session restored and cached');
        return true;
      }
    } catch (error) {
      console.error('Session restore error:', error);
    }
    
    return false;
  },
  
  login: async (email: string, password: string) => {
    // If no password, it's a session restore
    if (!password) {
      return get().restoreSession();
    }
    
    try {
      const { data, error } = await supabaseFast.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      // Fetch user details
      const { data: dbUser } = await supabaseFast
        .from('users')
        .select(`
          id, email, full_name, role, avatar, signature_url,
          practice_id, is_super_admin, can_manage_practices, 
          permissions, last_active_at,
          practices:practice_id (id, name)
        `)
        .eq('id', data.user.id)
        .single();
      
      if (dbUser) {
        const user: User = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.full_name,
          role: dbUser.role,
          avatar: dbUser.avatar,
          signature_url: dbUser.signature_url,
          practice_id: dbUser.practice_id,
          practices: dbUser.practices,
          is_super_admin: dbUser.is_super_admin,
          can_manage_practices: dbUser.can_manage_practices,
          permissions: dbUser.permissions,
          last_active_at: dbUser.last_active_at
        };
        
        set({
          isAuthenticated: true,
          user,
          selectedPracticeId: dbUser.practice_id,
          sessionCacheTime: Date.now()
        });
        
        return true;
      }
    } catch (error) {
      console.error('Login error:', error);
    }
    
    return false;
  },
  
  logout: async () => {
    await supabaseFast.auth.signOut();
    set({
      isAuthenticated: false,
      user: null,
      selectedPracticeId: null,
      sessionCacheTime: 0
    });
  },
  
  updateUser: (updates: Partial<User>) => {
    const currentUser = get().user;
    if (currentUser) {
      set({
        user: { ...currentUser, ...updates },
        sessionCacheTime: Date.now()
      });
    }
  },
  
  switchPractice: async (practiceId: string) => {
    try {
      const currentUser = get().user;
      if (!currentUser) return false;
      
      const { error } = await supabaseFast
        .from('users')
        .update({ practice_id: practiceId })
        .eq('id', currentUser.id);
      
      if (!error) {
        set({
          selectedPracticeId: practiceId,
          user: { ...currentUser, practice_id: practiceId },
          sessionCacheTime: Date.now()
        });
        return true;
      }
    } catch (error) {
      console.error('Switch practice error:', error);
    }
    return false;
  },
  
  getUserPractices: async () => {
    const user = get().user;
    if (!user) return [];
    
    try {
      const { data } = await supabaseFast
        .from('practice_staff')
        .select('practice:practices(*)')
        .eq('user_id', user.id);
      
      return data?.map(item => item.practice) || [];
    } catch (error) {
      console.error('Get practices error:', error);
      return [];
    }
  },
  
  isSuperAdmin: () => get().user?.is_super_admin || false,
  canManagePractices: () => get().user?.can_manage_practices || false
}));