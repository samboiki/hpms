# Debug 500 Internal Server Error Guide

## Problem
The edge function is returning a 500 Internal Server Error, which means the function is running but encountering an error.

## Step-by-Step Debugging Process

### Step 1: Check Edge Function Logs
1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt
2. Navigate to **Edge Functions** > `send-batch-email`
3. Click on **Logs** or **Invocations**
4. Look for the most recent invocation with the error
5. Check the error message in the logs

### Step 2: Verify Database Function Exists
Run this SQL in your Supabase SQL Editor:

```sql
-- Check if the prepare_batch_for_sending function exists
SELECT proname, proargnames, prosrc 
FROM pg_proc 
WHERE proname = 'prepare_batch_for_sending';
```

If the function doesn't exist, you need to run the database setup SQL first.

### Step 3: Test Database Function Manually
Copy and paste the contents of `/home/happy/projects/hpms/test-database-function.sql` into your Supabase SQL Editor and run it.

This will check:
- ✅ If the batch exists
- ✅ If the database function works
- ✅ If medical aid provider emails are configured
- ✅ If batch details and trailer exist

### Step 4: Common Issues and Solutions

#### Issue A: Database Function Missing
**Error:** `function prepare_batch_for_sending(uuid) does not exist`

**Solution:** Run the database setup SQL from your original function code in Supabase SQL Editor.

#### Issue B: Missing Medical Aid Provider Email
**Error:** `No recipient email found for batch`

**Solution:** 
1. Check the `medical_aid_providers` table
2. Ensure the `medical_aid_reference` from your batch matches a record in the providers table
3. Ensure the provider record has a valid `email` field

#### Issue C: Missing Environment Variables
**Error:** `Missing required environment variables`

**Solution:**
1. Go to Supabase Dashboard > Settings > Edge Functions > Secrets
2. Verify these exist:
   - `GMAIL_ADDRESS`
   - `GMAIL_APP_PASSWORD`

#### Issue D: Gmail Authentication Error
**Error:** `SMTP connection failed` or `Invalid credentials`

**Solution:**
1. Verify you're using a Gmail App Password (not regular password)
2. Ensure 2-Factor Authentication is enabled on your Gmail account
3. The app password should be 16 characters without spaces

### Step 5: Test with Simple HTML Page
Open `/home/happy/projects/hpms/test-edge-function.html` in your browser to test the function directly.

### Step 6: Check Batch Data
Verify the batch has the required data:

```sql
-- Check batch structure
SELECT 
    bh.*,
    COUNT(bd.id) as detail_count,
    bt.total_detail_transactions
FROM batch_headers bh
LEFT JOIN batch_details bd ON bd.batch_header_id = bh.id
LEFT JOIN batch_trailer bt ON bt.batch_header_id = bh.id
WHERE bh.id = '782752c0-cb09-4c11-b43a-0365c2a0d152'
GROUP BY bh.id, bt.total_detail_transactions;
```

## Most Likely Causes

1. **Database function not created** (most common)
2. **Missing medical aid provider email mapping**
3. **Invalid Gmail credentials in secrets**
4. **Batch missing required details or trailer**

## Next Steps

1. ✅ Check the edge function logs first
2. ✅ Run the database test SQL
3. ✅ Verify all secrets are properly set
4. ✅ Ensure the database function is created

Once you identify the specific error from the logs, we can provide a targeted fix!