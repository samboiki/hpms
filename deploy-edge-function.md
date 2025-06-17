# Deploying the send-individual-email Edge Function

The `send-individual-email` edge function is not yet deployed, which is causing the CORS errors. Here are your deployment options:

## Option 1: Deploy via Supabase Dashboard (Easiest)

1. **Navigate to your project dashboard**:
   ```
   https://app.supabase.com/project/jjxlfunlbyayxwvlpgwt/functions
   ```

2. **Create the function**:
   - Click "New function"
   - Name: `send-individual-email`
   - Copy the entire content from: `/home/happy/projects/hpms/supabase/functions/send-individual-email/index.ts`

3. **Set the required secrets**:
   - Go to Settings → Edge Functions → Secrets
   - Add: `RESEND_API_KEY` = [Your Resend API key]
   - Optional: `SENDER_EMAIL` = [Your sender email] (defaults to `onboarding@resend.dev`)

## Option 2: Deploy from Command Line (Requires Docker)

If you have Docker installed on another machine:

```bash
# Set environment variable
export SUPABASE_ACCESS_TOKEN=sbp_06c59bf6a91d76fa61c18fc8c6f9251542635a3c

# Deploy the function
npx supabase functions deploy send-individual-email \
  --project-ref jjxlfunlbyayxwvlpgwt
```

## Option 3: GitHub Actions Deployment

Create `.github/workflows/deploy-functions.yml`:

```yaml
name: Deploy Edge Functions

on:
  push:
    branches: [main, dev]
    paths:
      - 'supabase/functions/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: supabase/setup-cli@v1
        with:
          version: latest
          
      - name: Deploy send-individual-email
        run: |
          supabase functions deploy send-individual-email \
            --project-ref jjxlfunlbyayxwvlpgwt
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

Then add the secret to your GitHub repository:
- Go to Settings → Secrets → Actions
- Add: `SUPABASE_ACCESS_TOKEN` = `sbp_06c59bf6a91d76fa61c18fc8c6f9251542635a3c`

## Option 4: Temporary Database Function Workaround

While not ideal for production, you could create a database function that makes HTTP requests:

```sql
-- Enable HTTP extension
CREATE EXTENSION IF NOT EXISTS http;

-- Create email sending function
CREATE OR REPLACE FUNCTION send_email_via_resend(
  p_to text,
  p_subject text,
  p_html text,
  p_resend_api_key text
) RETURNS json AS $$
DECLARE
  v_response http_response;
  v_payload json;
BEGIN
  v_payload := json_build_object(
    'from', 'onboarding@resend.dev',
    'to', ARRAY[p_to],
    'subject', p_subject,
    'html', p_html
  );

  v_response := http((
    'POST',
    'https://api.resend.com/emails',
    ARRAY[http_header('Authorization', 'Bearer ' || p_resend_api_key)],
    'application/json',
    v_payload::text
  )::http_request);

  RETURN v_response.content::json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Verification

After deployment, test the function:

```bash
curl -X OPTIONS https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/send-individual-email \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

You should get a 200 OK response with proper CORS headers.

## Important Notes

- The edge function includes CORS headers to prevent the errors you're experiencing
- Make sure to set the `RESEND_API_KEY` secret in your deployment
- The function validates all required fields before sending
- It returns proper error messages for debugging

## Next Steps

1. Choose your preferred deployment method
2. Deploy the function
3. Set the required environment variables
4. Test the deployment
5. The CORS errors should be resolved once deployed