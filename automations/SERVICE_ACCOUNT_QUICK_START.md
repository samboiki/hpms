# Quick Start: Google Workspace Service Account Setup

## For Practice Administrators

### Step 1: Google Cloud Console Setup (10 minutes)

1. **Go to** [Google Cloud Console](https://console.cloud.google.com)
2. **Create or Select Project**
   - Click project dropdown → "New Project"
   - Name: "HPMS Email Service"
   - Click "Create"

3. **Enable Gmail API**
   - Go to "APIs & Services" → "Library"
   - Search "Gmail API"
   - Click "Enable"

4. **Create Service Account**
   - Go to "IAM & Admin" → "Service Accounts"
   - Click "Create Service Account"
   - Name: "HPMS Email Service"
   - Service Account ID: `hpms-email-service`
   - Click "Create and Continue"
   - Skip role selection (click "Continue")
   - Click "Done"

5. **Enable Domain-Wide Delegation**
   - Click on your new service account
   - Go to "Details" tab
   - Under "Domain-wide delegation" section, click "Show domain-wide delegation"
   - Click "Enable domain-wide delegation"
   - Enter a product name for the consent screen (e.g., "HPMS Email Service")
   - Click "Save"

6. **Download Key**
   - In service account details, go to "Keys" tab
   - Click "Add Key" → "Create New Key"
   - Choose "JSON"
   - Download and save securely

7. **Copy Client ID**
   - Go back to service account details
   - Copy the "Client ID" (looks like: 123456789012345678901)
   - You'll find it under "Domain-wide delegation" section

### Step 2: Google Workspace Admin Setup (5 minutes)

1. **Go to** [Google Admin Console](https://admin.google.com)
2. **Navigate to Security**
   - Security → Access and data control → API controls
3. **Manage Domain Wide Delegation**
   - Click "Manage Domain Wide Delegation"
4. **Add New Client**
   - Click "Add new"
   - Client ID: [Paste from Step 1.7]
   - OAuth Scopes (paste all):
     ```
     https://www.googleapis.com/auth/gmail.send
     https://www.googleapis.com/auth/gmail.compose
     https://www.googleapis.com/auth/gmail.modify
     ```
   - Click "Authorize"

### Step 3: Configure in HPMS (2 minutes)

1. **Go to Settings** → **Social** → **Google Workspace**
2. **Enter Details**:
   - Domain: `yourdomain.com`
   - Sender Email: `noreply@yourdomain.com` (must exist)
3. **Upload JSON Key** from Step 1.6
4. **Click Save**

### Testing

After setup, test by:
1. Creating a new patient
2. Checking if welcome email is sent
3. Viewing email logs in Reports

## Troubleshooting

### "Domain-wide delegation not available" Error
- Ensure you have a Google Workspace account (not regular Gmail)
- You must be a super admin to enable delegation
- Try in an incognito window if having issues

### "Delegation denied" Error
- Ensure OAuth scopes are exactly as listed
- Wait 5-10 minutes for propagation
- Verify domain is correct
- Check the Client ID is from the Domain-wide delegation section

### "Invalid sender" Error
- Sender email must exist in your domain
- Create the email account if needed

### No Emails Sending
- Check service account is enabled
- Verify Gmail API is enabled
- Review logs for specific errors

## Benefits You'll See

✅ **No More Token Expiration** - Emails always send
✅ **Faster Processing** - No OAuth overhead
✅ **Better Reliability** - No refresh token failures
✅ **Simplified Management** - One setup for all users

## Security Notes

⚠️ **Keep JSON Key Secure** - It has full email access
🔒 **Limit Access** - Only practice admins should configure
📊 **Monitor Usage** - Check logs regularly
🔄 **Rotate Keys** - Every 90 days recommended

## Need Help?

Contact support with:
- Your domain name
- Error messages
- Screenshot of configuration