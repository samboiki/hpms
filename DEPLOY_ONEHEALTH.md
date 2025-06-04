# 🚀 Deploy OneHealth Admin Portal

## Quick Deployment Steps

### 1. First, run the SQL to create admin users:

```sql
-- Execute this in Supabase Dashboard SQL Editor
-- URL: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql/new

INSERT INTO users (
  id,
  email,
  full_name,
  role,
  practice_id,
  is_super_admin,
  can_manage_practices,
  permissions,
  created_at,
  last_active_at
)
SELECT 
  au.id,
  au.email,
  CASE 
    WHEN au.email = 'admin@onehealth.na' THEN 'OneHealth Super Administrator'
    WHEN au.email = 'manager@onehealth.na' THEN 'OneHealth Practice Manager'
  END,
  'admin',
  NULL,
  CASE WHEN au.email = 'admin@onehealth.na' THEN true ELSE false END,
  true,
  jsonb_build_object(
    'practices', array['read', 'write', 'delete'],
    'users', array['read', 'write', 'delete'],
    'tariffs', array['read', 'write', 'delete'],
    'sms', array['read', 'write', 'allocate'],
    'reports', array['read', 'export'],
    'admin', array['full_access']
  ),
  NOW(),
  NOW()
FROM auth.users au
WHERE au.email IN ('admin@onehealth.na', 'manager@onehealth.na')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  practice_id = EXCLUDED.practice_id,
  is_super_admin = EXCLUDED.is_super_admin,
  can_manage_practices = EXCLUDED.can_manage_practices,
  permissions = EXCLUDED.permissions,
  last_active_at = NOW();
```

### 2. Deploy OneHealth to Vercel:

```bash
# Navigate to OneHealth directory
cd onehealth

# Install dependencies
npm install

# Build to test
npm run build

# Deploy to Vercel (if you have Vercel CLI)
vercel --prod
```

### OR Deploy via GitHub:

1. Push the onehealth folder to a GitHub repository
2. Go to https://vercel.com
3. Import the repository
4. Set these environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: https://jjxlfunlbyayxwvlpgwt.supabase.co
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM
   - `SUPABASE_SERVICE_ROLE_KEY`: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA2MTY4OSwiZXhwIjoyMDYyNjM3Njg5fQ.E0ocHFyIgXdBkJkgNRtqq2OFxbb7fZlclwpGuNo5GGA
   - `NEXT_PUBLIC_APP_NAME`: OneHealth
   - `NEXT_PUBLIC_APP_VERSION`: 1.0.0

### 3. Alternative: Run Locally

```bash
cd onehealth
npm install
npm run dev
```

Then access at: http://localhost:3000/auth/login

## 🔑 Admin Credentials

- **Super Admin**: admin@onehealth.na
- **Practice Manager**: manager@onehealth.na  
- **Password**: OneHealth2025!

## 📊 What You'll Have Access To:

- **Multi-practice management** dashboard
- **Dental tariff system** with 60+ procedure codes
- **SMS management** and allocation across practices
- **User administration** for all practices
- **Analytics and reporting** for practice performance
- **Practice types** (dental, medical, aesthetic, etc.)

## 🎯 After Deployment:

1. Login with admin credentials
2. View all practices in the system
3. Manage tariffs for each practice
4. Allocate SMS limits
5. Create new users
6. Generate reports

The OneHealth admin portal gives you complete control over all practices in the HPMS system!