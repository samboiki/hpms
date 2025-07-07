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
    fetch: async (url, options = {}) => {
      const startTime = performance.now();
      const urlObj = new URL(url);
      const endpoint = urlObj.pathname;
      
      // Extract table name from URL for better logging
      const tableMatch = endpoint.match(/\/rest\/v1\/([^?]+)/);
      const tableName = tableMatch ? tableMatch[1] : 'unknown';
      
      console.log(`🌐 Supabase request to: ${url}`);
      
      try {
        const response = await fetch(url, {
          ...options,
          // Add DNS prefetch and cache control
          cache: 'no-cache',
        });
        
        const duration = performance.now() - startTime;
        
        // Log slow queries (over 500ms)
        if (duration > 500) {
          console.warn(`⚠️ Slow query detected: ${tableName} took ${duration.toFixed(2)}ms`);
        } else if (duration > 200) {
          console.log(`⏱️ ${tableName} query: ${duration.toFixed(2)}ms`);
        }
        
        return response;
      } catch (error) {
        const duration = performance.now() - startTime;
        console.error(`🚨 Network error for ${url} after ${duration.toFixed(2)}ms:`, error);
        throw error;
      }
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