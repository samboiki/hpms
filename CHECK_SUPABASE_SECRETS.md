# Supabase Secrets Configuration Check

## Required Environment Variables for Edge Function

The `send-batch-email` edge function requires these secrets to be set in your Supabase project:

### 1. SUPABASE_URL ✅ (Auto-provided by Supabase)
- This is automatically available in edge functions
- Value: `https://jjxlfunlbyayxwvlpgwt.supabase.co`

### 2. SUPABASE_ANON_KEY ✅ (Auto-provided by Supabase) 
- This is automatically available in edge functions
- Value: Your project's anon key

### 3. GMAIL_ADDRESS ❓ (You mentioned this is set)
- Your Gmail address for sending emails
- Example: `yourpractice@gmail.com`

### 4. GMAIL_APP_PASSWORD ❓ (You mentioned this is set)
- Gmail App Password (not your regular password)
- Must be generated from Google Account settings

## How to Check/Set Secrets:

### In Supabase Dashboard:
1. Go to: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt
2. Navigate to **Settings** > **Edge Functions**
3. Scroll down to **Secrets**
4. Verify these secrets exist:
   - `GMAIL_ADDRESS`
   - `GMAIL_APP_PASSWORD`

### If Missing, Add Them:
```bash
# In your terminal (if you have Supabase CLI set up)
supabase secrets set GMAIL_ADDRESS=your-email@gmail.com
supabase secrets set GMAIL_APP_PASSWORD=your-app-password
```

## Gmail App Password Setup:
If you haven't set up an App Password yet:

1. Go to your Google Account settings
2. Navigate to **Security** > **2-Step Verification**
3. Scroll down to **App passwords**
4. Generate a new app password for "Mail"
5. Use this 16-character password (not your regular Gmail password)

## Testing the Secrets:
After deploying the updated edge function, test it from the Batch Management tab. Check the edge function logs in Supabase dashboard to see if there are any missing secret errors.

## Common Issues:
- ❌ Using regular Gmail password instead of App Password
- ❌ Gmail account doesn't have 2-Factor Authentication enabled
- ❌ App Password contains spaces (remove all spaces)
- ❌ Secret names have typos (case-sensitive)

The edge function will log clear error messages if any secrets are missing or invalid.