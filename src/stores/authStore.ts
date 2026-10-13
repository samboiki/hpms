import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { decideSessionKind, identityOfAuthUser, type SessionKind } from '../patientPortal/portalRouting';
import { SIGN_OUT_WAIT_MS, logRecordAccess, settleWithin } from '../services/recordAccessLog';
import { secondStepNeeded } from '../services/mfaService';

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
  /** A staff member is signed in (a patient app login never sets this) */
  isAuthenticated: boolean;
  user: User | null;
  selectedPracticeId: string | null;
  /** Who the restored session belongs to: App.tsx shows the patient app for 'patient' */
  sessionKind: SessionKind | null;
  /** The password was right and the account has two-step sign-in: the sign-in screen asks for the app's code */
  mfaRequired: boolean;
  /** Leaves a half-finished two-step sign-in (back to email and password) */
  cancelSecondStep: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  switchPractice: (practiceId: string) => Promise<boolean>;
  getUserPractices: () => Promise<any[]>;
  isSuperAdmin: () => boolean;
  canManagePractices: () => boolean;
}

// Used only when the staff profile (users row) can't be loaded. user_metadata is editable by the
// user, so it may never grant admin, super-admin or practice-management rights.
const roleFromMetadata = (role: unknown): User['role'] =>
  role === 'doctor' || role === 'nurse' || role === 'receptionist' ? role : 'doctor';

/** Thrown when a staff member whose account was deactivated tries to sign in. */
export class AccountDeactivatedError extends Error {
  constructor() {
    super('This account has been deactivated. Please contact your practice administrator.');
    this.name = 'AccountDeactivatedError';
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  selectedPracticeId: null,
  sessionKind: null,
  mfaRequired: false,
  cancelSecondStep: async () => {
    set({ mfaRequired: false });
    await supabase.auth.signOut({ scope: 'local' });
  },
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

        // First try to get user data from users table
        let dbUser = null;
        try {
          const { data, error } = await supabase
            .from('users')
            .select(`
              id,
              email,
              full_name,
              role,
              avatar,
              signature_url,
              practice_id,
              is_super_admin,
              can_manage_practices,
              permissions,
              last_active_at,
              is_active,
              practices:practice_id (
                id,
                name
              )
            `)
            .eq('id', session.user.id)
            .single();
          
          if (error) {
            console.error('Error fetching user from DB:', error);
          } else {
            dbUser = data;
            console.log('✅ Session user data from DB:', dbUser);
            console.log('📍 Session Practice ID from DB:', dbUser?.practice_id);
          }
        } catch (e) {
          console.log('No user found in database, using auth metadata');
        }

        // A deactivated staff member must not keep using an existing session
        if (dbUser?.is_active === false) {
          console.warn('⛔ Session belongs to a deactivated account; signing out');
          await supabase.auth.signOut();
          set({ isAuthenticated: false, user: null, selectedPracticeId: null, sessionKind: null });
          return false;
        }

        // A patient app login (cell number + SMS code) has no staff profile and must never get a staff user
        // from the fallback below: App.tsx shows it the patient app instead (src/patientPortal/portalRouting.ts)
        const sessionKind = decideSessionKind(identityOfAuthUser(session.user), dbUser ? 'found' : 'not_found');
        if (sessionKind !== 'staff') {
          set({ isAuthenticated: false, user: null, selectedPracticeId: null, sessionKind });
          return false;
        }

        // Two-step sign-in turned on and only the password given so far: the sign-in screen asks for the code
        if (await secondStepNeeded()) {
          set({ isAuthenticated: false, user: null, selectedPracticeId: null, sessionKind: null, mfaRequired: true });
          return false;
        }

        // Use database user data if available, otherwise fallback to auth metadata
        const authUser = session.user;
        const user: User = dbUser ? {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.full_name,
          role: dbUser.role,
          avatar: dbUser.avatar || null,
          signature_url: dbUser.signature_url || null,
          practice_id: dbUser.practice_id,
          practices: dbUser.practices,
          is_super_admin: dbUser.is_super_admin || false,
          can_manage_practices: dbUser.can_manage_practices || false,
          permissions: dbUser.permissions || {},
          last_active_at: dbUser.last_active_at
        } : {
          id: authUser.id,
          email: authUser.email || email,
          name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
          role: roleFromMetadata(authUser.user_metadata?.role),
          avatar: authUser.user_metadata?.avatar || null,
          practice_id: authUser.user_metadata?.practice_id || null,
          is_super_admin: false,
          can_manage_practices: false
        };

        set({ isAuthenticated: true, user, sessionKind: 'staff', mfaRequired: false });
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

      // Two-step sign-in: the password alone does not sign in; the sign-in screen asks for the app's code
      if (await secondStepNeeded()) {
        set({ isAuthenticated: false, user: null, selectedPracticeId: null, sessionKind: null, mfaRequired: true });
        return false;
      }
      console.log('📊 Auth user metadata:', authUser.user_metadata);

      // Try to fetch user profile from users table, but use auth metadata as fallback
      console.log('🔍 Trying to fetch user profile from users table...');
      let userData = null;
      let userError = null;
      
      try {
        const result = await supabase
          .from('users')
          .select(`
            id, 
            email, 
            full_name, 
            role, 
            avatar, 
            signature_url,
            practice_id, 
            is_super_admin, 
            can_manage_practices, 
            permissions,
            last_active_at,
            is_active,
            practices:practice_id (
              id,
              name
            )
          `)
          .eq('id', authUser.id)
          .single();

        userData = result.data;
        userError = result.error;

        // Deactivated staff can't sign in (accounts are deactivated rather than deleted)
        if (userData?.is_active === false) {
          await supabase.auth.signOut();
          throw new AccountDeactivatedError();
        }
        
        if (userData) {
          console.log('✅ User data from DB:', userData);
          console.log('📍 Practice ID from DB:', userData.practice_id);
        }
      } catch (e) {
        if (e instanceof AccountDeactivatedError) throw e;
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
          role: roleFromMetadata(authUser.user_metadata?.role),
          avatar: authUser.user_metadata?.avatar || null,
          practice_id: authUser.user_metadata?.practice_id || null,
          is_super_admin: false,
          can_manage_practices: false,
          permissions: {},
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
          signature_url: userData.signature_url || null,
          practice_id: userData.practice_id,
          practices: userData.practices,
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
        selectedPracticeId,
        sessionKind: 'staff',
        mfaRequired: false
      });
      // The sign-in is recorded for the practice's administrators (parity Q8); signing in never waits for it
      void logRecordAccess('signed_in', { screen: 'sign_in', userId: user.id });
      console.log('✅ Login complete!');
      return true;
    } catch (error) {
      if (error instanceof AccountDeactivatedError) throw error;
      console.error('💥 Unexpected login error:', error);
      return false;
    }
  },
  logout: async () => {
    try {
      console.log('🔐 Starting logout process...');
      // A staff member's sign-out is recorded (parity Q8) while the session still exists
      const { sessionKind, user: signedIn } = get();
      const recorded = sessionKind === 'staff' ? logRecordAccess('signed_out', { screen: 'app', userId: signedIn?.id }) : Promise.resolve();

      // Clear auth state immediately to prevent any race conditions
      set({ isAuthenticated: false, user: null, selectedPracticeId: null, sessionKind: null, mfaRequired: false });

      // Clear any cached data
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();

      // The screen has already changed; the session ends once the entry went, or after a moment at most
      await settleWithin(recorded, SIGN_OUT_WAIT_MS);
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('⚠️ Supabase signOut error:', error);
        // Don't throw here - we've already cleared local state
      }
      
      console.log('✅ Logout completed successfully');
    } catch (error) {
      console.error('❌ Unexpected logout error:', error);
      // Still ensure state is cleared even if there's an error
      set({ isAuthenticated: false, user: null, selectedPracticeId: null, sessionKind: null });
    }
  },
  updateUser: (updates: Partial<User>) => {
    const currentUser = get().user;
    if (currentUser) {
      set({ user: { ...currentUser, ...updates } });
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