'use client';

import { useEffect } from 'react';

// Ensure environment variables are set on client side
if (typeof window !== 'undefined') {
  window.process = window.process || { env: {} };
  window.process.env = window.process.env || {};
  
  // Set all possible environment variable formats
  const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';
  
  window.process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
  window.process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = supabaseKey;
  window.process.env.SUPABASE_URL = supabaseUrl;
  window.process.env.SUPABASE_ANON_KEY = supabaseKey;
  
  // Vite compatibility
  window.import = window.import || { meta: { env: {} } };
  window.import.meta = window.import.meta || { env: {} };
  window.import.meta.env = window.import.meta.env || {};
  window.import.meta.env.VITE_SUPABASE_URL = supabaseUrl;
  window.import.meta.env.VITE_SUPABASE_ANON_KEY = supabaseKey;
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Double-check environment variables are set after mount
    if (typeof window !== 'undefined') {
      const supabaseUrl = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';
      
      if (!window.process?.env?.NEXT_PUBLIC_SUPABASE_URL) {
        console.log('Setting environment variables post-mount');
        window.process = window.process || { env: {} };
        window.process.env = window.process.env || {};
        window.process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
        window.process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = supabaseKey;
      }
    }
  }, []);
  
  return <>{children}</>;
}