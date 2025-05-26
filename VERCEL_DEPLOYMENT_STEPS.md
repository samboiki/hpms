# Vercel Deployment Steps for Pro Plan

## Step 1: Deploy HPMS Portal

1. **Open your terminal** and navigate to the HPMS root directory:
   ```bash
   cd /home/happy/projects/hpms
   ```

2. **Run Vercel deployment**:
   ```bash
   npx vercel
   ```

3. **Follow the prompts**:
   - Login: Enter your email when prompted
   - Team: Select your Pro team
   - Link: "No" (create new project)
   - Project Name: `hpms-portal` (or your preferred name)
   - Directory: `.` (confirm current directory)
   - Build settings: Auto-detected (Vite)

4. **Wait for deployment** to complete. You'll get a URL like:
   - `https://hpms-portal-[random].vercel.app`

## Step 2: Deploy Dr. Polina Landing Site

1. **Navigate to landing directory**:
   ```bash
   cd /home/happy/projects/hpms/hpms-landing
   ```

2. **Run Vercel deployment**:
   ```bash
   npx vercel
   ```

3. **Follow the prompts**:
   - Team: Select your Pro team
   - Link: "No" (create new project)
   - Project Name: `hpms-landing` or `dr-polina`
   - Directory: `.` (confirm current directory)
   - Build settings: Auto-detected (Next.js)

4. **You'll get a URL** like:
   - `https://hpms-landing-[random].vercel.app`

## Step 3: Configure Environment Variables

### For HPMS Portal:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your `hpms-portal` project
3. Go to "Settings" → "Environment Variables"
4. Add these variables:

   ```
   VITE_SUPABASE_URL = https://jjxlfunlbyayxwvlpgwt.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM
   ```

5. Click "Save"

### For Landing Site:

1. Click on your `hpms-landing` project
2. Go to "Settings" → "Environment Variables"
3. Add these variables:

   ```
   NEXT_PUBLIC_SUPABASE_URL = https://jjxlfunlbyayxwvlpgwt.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM
   NEXT_PUBLIC_HPMS_URL = [YOUR_HPMS_PORTAL_URL_FROM_STEP_1]
   ```

4. Replace `[YOUR_HPMS_PORTAL_URL_FROM_STEP_1]` with the actual URL from step 1
5. Click "Save"

## Step 4: Redeploy with Environment Variables

After adding environment variables, redeploy both projects:

1. **For each project in Vercel Dashboard**:
   - Go to "Deployments" tab
   - Click three dots on the latest deployment
   - Select "Redeploy"
   - Choose "Use existing Build Cache"

## Step 5: Set Up Custom Preview Domains (Pro Feature)

Since you're on Pro plan, you can set up custom preview domains:

### For HPMS Portal:
1. Go to project Settings → Domains
2. Add domain: `hpms-portal.vercel.app` (if available)
3. Or use: `hpms-[yourteamname].vercel.app`

### For Landing Site:
1. Go to project Settings → Domains
2. Add these domains for multi-tenant access:
   - `dr-polina.vercel.app` (main)
   - `cityclinic-preview.vercel.app`
   - `coastalmed-preview.vercel.app`

## Step 6: Test Your Deployments

### HPMS Portal Tests:
1. Visit your deployment URL
2. Try logging in with existing credentials
3. Test appointment creation
4. Verify patient management works

### Landing Site Tests:
1. Visit main URL
2. Test booking form
3. Check Google Maps loads
4. Verify service selection works
5. Test multi-tenant by visiting with different subdomains

## Pro Plan Benefits You Can Use:

1. **Team Collaboration**: 
   - Invite team members from Settings → Team
   - Set up different roles

2. **Preview Deployments**:
   - Every push to `dev` branch creates preview
   - Share preview links with clients

3. **Analytics**:
   - Enable Web Analytics in project settings
   - Monitor performance and usage

4. **Custom Headers**:
   - Add security headers if needed
   - Configure CORS policies

## Troubleshooting:

If deployment fails:
1. Check build logs in Vercel Dashboard
2. Ensure all dependencies are in package.json
3. Verify Node version compatibility

If environment variables don't work:
1. Redeploy after adding them
2. Check variable names match exactly
3. Ensure no spaces in values

## Your Temporary Viewing URLs:

After deployment, you'll have:

**HPMS Portal**: 
- `https://hpms-portal-[random].vercel.app`

**Dr. Polina Site**:
- `https://hpms-landing-[random].vercel.app`

**Multi-tenant Access** (after domain setup):
- `https://dr-polina.vercel.app`
- `https://cityclinic-preview.vercel.app`
- `https://coastalmed-preview.vercel.app`

Save these URLs to share with your team or clients!