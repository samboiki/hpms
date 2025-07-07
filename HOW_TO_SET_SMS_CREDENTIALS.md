# How to Set SMS Portal Credentials in Supabase

## You need to set EDGE FUNCTION SECRETS, not API Keys

### Step 1: Navigate to Edge Function Secrets

1. Go to your Supabase Dashboard: https://app.supabase.com/project/jjxlfunlbyayxwvlpgwt
2. In the left sidebar, click on **"Edge Functions"**
3. Click on the **"Secrets"** tab (not API Keys)

### Step 2: Add SMS Portal Credentials

Click "New secret" and add these two secrets:

1. **SMS_PORTAL_CLIENT_ID**
   - Name: `SMS_PORTAL_CLIENT_ID`
   - Value: Your SMS Portal client ID (get this from SMS Portal)

2. **SMS_PORTAL_API_SECRET**
   - Name: `SMS_PORTAL_API_SECRET`
   - Value: Your SMS Portal API secret (get this from SMS Portal)

### Step 3: Where to Get SMS Portal Credentials

If you don't have SMS Portal credentials yet:

1. Go to https://www.smsportal.com/
2. Sign up for an account or log in
3. Navigate to API Settings or Developer section
4. You'll find:
   - Client ID (looks like: `your-client-id-here`)
   - API Secret (looks like: `your-api-secret-here`)

### Step 4: Alternative - Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Set the secrets
supabase secrets set SMS_PORTAL_CLIENT_ID="your-actual-client-id" --project-ref jjxlfunlbyayxwvlpgwt
supabase secrets set SMS_PORTAL_API_SECRET="your-actual-api-secret" --project-ref jjxlfunlbyayxwvlpgwt

# Verify they're set
supabase secrets list --project-ref jjxlfunlbyayxwvlpgwt
```

### What You're Looking For in Supabase Dashboard

Navigate to: **Edge Functions → Secrets** (NOT Settings → API)

You should see a page that shows:
- Existing secrets (like RESEND_API_KEY which is already set)
- A button to "New secret" or "Add secret"

### Example of What to Add:

| Secret Name | Secret Value |
|------------|--------------|
| SMS_PORTAL_CLIENT_ID | abc123xyz |
| SMS_PORTAL_API_SECRET | def456uvw |

### After Setting:

The edge functions will automatically use these credentials. No restart needed!

### Test After Setting:

Once set, go to http://localhost:5173/test-communication and try sending an SMS again.