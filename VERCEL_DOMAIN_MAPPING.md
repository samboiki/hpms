# Vercel Domain to Branch Mapping

## Current Configuration

### Production Domains (main branch)
- **app.onehealthsystems.com** → `main` branch
- **admin.onehealthsystems.com** → `main` branch

### Development Domains (dev branch)
- **dev.onehealthsystems.com** → `dev` branch
- **staging.onehealthsystems.com** → `dev` branch (optional)

## Vercel Project: onehealth-bice

### Branch Deployments
1. **main branch**
   - Automatically deploys to: app.onehealthsystems.com, admin.onehealthsystems.com
   - Production environment
   - Used by live practices

2. **dev branch**
   - Automatically deploys to: dev.onehealthsystems.com
   - Development/staging environment
   - For testing new features

## DNS Configuration Status

### ✅ Configured in Bluehost
- app.onehealthsystems.com → CNAME to onehealth-bice.vercel.app
- admin.onehealthsystems.com → CNAME to onehealth-bice.vercel.app
- dev.onehealthsystems.com → A record to 76.76.21.21 (as you mentioned)

### ✅ Configured in Vercel
- All domains added to the onehealth project
- Branch deployments enabled for main and dev
- Environment variables set

## How It Works

1. **Push to main branch**
   - Triggers deployment to production domains
   - Updates app.onehealthsystems.com and admin.onehealthsystems.com

2. **Push to dev branch**
   - Triggers deployment to development domain
   - Updates dev.onehealthsystems.com only

3. **Feature branches**
   - Create preview deployments with unique URLs
   - Don't affect any custom domains

## Testing the Setup

### Check if dev.onehealthsystems.com is working:
```bash
# Check DNS resolution
nslookup dev.onehealthsystems.com

# Check with curl
curl -I https://dev.onehealthsystems.com
```

### Verify branch deployments:
1. Make a change in dev branch
2. Push to origin/dev
3. Check dev.onehealthsystems.com updates
4. Verify app.onehealthsystems.com remains unchanged

## Deployment URLs

- **Production**: https://app.onehealthsystems.com
- **Development**: https://dev.onehealthsystems.com
- **Vercel Dashboard**: https://vercel.com/onehealth/onehealth
