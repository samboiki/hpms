# Vercel Deployment Guide

This guide covers deploying both the HPMS Portal and Dr. Polina's landing page to Vercel.

## Prerequisites

1. Vercel account (https://vercel.com)
2. Vercel CLI installed: `npm i -g vercel`
3. Git repository connected to GitHub

## HPMS Portal Deployment

### 1. Project Setup

The main HPMS portal is a Vite + React application located in the root directory.

### 2. Deploy via Vercel CLI

```bash
cd /home/happy/projects/hpms
vercel
```

Follow the prompts:
- Select your Vercel team
- Link to existing project or create new
- Confirm project settings

### 3. Environment Variables

Add these environment variables in Vercel Dashboard:

```
VITE_SUPABASE_URL=https://jjxlfunlbyayxwvlpgwt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM
```

### 4. Production URL

After deployment, your HPMS portal will be available at:
- `https://your-project-name.vercel.app`

## Dr. Polina Landing Page Deployment

### 1. Project Setup

The landing page is a Next.js application in the `hpms-landing` subdirectory.

### 2. Deploy via Vercel CLI

```bash
cd /home/happy/projects/hpms/hpms-landing
vercel
```

Follow the prompts:
- Select your Vercel team
- Create new project (e.g., "hpms-landing" or "dr-polina")
- Confirm project settings

### 3. Environment Variables

Add these environment variables in Vercel Dashboard:

```
NEXT_PUBLIC_SUPABASE_URL=https://jjxlfunlbyayxwvlpgwt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqeGxmdW5sYnlheXh3dmxwZ3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNjE2ODksImV4cCI6MjA2MjYzNzY4OX0.TCNww59ZpJ00QhZgld4QJkYCHz53GAtyjw4F5hptFAM
NEXT_PUBLIC_HPMS_URL=https://your-hpms-portal.vercel.app
```

**Important**: Update `NEXT_PUBLIC_HPMS_URL` with your actual HPMS portal URL after deployment.

### 4. Domain Configuration

To use the multi-tenant functionality:

1. **Add Custom Domains** in Vercel Dashboard:
   - `cityclinic.yourdomain.com`
   - `coastalmed.yourdomain.com`
   - `drpolina.yourdomain.com`

2. **Configure DNS** at your domain provider:
   - Add CNAME records pointing to `cname.vercel-dns.com`

3. **Alternative**: Use Vercel subdomains:
   - `cityclinic-landing.vercel.app`
   - `coastalmed-landing.vercel.app`
   - `drpolina-landing.vercel.app`

## Deployment via GitHub Integration

### Alternative Method: Automatic Deployment

1. **Connect GitHub Repository**:
   - Go to Vercel Dashboard
   - Click "New Project"
   - Import from GitHub
   - Select `samboiki/hpms` repository

2. **Configure Projects**:
   - For HPMS Portal: Set root directory to `/`
   - For Landing Page: Set root directory to `/hpms-landing`

3. **Automatic Deployments**:
   - Production: Deploys on push to `main` branch
   - Preview: Deploys on push to `dev` branch

## Post-Deployment Steps

1. **Test All Features**:
   - Booking system
   - Google Maps integration
   - Form submissions
   - Multi-tenant routing

2. **Update CORS Settings** in Supabase:
   - Add your Vercel domains to allowed origins

3. **Monitor Performance**:
   - Check Vercel Analytics
   - Set up error tracking

## Troubleshooting

### Common Issues

1. **Build Failures**:
   - Check Node.js version compatibility
   - Ensure all dependencies are in package.json
   - Review build logs in Vercel Dashboard

2. **Environment Variables**:
   - Verify all required variables are set
   - Use correct prefixes (VITE_ for Vite, NEXT_PUBLIC_ for Next.js)

3. **Domain Routing**:
   - Ensure middleware.ts is properly configured
   - Check DNS propagation (can take up to 48 hours)

### Support Resources

- Vercel Documentation: https://vercel.com/docs
- Supabase Documentation: https://supabase.com/docs
- Project Repository: https://github.com/samboiki/hpms

## Security Notes

- Never commit `.env` files to Git
- Use Vercel's environment variable UI for sensitive data
- Enable HTTPS (automatic with Vercel)
- Set up proper CORS policies

## Maintenance

- Regular dependency updates: `npm update`
- Monitor Vercel usage and limits
- Keep Supabase schema in sync
- Regular backups of production data