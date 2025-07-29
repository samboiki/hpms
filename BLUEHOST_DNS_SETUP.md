# Bluehost DNS Setup for Development Environment

## DNS Records to Add for Development Environment

### 1. Development Environment (dev.onehealthsystems.com)

```
Type: A
Host Record: dev
Points To: 76.76.21.21
TTL: 2 Hours
```

### 2. Staging Environment (staging.onehealthsystems.com) - Optional

```
Type: A
Host Record: staging
Points To: 76.76.21.21
TTL: 2 Hours
```

## How to Add These Records in Bluehost

1. **Login to Bluehost Control Panel**
   - Go to your Bluehost account
   - Navigate to Domains section
   - Select "Zone Editor" or "DNS Manager"

2. **Add A Record for dev subdomain**
   - Click "Add Record"
   - Type: A
   - Host Record: dev
   - Points To: 76.76.21.21
   - TTL: 14400 (4 hours) or 7200 (2 hours)
   - Click "Save"

3. **Verify in Vercel**
   - The domains should automatically verify once DNS propagates
   - This can take 5-30 minutes

## Complete DNS Configuration

After adding these records, your complete DNS setup will be:

### Production:
- onehealthsystems.com → Vercel (76.76.21.21)
- www.onehealthsystems.com → Vercel (76.76.21.21)
- app.onehealthsystems.com → onehealth-bice.vercel.app
- admin.onehealthsystems.com → onehealth-bice.vercel.app

### Development:
- dev.onehealthsystems.com → Vercel (76.76.21.21)
- staging.onehealthsystems.com → Vercel (76.76.21.21) [optional]

## Testing the Setup

Once DNS propagates, you can test:

1. **Check DNS propagation**
   ```bash
   nslookup dev.onehealthsystems.com
   # Should return 76.76.21.21
   ```

2. **Visit the development site**
   - https://dev.onehealthsystems.com
   - Should show your development branch deployment

## Environment Separation

With this setup:
- **Production** (app.onehealthsystems.com) runs from `main` branch
- **Development** (dev.onehealthsystems.com) runs from `dev` branch
- Changes can be tested on dev before pushing to production
- No risk of breaking live practices during development
