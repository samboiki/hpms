# Setting Environment Variables for Communication Gateway

## 1. SMS Portal Configuration

Go to your Supabase Dashboard > Edge Functions > Secrets and add:

```
SMS_PORTAL_CLIENT_ID = your-sms-portal-client-id
SMS_PORTAL_API_SECRET = your-sms-portal-api-secret
```

## 2. Email Configuration (Already Set)

These are already configured:
- RESEND_API_KEY = (already set - 36 chars)
- SENDER_EMAIL = onboarding@resend.dev

## 3. Update Sender Email (Optional)

If you want to use a different sender email:
```
SENDER_EMAIL = noreply@yourdomain.com
```

## 4. How to Set via Supabase CLI

If you have the Supabase CLI installed:

```bash
# Set SMS Portal credentials
supabase secrets set SMS_PORTAL_CLIENT_ID="your-client-id" --project-ref jjxlfunlbyayxwvlpgwt
supabase secrets set SMS_PORTAL_API_SECRET="your-api-secret" --project-ref jjxlfunlbyayxwvlpgwt

# Update sender email if needed
supabase secrets set SENDER_EMAIL="noreply@yourdomain.com" --project-ref jjxlfunlbyayxwvlpgwt

# List all secrets to verify
supabase secrets list --project-ref jjxlfunlbyayxwvlpgwt
```

## 5. Via Supabase Dashboard

1. Go to https://app.supabase.com/project/jjxlfunlbyayxwvlpgwt
2. Navigate to Edge Functions > Secrets
3. Add the SMS Portal credentials
4. Save changes

## 6. Test After Setting

Once set, the edge functions will automatically use these credentials. No restart needed!