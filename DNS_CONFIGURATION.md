# DNS Configuration for OneHealth Systems

## Current Architecture

### 1. Main OneHealth Website (onehealthsystems.com)
- **Type**: Marketing/Landing Page
- **Platform**: Next.js (onehealth directory)
- **Hosting**: Vercel

### 2. Practice Management System (app.onehealthsystems.com)
- **Type**: Doctor's Portal
- **Platform**: React (main HPMS)
- **Hosting**: Needs deployment

### 3. Admin Portal (admin.onehealthsystems.com)
- **Type**: System Administration
- **Platform**: React (part of HPMS)
- **Hosting**: Same as HPMS

### 4. Individual Practice Websites
- **Examples**: newcharmdentalpractice.com
- **Platform**: Next.js (branches of onehealth)
- **Hosting**: Vercel (separate projects)

## DNS Records to Add in Bluehost

### For OneHealth Main Website (onehealthsystems.com)

1. Get Vercel IP for onehealth project:
   - Deploy onehealth to Vercel
   - Get the IP from Vercel dashboard
   - Usually: 76.76.21.21 (Vercel's IP)

2. Update DNS Records:
```
Type: A
Host: @
Points To: [Vercel IP - usually 76.76.21.21]
TTL: 2 Hours

Type: A  
Host: www
Points To: [Vercel IP - usually 76.76.21.21]
TTL: 2 Hours
```

### For Practice Management System (app.onehealthsystems.com)

```
Type: CNAME
Host: app
Points To: [your-hpms-deployment].vercel.app
TTL: 2 Hours
```

### For Admin Portal (admin.onehealthsystems.com)

```
Type: CNAME
Host: admin
Points To: [your-hpms-deployment].vercel.app
TTL: 2 Hours
```

## Vercel Setup

### 1. OneHealth Marketing Site
- Project: onehealth
- Branch: main
- Domain: onehealthsystems.com, www.onehealthsystems.com

### 2. HPMS (Practice Management + Admin)
- Project: hpms
- Branch: main
- Domains: 
  - app.onehealthsystems.com
  - admin.onehealthsystems.com

### 3. Practice Websites
- Each practice gets its own Vercel project
- Example: newcharmdental → newcharmdentalpractice.com

## Step-by-Step Setup

### Step 1: Deploy OneHealth to Vercel
1. Create new Vercel project for onehealth
2. Deploy from main branch
3. Add custom domain: onehealthsystems.com

### Step 2: Deploy HPMS to Vercel
1. Create new Vercel project for HPMS
2. Deploy from main branch
3. Add custom domains:
   - app.onehealthsystems.com
   - admin.onehealthsystems.com

### Step 3: Update Bluehost DNS
1. Remove current A records pointing to 66.81.203.198
2. Add new A records pointing to Vercel
3. Add CNAME records for subdomains

### Step 4: Configure Routing in Apps
- HPMS: Setup routing to differentiate between app.* and admin.*
- OneHealth: Ensure it's the marketing site

## Environment Variables

### For OneHealth Marketing Site
```
NEXT_PUBLIC_APP_URL=https://app.onehealthsystems.com
NEXT_PUBLIC_ADMIN_URL=https://admin.onehealthsystems.com
```

### For HPMS
```
VITE_APP_URL=https://app.onehealthsystems.com
VITE_ADMIN_URL=https://admin.onehealthsystems.com
VITE_API_URL=https://jjxlfunlbyayxwvlpgwt.supabase.co
```