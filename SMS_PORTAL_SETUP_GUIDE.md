# SMS Portal API Setup Guide

## In SMS Portal Dashboard:

### 1. Create REST API Credentials
- Choose: **REST** (not FTP or HTTP)
- This will give you:
  - **Client ID**: A string like `12345` or `your-company-name`
  - **API Secret**: A password/token string

### 2. In Supabase Dashboard:

Navigate to: **Edge Functions → Secrets**

Add these EXACT secret names (case-sensitive):

 < /dev/null |  Secret Name | Secret Value | Example |
|-------------|--------------|---------|
| `SMS_PORTAL_CLIENT_ID` | Your SMS Portal Client ID | `12345` |
| `SMS_PORTAL_API_SECRET` | Your SMS Portal API Secret | `abcd1234efgh5678` |

### ⚠️ IMPORTANT:
- The secret names MUST be exactly `SMS_PORTAL_CLIENT_ID` and `SMS_PORTAL_API_SECRET`
- Don't change these names - the edge function looks for these exact names
- Use the REST API credentials from SMS Portal

### After Setup:
Your edge function will automatically use these credentials to authenticate with SMS Portal's REST API.
