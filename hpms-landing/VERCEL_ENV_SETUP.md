# Vercel Environment Variables Setup

## Required Environment Variables

You need to add these environment variables in your Vercel project settings:

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add the following variables for Production, Preview, and Development:

```
NEXT_PUBLIC_SUPABASE_URL=https://jjxlfunlbyayxwvlpgwt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM
```

## Alternative: Hardcoded Values

The codebase has been updated to use hardcoded values as a fallback, so the site should work even without environment variables. However, it's still recommended to set them in Vercel for best practices.

## Verification

After adding the environment variables:
1. Trigger a new deployment in Vercel
2. Check the deployment logs for any errors
3. Visit your site to confirm it's working

## Note

The Supabase credentials above are for the anonymous public client and are safe to expose in the frontend code.