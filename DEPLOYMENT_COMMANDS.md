# Edge Function Deployment Commands

## Prerequisites

1. **Get Supabase Access Token**
   - Go to https://app.supabase.com/account/tokens
   - Create a new access token
   - Copy the token

2. **Login to Supabase CLI**
   ```bash
   npx supabase login --token YOUR_ACCESS_TOKEN_HERE
   ```

## Deploy Edge Functions

### Deploy send-individual-email
```bash
npx supabase functions deploy send-individual-email --no-verify-jwt
```

### Deploy send-batch-email
```bash
npx supabase functions deploy send-batch-email --no-verify-jwt
```

### Deploy both functions at once
```bash
npx supabase functions deploy send-individual-email --no-verify-jwt && \
npx supabase functions deploy send-batch-email --no-verify-jwt
```

## Link to Your Project (if needed)

If you haven't linked your local project to your Supabase project:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

You can find your project reference in the Supabase Dashboard URL:
`https://app.supabase.com/project/YOUR_PROJECT_REF`

## Set Environment Variables

After deployment, set the required secrets in Supabase Dashboard:

1. Go to **Project Settings** → **Edge Functions**
2. Add the following secrets:
   - `RESEND_API_KEY`: Your Resend API key
   - `SENDER_EMAIL`: Your verified sender email (optional, defaults to `onboarding@resend.dev`)

## Verify Deployment

Check that your functions are deployed:

```bash
npx supabase functions list
```

## Test the Functions

### Test send-individual-email
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-individual-email \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<h1>Hello World</h1>"
  }'
```

### Test send-batch-email
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-batch-email \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "YOUR_BATCH_ID"
  }'
```

## Notes

- The `--no-verify-jwt` flag allows the functions to be called with just the anon key
- Both functions have CORS headers configured to allow requests from any origin
- The functions use Resend for email delivery
- Make sure your RESEND_API_KEY is set in the Edge Functions secrets