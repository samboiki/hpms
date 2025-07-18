# Setup Dev Deployment on Vercel

## Current Status
- ✅ Production deployment: `onehealthx.vercel.app` (main branch)
- 🔄 Setting up dev deployment for `dev` branch

## Steps to Configure Dev Deployment

### 1. Vercel Dashboard Configuration

1. **Go to your Vercel project**: [https://vercel.com/onehealth/onehealth](https://vercel.com/dashboard)
2. **Settings** → **Git**
   - Production Branch: `main` (keep as is)
   - Enable "Automatic deployments for Git pushes"
   - Enable "Preview deployments for pull requests"

### 2. Set up Dev Domain

1. **Settings** → **Domains**
2. **Add Domain**: `onehealth-dev.vercel.app` or `dev-onehealth.vercel.app`
3. **Git Branch**: Set to `dev`

### 3. Environment Variables for Dev

1. **Settings** → **Environment Variables**
2. Add these dev-specific variables:

```
NODE_ENV = development
VITE_APP_ENV = development
NEXT_PUBLIC_APP_ENV = development
```

**Important**: Set **Environments** to `Preview` and **Git Branch** to `dev`

### 4. Alternative: CLI Setup

If you prefer using CLI, run these commands:

```bash
# Login to Vercel
npx vercel login

# Link project (if not already linked)
npx vercel link

# Set environment variables for dev branch
npx vercel env add NODE_ENV development preview dev
npx vercel env add VITE_APP_ENV development preview dev

# Deploy dev branch
git checkout dev
git push origin dev
```

### 5. Test the Setup

1. Make a change in dev branch
2. Push to dev branch: `git push origin dev`
3. Check Vercel dashboard for new deployment
4. Visit your dev URL

## Expected Result

- **Production**: `onehealthx.vercel.app` (from main branch)
- **Development**: `onehealth-dev.vercel.app` (from dev branch)
- **Preview**: Automatic deployments for any push to dev branch

## Verification

After setup, you should see:
- Production deployment from `main` branch
- Preview deployments from `dev` branch
- Different environment variables for each environment