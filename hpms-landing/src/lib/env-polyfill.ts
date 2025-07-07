// Environment variable polyfill to prevent any "Missing Supabase environment variables" errors
// This ensures compatibility with any code that might check for environment variables

if (typeof window !== 'undefined') {
  // Browser environment
  if (!window.process) {
    (window as any).process = { env: {} };
  }
  if (!window.process.env) {
    window.process.env = {};
  }
  
  // Set the environment variables in the window object
  window.process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
  window.process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';
  
  // Also set them on globalThis for any modules that might use it
  (globalThis as any).process = window.process;
}

// Ensure process.env exists in Node environment too
if (typeof process !== 'undefined' && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://jjxlfunlbyayxwvlpgwt.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM';
}

export {};