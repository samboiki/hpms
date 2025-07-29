# Vercel Deployment Strategy for OneHealth Systems

## Current Architecture

You have TWO separate applications that need TWO separate Vercel projects:

### 1. Marketing Website (onehealthsystems.com)
- **Location**: `/onehealth` (Next.js)
- **Local Port**: 3000
- **Domain**: onehealthsystems.com, www.onehealthsystems.com
- **Purpose**: Marketing site for potential customers

### 2. HPMS Application (app.onehealthsystems.com & admin.onehealthsystems.com)
- **Location**: `/` root (React + Vite)
- **Local Port**: 5000
- **Domains**: 
  - app.onehealthsystems.com (for doctors/practices)
  - admin.onehealthsystems.com (for OneHealth admin team)
- **Purpose**: Practice management system with role-based access
- **Note**: The admin portal (port 4000) appears to be running the same onehealth marketing codebase, but the actual admin functionality is within the HPMS app under `/pages/admin/`

## Problem

Currently all three domains are pointing to the same Vercel project (onehealth-bice) which is showing the HPMS login screen.

## Solution: Create 2 Separate Vercel Projects

### Step 1: Deploy Marketing Site (NEW PROJECT)
```bash
cd onehealth
vercel --name onehealth-marketing
# Connect to GitHub repo: samboiki/hpms
# Set root directory to: onehealth
# Deploy from: main branch
# Add domains: onehealthsystems.com, www.onehealthsystems.com
```

### Step 2: Keep HPMS Application (EXISTING PROJECT)
The current onehealth-bice project should be kept for HPMS:
```bash
# This project already exists and is deployed
# Just need to remove marketing domains and keep app/admin domains
# Root directory: / (root)
# Deploy from: main branch
# Keep domains: app.onehealthsystems.com, admin.onehealthsystems.com
```

## Environment Variables

### For Marketing Site (onehealth-marketing)
```
NEXT_PUBLIC_SUPABASE_URL=https://jjxlfunlbyayxwvlpgwt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_dzxer8L4aIxCUOK7CnCM-A_YjHyS3En
```

### For HPMS Application (onehealth-bice)
```
VITE_SUPABASE_URL=https://jjxlfunlbyayxwvlpgwt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM
```

## DNS Configuration

### Action Items:
1. **Remove from onehealth-bice project**:
   - onehealthsystems.com
   - www.onehealthsystems.com

2. **Keep in onehealth-bice project**:
   - app.onehealthsystems.com
   - admin.onehealthsystems.com

3. **Add to new onehealth-marketing project**:
   - onehealthsystems.com
   - www.onehealthsystems.com

## Steps to Fix This

### Step 1: Create New Vercel Project for Marketing
```bash
# Navigate to onehealth directory
cd /home/happy/projects/hpms/onehealth

# Install Vercel CLI if not installed
npm i -g vercel

# Create new deployment
vercel
# When prompted:
# - Set up and deploy: Y
# - Which scope: Select your account
# - Link to existing project: N
# - Project name: onehealth-marketing
# - In which directory: ./
# - Override settings: N
```

### Step 2: Add Domains to New Project
```bash
# Add marketing domains
vercel domains add onehealthsystems.com
vercel domains add www.onehealthsystems.com
```

### Step 3: Remove Domains from Old Project
```bash
# Remove marketing domains from HPMS project
vercel domains rm onehealthsystems.com --project onehealth
vercel domains rm www.onehealthsystems.com --project onehealth
```

## Verification Steps

After deployment:
1. **onehealthsystems.com** → Shows marketing site (Hero, Features, etc.)
2. **app.onehealthsystems.com** → Shows HPMS login for doctors
3. **admin.onehealthsystems.com** → Shows HPMS login (admin users login here)
