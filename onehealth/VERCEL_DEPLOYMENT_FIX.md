# URGENT: Vercel Deployment Fix for newcharmdental

## Issue: "Missing Supabase environment variables"

The website is down because environment variables are not set in Vercel.

## IMMEDIATE SOLUTION:

### Step 1: Go to Vercel Dashboard
1. Go to https://vercel.com/onehealth/newcharmdental
2. Click on "Settings" tab
3. Click on "Environment Variables" in the left sidebar

### Step 2: Add ALL Required Environment Variables
Add these EXACT environment variables:

```bash
# REQUIRED - Without these, the site will NOT work
NEXT_PUBLIC_SUPABASE_URL=https://jjxlfunlbyayxwvlpgwt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTc0MjEwMjAsImV4cCI6MjAzMjk5NzAyMH0.q85iVzmVGxjR0R0NeWH0hGmXq-_HYQsX7ge9YK0PBMA

# Optional but recommended
NEXT_PUBLIC_APP_NAME=OneHealth
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### Step 3: Apply to All Environments
Make sure to select:
- ✅ Production
- ✅ Preview
- ✅ Development

### Step 4: Redeploy
1. Go to the "Deployments" tab
2. Find the latest deployment
3. Click the three dots menu (⋯)
4. Click "Redeploy"
5. Click "Redeploy" in the confirmation dialog

## To Get Your Supabase Keys (if different project):
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy:
   - Project URL → NEXT_PUBLIC_SUPABASE_URL
   - anon public key → NEXT_PUBLIC_SUPABASE_ANON_KEY

## IMPORTANT:
- These variables MUST start with `NEXT_PUBLIC_` to be accessible in the browser
- Do NOT add quotes around the values in Vercel
- Make sure there are no trailing spaces