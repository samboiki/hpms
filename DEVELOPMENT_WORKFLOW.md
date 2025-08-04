# Development Workflow for OneHealth Systems

## Environment Setup

### 1. Production Environment
- **URL**: app.onehealthsystems.com
- **Branch**: main
- **Purpose**: Live system for practices
- **Database**: Production Supabase

### 2. Development/Staging Environment
- **URL**: dev.onehealthsystems.com (or staging.onehealthsystems.com)
- **Branch**: dev
- **Purpose**: Testing new features before production
- **Database**: Development Supabase (optional: use same with RLS)

### 3. Local Development
- **URL**: localhost:5000
- **Branch**: feature branches
- **Purpose**: Individual developer work
- **Database**: Local or development Supabase

## Git Workflow

```
main (production)
  └── dev (staging)
       └── feature/new-feature (local development)
```

### Development Process

1. **Create Feature Branch**
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-feature-name
   ```

2. **Develop Locally**
   - Work on localhost:5000
   - Test thoroughly
   - Commit changes

3. **Push to Dev/Staging**
   ```bash
   git push origin feature/your-feature-name
   git checkout dev
   git merge feature/your-feature-name
   git push origin dev
   ```
   - This auto-deploys to dev.onehealthsystems.com
   - Test with real-world scenarios

4. **Deploy to Production**
   ```bash
   git checkout main
   git merge dev
   git push origin main
   ```
   - This auto-deploys to app.onehealthsystems.com
   - Live for all practices

## Vercel Configuration

### Production Setup
- Project: onehealth
- Branch: main
- Domains: 
  - app.onehealthsystems.com
  - admin.onehealthsystems.com
  - onehealthsystems.com

### Development Setup
- Same Project: onehealth
- Branch: dev
- Domain: dev.onehealthsystems.com

## Environment Variables

### Production (.env.production)
```
VITE_SUPABASE_URL=https://jjxlfunlbyayxwvlpgwt.supabase.co
VITE_SUPABASE_ANON_KEY=[production-key]
VITE_APP_ENV=production
VITE_APP_URL=https://app.onehealthsystems.com
```

### Development (.env.development)
```
VITE_SUPABASE_URL=https://jjxlfunlbyayxwvlpgwt.supabase.co
VITE_SUPABASE_ANON_KEY=[same-or-different-key]
VITE_APP_ENV=development
VITE_APP_URL=https://dev.onehealthsystems.com
```

## Database Strategy

### Option 1: Separate Development Database (Safest)
- Create a new Supabase project for development
- Clone schema from production
- Use test data only

### Option 2: Same Database with RLS (Simpler)
- Use same Supabase instance
- Add `is_test` flag to practices
- Filter test practices in development

### Option 3: Database Branching (Advanced)
- Use Supabase branching feature
- Create development branch of database
- Merge schema changes to production

## Safety Features

1. **Environment Indicators**
   - Show "DEVELOPMENT" banner in dev environment
   - Different color scheme for dev
   - Warning before destructive actions

2. **Data Protection**
   - Read-only mode for production data in dev
   - Separate test practices
   - No real patient data in development

3. **Feature Flags**
   ```javascript
   const features = {
     newBillingSystem: process.env.VITE_APP_ENV === 'development',
     experimentalFeature: process.env.VITE_ENABLE_EXPERIMENTAL === 'true'
   }
   ```

## Deployment Protection

### Vercel Settings
1. **Production Branch Protection**
   - Require PR reviews before merging to main
   - Run tests before deployment
   - Manual approval for production

2. **Automatic Deployments**
   - dev branch → dev.onehealthsystems.com (automatic)
   - main branch → app.onehealthsystems.com (automatic)
   - feature branches → preview URLs (automatic)

## Testing Workflow

1. **Local Testing** (localhost:5000)
   - Unit tests
   - Integration tests
   - Manual testing

2. **Staging Testing** (dev.onehealthsystems.com)
   - End-to-end tests
   - User acceptance testing
   - Performance testing

3. **Production Deployment**
   - Smoke tests
   - Monitor for errors
   - Quick rollback if needed

## Emergency Procedures

### Quick Rollback
```bash
# If something goes wrong in production
git checkout main
git revert HEAD
git push origin main
```

### Vercel Instant Rollback
1. Go to Vercel dashboard
2. Click on Deployments
3. Find last working deployment
4. Click "Promote to Production"