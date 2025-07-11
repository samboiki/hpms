# Google Workspace Service Account Implementation for HPMS

## Overview

This document outlines the implementation of Google Workspace service account authentication for seamless email sending without user interaction or token refresh requirements.

## Benefits of Service Account

1. **No User Interaction Required** - Emails sent directly without OAuth flow
2. **No Token Refresh Needed** - Service accounts use JWT authentication
3. **Domain-Wide Delegation** - Can send emails on behalf of any user in the domain
4. **Improved Reliability** - No expired tokens or refresh failures
5. **Better for Automation** - Perfect for automated email campaigns

## Prerequisites

1. **Google Workspace Admin Access** - Required to enable domain-wide delegation
2. **Service Account Created** - In Google Cloud Console
3. **Domain-Wide Delegation Enabled** - For the service account
4. **API Scopes Authorized** - In Google Workspace Admin

## Implementation Plan

### Phase 1: Google Cloud Setup (Admin Tasks)

> **Note**: Google updated their UI in January 2025. For detailed visual guides, see [GOOGLE_UI_UPDATES_2025.md](./GOOGLE_UI_UPDATES_2025.md)

#### 1. Create Service Account
```bash
# In Google Cloud Console:
1. Go to IAM & Admin > Service Accounts
2. Click "Create Service Account"
3. Name: "HPMS Email Service"
4. Service Account ID: hpms-email-service
5. Grant no roles (not needed for Gmail API)
6. Create and download JSON key file
```

#### 2. Enable Domain-Wide Delegation
```bash
1. In Service Accounts list, click on the created account
2. Go to "Details" tab
3. Under "Domain-wide delegation" section, click "Show domain-wide delegation"
4. Click "Enable domain-wide delegation"
5. Enter a product name for the consent screen (e.g., "HPMS Email Service")
6. Click "Save"
7. Note the Client ID (will be needed for admin console)
```

#### 3. Authorize in Google Workspace Admin
```bash
1. Go to admin.google.com
2. Security > Access and data control > API controls
3. Manage Domain Wide Delegation
4. Add new:
   - Client ID: [Service Account Client ID]
   - OAuth Scopes:
     https://www.googleapis.com/auth/gmail.send
     https://www.googleapis.com/auth/gmail.compose
     https://www.googleapis.com/auth/gmail.modify
```

### Phase 2: Database Schema Updates

#### 1. Add Service Account Storage Table
```sql
-- Store service account credentials per practice
CREATE TABLE IF NOT EXISTS practice_service_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  service_account_email TEXT NOT NULL,
  private_key TEXT NOT NULL, -- Encrypted
  client_id TEXT NOT NULL,
  auth_uri TEXT DEFAULT 'https://accounts.google.com/o/oauth2/auth',
  token_uri TEXT DEFAULT 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url TEXT DEFAULT 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url TEXT,
  domain TEXT NOT NULL, -- Google Workspace domain
  default_sender_email TEXT NOT NULL, -- Email to send from
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(practice_id, provider)
);

-- Enable RLS
ALTER TABLE practice_service_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Practices can manage their service accounts" ON practice_service_accounts
  FOR ALL USING (
    practice_id IN (
      SELECT practice_id FROM practice_staff 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'owner')
    )
  );
```

#### 2. Update OAuth Apps Table
```sql
-- Add column to indicate service account usage
ALTER TABLE practice_oauth_apps 
ADD COLUMN IF NOT EXISTS use_service_account BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS service_account_id UUID REFERENCES practice_service_accounts(id);
```

### Phase 3: Edge Function Updates

#### 1. New Service Account Email Gateway
```typescript
// supabase/functions/service-account-email-gateway/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { JWT } from 'https://esm.sh/google-auth-library@9.4.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  practiceId: string
  recipientEmail: string
  subject: string
  htmlContent: string
  emailType: string
  patientId?: string
  metadata?: Record<string, any>
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const emailRequest = await req.json() as EmailRequest
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get practice service account
    const { data: serviceAccount, error: saError } = await supabase
      .from('practice_service_accounts')
      .select('*')
      .eq('practice_id', emailRequest.practiceId)
      .eq('provider', 'google')
      .eq('enabled', true)
      .single()

    if (saError || !serviceAccount) {
      throw new Error('Service account not configured')
    }

    // Create JWT client
    const jwt = new JWT({
      email: serviceAccount.service_account_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      subject: serviceAccount.default_sender_email, // Impersonate this user
    })

    // Get access token
    const { access_token } = await jwt.getAccessToken()

    // Prepare email
    const emailContent = createMimeMessage({
      from: serviceAccount.default_sender_email,
      to: emailRequest.recipientEmail,
      subject: emailRequest.subject,
      html: emailRequest.htmlContent,
    })

    // Send via Gmail API
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: btoa(emailContent).replace(/\+/g, '-').replace(/\//g, '_'),
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Gmail API error: ${await response.text()}`)
    }

    const result = await response.json()

    // Log the email
    await supabase.from('practice_email_logs').insert({
      practice_id: emailRequest.practiceId,
      patient_id: emailRequest.patientId,
      recipient_email: emailRequest.recipientEmail,
      subject: emailRequest.subject,
      email_type: emailRequest.emailType,
      provider: 'gmail_service_account',
      provider_message_id: result.id,
      status: 'sent',
      sent_at: new Date().toISOString(),
      metadata: {
        ...emailRequest.metadata,
        service_account_used: true,
        sender_email: serviceAccount.default_sender_email,
      },
    })

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Service account email error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})

function createMimeMessage(options: {
  from: string
  to: string
  subject: string
  html: string
}) {
  const boundary = '----=_Part_0_1234567890.1234567890123'
  
  return [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    options.html,
    `--${boundary}--`,
  ].join('\r\n')
}
```

#### 2. Update Centralized Email Gateway
```typescript
// Add service account check to existing gateway
const { data: serviceAccount } = await supabase
  .from('practice_service_accounts')
  .select('id')
  .eq('practice_id', practiceId)
  .eq('enabled', true)
  .single()

if (serviceAccount) {
  // Redirect to service account gateway
  const serviceAccountResponse = await fetch(
    `${SUPABASE_URL}/functions/v1/service-account-email-gateway`,
    {
      method: 'POST',
      headers: {
        'Authorization': req.headers.get('Authorization')!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailRequest),
    }
  )
  
  return serviceAccountResponse
}
```

### Phase 4: Frontend Implementation

#### 1. Service Account Settings Component
```tsx
// src/components/settings/ServiceAccountSettings.tsx
import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { supabase } from '../../lib/supabase';
import { usePractice } from '../../contexts/PracticeContext';

export const ServiceAccountSettings: React.FC = () => {
  const { practiceId } = usePractice();
  const [isUploading, setIsUploading] = useState(false);
  const [serviceAccount, setServiceAccount] = useState<any>(null);
  const [domain, setDomain] = useState('');
  const [senderEmail, setSenderEmail] = useState('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const credentials = JSON.parse(text);

      // Validate it's a service account file
      if (!credentials.type || credentials.type !== 'service_account') {
        throw new Error('Invalid service account file');
      }

      // Store in database
      const { error } = await supabase
        .from('practice_service_accounts')
        .upsert({
          practice_id: practiceId,
          provider: 'google',
          service_account_email: credentials.client_email,
          private_key: credentials.private_key,
          client_id: credentials.client_id,
          auth_uri: credentials.auth_uri,
          token_uri: credentials.token_uri,
          auth_provider_x509_cert_url: credentials.auth_provider_x509_cert_url,
          client_x509_cert_url: credentials.client_x509_cert_url,
          domain: domain,
          default_sender_email: senderEmail,
        });

      if (error) throw error;

      // Update oauth apps to use service account
      await supabase
        .from('practice_oauth_apps')
        .update({ use_service_account: true })
        .eq('practice_id', practiceId)
        .eq('provider', 'google');

      alert('Service account configured successfully!');
    } catch (error) {
      console.error('Error uploading service account:', error);
      alert('Failed to configure service account');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Icon icon="solar:shield-keyhole-bold-duotone" className="w-8 h-8 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold">Google Workspace Service Account</h3>
            <p className="text-sm text-gray-600">
              Configure service account for automated email sending
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Google Workspace Domain
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="yourdomain.com"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Sender Email
            </label>
            <input
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="noreply@yourdomain.com"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Service Account Key File (JSON)
            </label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              disabled={!domain || !senderEmail || isUploading}
              className="w-full"
            />
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Setup Instructions:</h4>
            <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
              <li>Create a service account in Google Cloud Console</li>
              <li>Enable domain-wide delegation for the service account</li>
              <li>Download the JSON key file</li>
              <li>In Google Workspace Admin, authorize the service account</li>
              <li>Enter your domain and sender email above</li>
              <li>Upload the JSON key file</li>
            </ol>
          </div>
        </div>
      </div>
    </Card>
  );
};
```

#### 2. Update Settings Page
```tsx
// Add to Settings.tsx
import { ServiceAccountSettings } from '../components/settings/ServiceAccountSettings';

// In the social tab section
{activeTab === 'social' && (
  <div className="space-y-6">
    {/* Existing OAuth settings */}
    <OAuthAppsManagement />
    
    {/* New Service Account section */}
    <ServiceAccountSettings />
  </div>
)}
```

### Phase 5: Migration Strategy

#### 1. Gradual Rollout
```typescript
// Check for service account first, fall back to OAuth
async function sendEmail(practiceId: string, emailData: any) {
  // 1. Try service account
  const { data: serviceAccount } = await supabase
    .from('practice_service_accounts')
    .select('id')
    .eq('practice_id', practiceId)
    .eq('enabled', true)
    .single();

  if (serviceAccount) {
    return sendViaServiceAccount(emailData);
  }

  // 2. Fall back to OAuth
  const { data: oauthCreds } = await supabase
    .from('practice_oauth_credentials')
    .select('id')
    .eq('practice_id', practiceId)
    .eq('provider', 'google')
    .single();

  if (oauthCreds) {
    return sendViaOAuth(emailData);
  }

  // 3. Fall back to Resend
  return sendViaResend(emailData);
}
```

#### 2. Testing Protocol
1. Upload service account for test practice
2. Send test emails via service account
3. Verify logging and delivery
4. Test automation workflows
5. Monitor for any issues
6. Gradually enable for more practices

### Phase 6: Security Considerations

#### 1. Encryption
- Service account private keys encrypted at rest
- Use Supabase Vault for key storage
- Rotate service accounts periodically

#### 2. Access Control
- Only practice admins can upload service accounts
- Audit trail for all changes
- Monitor for unusual activity

#### 3. Rate Limiting
- Implement per-practice rate limits
- Monitor Gmail API quotas
- Alert on approaching limits

### Phase 7: Documentation for Users

#### 1. Admin Guide
- Step-by-step Google Cloud setup
- Google Workspace configuration
- Troubleshooting common issues

#### 2. Benefits Communication
- No more token expiration
- Faster email sending
- Better reliability
- Improved automation

### Implementation Timeline

1. **Week 1**: Database schema and edge functions
2. **Week 2**: Frontend components and testing
3. **Week 3**: Documentation and pilot testing
4. **Week 4**: Gradual rollout to practices

### Success Metrics

1. **Reliability**: 99.9% email delivery success
2. **Performance**: <500ms email send time
3. **Adoption**: 50% of practices using service accounts
4. **Support**: 80% reduction in email-related tickets

## Conclusion

Service account implementation provides a robust, maintenance-free solution for email automation in HPMS. By eliminating token refresh requirements and user interaction, practices can rely on consistent email delivery for all their automation needs.