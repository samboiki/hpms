# Fixing Deployment Cache Issues

## Problem
The web version shows old modal styles while localhost shows the updated styles. This indicates a caching issue where the browser or CDN is serving outdated files.

## Solution Steps

### 1. **Clear Vercel Cache** (if using Vercel)
```bash
# Force a new deployment with cache bypass
vercel --force

# Or trigger redeployment from Vercel dashboard
# Settings > Git > Redeploy
```

### 2. **Update Build Configuration**
Add cache-busting to your build process:

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Add hash to filenames
        entryFileNames: `assets/[name].[hash].js`,
        chunkFileNames: `assets/[name].[hash].js`,
        assetFileNames: `assets/[name].[hash].[ext]`
      }
    }
  }
});
```

### 3. **Add Cache Headers**
Update `vercel.json` to control caching:

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=1, stale-while-revalidate=59"
        }
      ]
    }
  ]
}
```

### 4. **Force Client Refresh**
For immediate fix, users can:
- Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Clear browser cache for the specific domain
- Open in incognito/private mode to verify

### 5. **Version Management**
Add version tracking to detect updates:

```typescript
// src/lib/version.ts
export const APP_VERSION = process.env.VITE_APP_VERSION || '1.0.0';

// Check version on app load
const checkVersion = async () => {
  const response = await fetch('/version.json');
  const { version } = await response.json();
  
  if (version !== APP_VERSION) {
    // Notify user and reload
    if (confirm('New version available. Reload now?')) {
      window.location.reload(true);
    }
  }
};
```

### 6. **Service Worker Update**
If using a service worker, ensure it updates:

```javascript
// In your service worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CURRENT_CACHE)
          .map(cacheName => caches.delete(cacheName))
      );
    })
  );
});
```

## Immediate Actions

1. **Trigger New Deployment**
   ```bash
   git add .
   git commit -m "Force cache refresh with updated modals"
   git push origin dev
   ```

2. **Clear CDN Cache** (if applicable)
   - Cloudflare: Purge Everything from dashboard
   - Vercel: Automatic on new deployment
   - Custom CDN: Use provider's cache purge API

3. **Notify Users** (optional)
   Add a temporary banner:
   ```typescript
   <div className="bg-blue-500 text-white p-2 text-center">
     UI updates available - please refresh your browser (Ctrl+F5)
   </div>
   ```

## Verification Steps

1. Deploy changes
2. Wait 2-3 minutes for propagation
3. Test in incognito mode first
4. Check main site with hard refresh
5. Verify modal styles match localhost

## Long-term Prevention

1. **Implement versioning** in your build process
2. **Use unique filenames** for each build
3. **Set appropriate cache headers**
4. **Monitor deployment status** in your hosting dashboard
5. **Consider Progressive Web App** approach with update notifications

## Quick Command

Run this to force a fresh deployment:
```bash
# Bump version, commit, and deploy
npm version patch && git push --tags && git push origin dev
```