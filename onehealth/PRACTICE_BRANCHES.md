# Practice Branch Management

Each practice has its own branch and deployment. This ensures complete isolation and customization per practice.

## Current Practice Branches

### 1. newcharmdental
- **Branch**: `newcharmdental`
- **Domain**: https://www.newcharmdentalpractice.com
- **Vercel Project**: newcharmdental
- **Practice Type**: Dental

## How to Create a New Practice Branch

1. **Create a new branch from main**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b [practice-name]
   ```

2. **Update practice configuration**:
   Edit `src/config/practice.config.ts` with:
   - Practice name
   - Practice ID (should match branch name)
   - Branding colors
   - Contact information
   - Feature toggles
   - Domain

3. **Push the branch**:
   ```bash
   git push -u origin [practice-name]
   ```

4. **Configure Vercel**:
   - Create new project in Vercel
   - Set Git branch to the practice branch
   - Add environment variables
   - Connect custom domain

## Environment Variables per Practice

Each practice deployment needs:
```
NEXT_PUBLIC_SUPABASE_URL=https://jjxlfunlbyayxwvlpgwt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_dzxer8L4aIxCUOK7CnCM-A_YjHyS3En
NEXT_PUBLIC_PRACTICE_ID=[practice-id]
```

## Updating a Practice

1. **Switch to practice branch**:
   ```bash
   git checkout [practice-name]
   ```

2. **Pull latest changes from main** (if needed):
   ```bash
   git merge main
   ```

3. **Make practice-specific changes**

4. **Push updates**:
   ```bash
   git push origin [practice-name]
   ```

## Best Practices

- Never merge practice branches into main
- Keep practice-specific customizations in the config file
- Use feature flags for practice-specific features
- Test locally with practice config before deploying