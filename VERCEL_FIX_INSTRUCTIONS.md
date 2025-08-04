# Vercel Deployment Fix Instructions

## Current Status

1. ✅ Created new project: onehealth-marketing
2. ✅ Removed onehealthsystems.com and www.onehealthsystems.com from old project
3. ✅ Added environment variables to onehealth-marketing
4. ✅ Removed admin/dashboard routes from marketing site (fixed build error)
5. ❌ Root Directory incorrectly set to `onehealth/onehealth`

## Manual Steps Needed in Vercel Dashboard

### 1. Go to Vercel Dashboard
- Visit: https://vercel.com/onehealth/onehealth-marketing/settings/general

### 2. Fix Root Directory Setting
- Find "Root Directory" setting
- Current value appears to be: `onehealth` 
- **IMPORTANT**: Since we're deploying FROM the onehealth directory, leave this EMPTY
- Clear the field completely (no value)
- Click Save

### 3. Update Build & Output Settings
- Build Command: `npm run build` (should be correct)
- Output Directory: `.next` (should be correct)
- Install Command: `npm install` (should be correct)

### 4. Redeploy
- Go to Deployments tab
- Click "Redeploy" on the latest deployment
- Select "Redeploy with existing Build Cache"

### 5. Add Custom Domains
Once the build succeeds:
- Go to Settings > Domains
- Add: onehealthsystems.com
- Add: www.onehealthsystems.com

## Current Project Setup

### onehealth-marketing (Marketing Site)
- Project ID: prj_P4jxkADXym2N5Dy5EOmP8gkoIc3g
- Should serve: onehealthsystems.com, www.onehealthsystems.com
- Root Directory: onehealth
- Environment Variables: ✅ Set

### onehealth (HPMS App)
- Should serve: app.onehealthsystems.com, admin.onehealthsystems.com
- Root Directory: / (root of repo)

## Verification

After fixing:
1. onehealthsystems.com → Marketing site (Hero, Features, etc.)
2. app.onehealthsystems.com → HPMS login
3. admin.onehealthsystems.com → HPMS login (for admin users)
