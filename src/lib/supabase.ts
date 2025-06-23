import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create a typed Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public'
  },
  auth: {
    persistSession: true,
    storageKey: 'hpms-auth',
    storage: window.localStorage,
  },
  global: {
    headers: {
      'x-application-name': 'HPMS'
    },
    fetch: (url, options = {}) => {
      console.log(`🌐 Supabase request to: ${url}`);
      return fetch(url, {
        ...options,
        // Add DNS prefetch and cache control
        cache: 'no-cache',
      }).catch(error => {
        console.error(`🚨 Network error for ${url}:`, error);
        throw error;
      });
    }
  }
});

// Helper function to log database errors
export const logDatabaseError = (error: any, context: string) => {
  console.error(`Database Error in ${context}:`, {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code
  });
};