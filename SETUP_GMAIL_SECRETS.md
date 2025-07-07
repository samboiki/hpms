# Setup Gmail Secrets for Edge Function

## Problem Identified ✅
The edge function is failing because the Gmail environment variables are not properly set in Supabase.

**Error:** `Missing required environment variables. Please set secrets in Supabase dashboard.`

## Required Secrets

The edge function needs these 4 environment variables:
1. `SUPABASE_URL` ✅ (Auto-provided)
2. `SUPABASE_ANON_KEY` ✅ (Auto-provided) 
3. `GMAIL_ADDRESS` ❌ (Missing)
4. `GMAIL_APP_PASSWORD` ❌ (Missing)

## Step 1: Setup Gmail App Password

### A. Enable 2-Factor Authentication
1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security** 
3. Enable **2-Step Verification** if not already enabled

### B. Generate App Password
1. In Google Account **Security** settings
2. Find **App passwords** (under 2-Step Verification)
3. Click **Generate app password**
4. Select **Mail** as the app type
5. Copy the 16-character password (remove any spaces)

## Step 2: Set Secrets in Supabase

### Method A: Via Supabase Dashboard (Recommended)
1. Go to: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt
2. Navigate to **Settings** > **Edge Functions** 
3. Scroll down to **Secrets** section
4. Add these secrets:

```
Secret Name: GMAIL_ADDRESS
Secret Value: your-practice@gmail.com

Secret Name: GMAIL_APP_PASSWORD  
Secret Value: your-16-character-app-password
```

### Method B: Via Supabase CLI (Alternative)
If you have Supabase CLI configured:

```bash
supabase secrets set GMAIL_ADDRESS=your-practice@gmail.com
supabase secrets set GMAIL_APP_PASSWORD=your-16-character-app-password
```

## Step 3: Redeploy Edge Function

After setting the secrets, the edge function needs to be redeployed to pick up the new environment variables.

### Via Dashboard:
1. Go to **Edge Functions** > `send-batch-email`
2. Click **Deploy** or make a small edit and save

### Via CLI:
```bash
supabase functions deploy send-batch-email
```

## Step 4: Test the Fix

1. ✅ Try submitting a batch again from the Batch Management tab
2. ✅ Check the edge function logs for any new errors
3. ✅ Verify the batch status changes to 'sent'
4. ✅ Check if email is received by the medical aid provider

## Common Issues & Solutions

### Issue: "Invalid credentials" error
- ❌ Using regular Gmail password instead of App Password
- ✅ Use the 16-character App Password generated from Google Account settings

### Issue: "Authentication failed"
- ❌ 2-Factor Authentication not enabled
- ✅ Enable 2FA first, then generate App Password

### Issue: App Password has spaces
- ❌ Including spaces in the password: `abcd efgh ijkl mnop`
- ✅ Remove all spaces: `abcdefghijklmnop`

### Issue: Wrong email format
- ❌ Using personal email that doesn't have business sending permissions
- ✅ Use a business Gmail account or Gmail Workspace account

## Example Setup

```
GMAIL_ADDRESS=onehealth.practice@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
```

## Verification

After setting up the secrets, you should see success messages like:
- ✅ `Batch sent successfully to provider@medicalaid.com`
- ✅ Batch status changes from 'active' to 'sent'
- ✅ No more "Missing required environment variables" errors

The edge function will now have access to Gmail credentials and can send emails with batch files attached!