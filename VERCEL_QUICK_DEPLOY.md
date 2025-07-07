# Quick Deploy Commands

## 1. HPMS Portal
```bash
cd /home/happy/projects/hpms
npx vercel
```
Project name suggestion: `hpms-portal`

## 2. Dr. Polina Landing
```bash
cd /home/happy/projects/hpms/hpms-landing
npx vercel
```
Project name suggestion: `dr-polina-landing`

## 3. Environment Variables to Add

### HPMS Portal (in Vercel Dashboard):
```
VITE_SUPABASE_URL = https://jjxlfunlbyayxwvlpgwt.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM
```

### Landing Site (in Vercel Dashboard):
```
NEXT_PUBLIC_SUPABASE_URL = https://jjxlfunlbyayxwvlpgwt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM
NEXT_PUBLIC_HPMS_URL = [URL from HPMS portal deployment]
```

## 4. After Deployment

1. Copy the deployment URLs
2. Add environment variables in Vercel Dashboard
3. Redeploy both projects
4. Test all features

## Pro Tip
Set up GitHub integration for automatic deployments on push!