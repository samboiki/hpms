# Deployment Fixes

## 1. Vercel Deployment - Missing Supabase Environment Variables

The error "Missing Supabase environment variables" indicates that the required environment variables are not set in your Vercel deployment.

### Solution:

1. Go to your Vercel Dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add the following variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://jjxlfunlbyayxwvlpgwt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[Your Anon Key]
SUPABASE_SERVICE_ROLE_KEY=[Your Service Role Key]
```

**To get these values:**
- Go to your Supabase project dashboard
- Settings → API
- Copy the Project URL, anon key, and service_role key

### Important:
- Make sure the environment variables are added for the correct environment (Production/Preview/Development)
- After adding, redeploy your project

## 2. Edge Function Error - send-batch-email

The Edge Function has been updated to use the centralized email gateway instead of requiring a separate RESEND_API_KEY.

### What was fixed:
1. The Edge Function now uses the `centralized-email-gateway` function
2. Proper error handling for missing batch data
3. Correct table joins to fetch practice information

### Testing the fix:
```javascript
// The function should now work properly when called from your Finance page
// It will automatically use the centralized email system
```

### If you still get errors:
1. Check that the `centralized-email-gateway` Edge Function is deployed
2. Verify that the email gateway has proper API keys configured
3. Check Supabase Edge Function logs for detailed error messages

## 3. Quick Checklist

- [ ] Verify all environment variables are set in Vercel
- [ ] Redeploy after adding environment variables
- [ ] Test the batch email functionality
- [ ] Monitor Edge Function logs for any errors