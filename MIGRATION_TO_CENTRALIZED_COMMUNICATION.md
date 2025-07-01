# Migration Guide: Centralized Communication Gateway

## Overview
All SMS and Email communications in the HPMS system MUST now go through the centralized gateways to ensure:
- Complete audit trail and logging
- Subscription limit enforcement  
- Cost tracking
- Consistent delivery monitoring
- Compliance with healthcare regulations

## ⚠️ IMPORTANT: NO DIRECT SMS/EMAIL SENDING ALLOWED

### ❌ OLD WAY (DO NOT USE)
```typescript
// Direct edge function calls - NO LONGER ALLOWED
await supabase.functions.invoke('send-sms', { body: {...} })
await supabase.functions.invoke('send-email', { body: {...} })
await supabase.functions.invoke('send-appointment-reminders', { body: {...} })
await supabase.functions.invoke('send-individual-email', { body: {...} })
```

### ✅ NEW WAY (REQUIRED)
```typescript
import { communicationService } from '@/services/communicationService';

// Send SMS
await communicationService.sendSMS({
  practiceId: 'practice-uuid',
  recipientPhone: '+27123456789',
  messageContent: 'Your message here',
  messageType: 'appointment_reminder', // Required: categorize the message
  patientId: 'patient-uuid', // Link to patient if applicable
  appointmentId: 'appointment-uuid' // Link to appointment if applicable
});

// Send Email  
await communicationService.sendEmail({
  practiceId: 'practice-uuid',
  recipientEmail: 'patient@example.com',
  subject: 'Email Subject',
  htmlContent: '<html>...</html>',
  emailType: 'invoice', // Required: categorize the email
  patientId: 'patient-uuid', // Link to patient if applicable
  invoiceId: 'invoice-uuid' // Link to invoice if applicable
});
```

## Migration Steps

### 1. Update Imports
Replace all direct edge function imports with the communication service:

```typescript
// OLD
import { supabase } from '@/lib/supabase';

// NEW
import { communicationService } from '@/services/communicationService';
```

### 2. Update SMS Sending Code

#### Appointment Reminders
```typescript
// OLD
await supabase.functions.invoke('send-appointment-reminders', {
  body: { appointmentId, message }
});

// NEW
import { sendAppointmentReminderSMS } from '@/services/communicationExamples';

await sendAppointmentReminderSMS(
  practiceId,
  patientPhone,
  patientName,
  appointmentDate,
  appointmentTime,
  doctorName,
  patientId,
  appointmentId
);
```

#### Custom SMS
```typescript
// OLD
await sendSMS(phone, message);

// NEW
await communicationService.sendSMS({
  practiceId,
  recipientPhone: phone,
  messageContent: message,
  messageType: 'custom',
  patientId // Always link to patient when possible
});
```

### 3. Update Email Sending Code

#### Invoice Emails
```typescript
// OLD
await supabase.functions.invoke('send-individual-email', {
  body: { to: email, subject, html }
});

// NEW
import { sendInvoiceEmail } from '@/services/communicationExamples';

await sendInvoiceEmail(
  practiceId,
  patientEmail,
  patientName,
  invoiceNumber,
  invoiceAmount,
  invoicePDFBase64,
  patientId,
  invoiceId
);
```

#### Custom Emails
```typescript
// OLD
await emailService.sendEmail(to, subject, html);

// NEW
await communicationService.sendEmail({
  practiceId,
  recipientEmail: to,
  subject,
  htmlContent: html,
  emailType: 'custom',
  patientId // Always link to patient when possible
});
```

## Message Types

### SMS Message Types (Required)
- `appointment_reminder` - Appointment reminders
- `follow_up` - Post-visit follow-ups
- `marketing` - Marketing messages
- `system` - System notifications
- `custom` - Other messages

### Email Types (Required)
- `appointment_confirmation` - Appointment confirmations
- `invoice` - Invoice/billing emails
- `report` - Lab/medical reports
- `marketing` - Marketing campaigns
- `system` - System notifications
- `custom` - Other emails

## Error Handling

Always handle errors and check subscription limits:

```typescript
const result = await communicationService.sendSMS({...});

if (!result.success) {
  // Handle error
  console.error('SMS failed:', result.error);
  
  if (result.error?.includes('limit exceeded')) {
    // Handle subscription limit exceeded
    toast.error('SMS limit reached. Please upgrade your subscription.');
  }
}
```

## Checking Subscription Status

Before bulk operations, check subscription status:

```typescript
const subscriptions = await communicationService.checkSubscriptionStatus(practiceId);

if (!subscriptions.sms.active) {
  toast.error('No active SMS subscription');
  return;
}

console.log(`SMS remaining: ${subscriptions.sms.remaining}`);
console.log(`Email remaining: ${subscriptions.email.remaining}`);
```

## Viewing Communication Logs

### Get SMS Logs
```typescript
const { data: smsLogs, error } = await communicationService.getSMSLogs(practiceId, {
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  status: 'sent',
  messageType: 'appointment_reminder',
  limit: 100
});
```

### Get Email Logs  
```typescript
const { data: emailLogs, error } = await communicationService.getEmailLogs(practiceId, {
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  status: 'delivered',
  emailType: 'invoice',
  patientId: 'patient-uuid'
});
```

### Get Usage Statistics
```typescript
// SMS stats for the last month
const smsStats = await communicationService.getSMSStats(practiceId, 'month');
console.log('Total SMS sent:', smsStats.total);
console.log('SMS cost:', smsStats.totalCost);

// Email stats for the last month  
const emailStats = await communicationService.getEmailStats(practiceId, 'month');
console.log('Email open rate:', (emailStats.opened / emailStats.sent * 100).toFixed(2) + '%');
```

## Components to Update

The following components need to be updated to use the centralized gateway:

1. **EnhancedSmsModal** - `/src/components/messages/EnhancedSmsModal.tsx`
2. **EnhancedEmailModal** - `/src/components/messages/EnhancedEmailModal.tsx`
3. **PremiumInvoiceModal** - `/src/components/modals/PremiumInvoiceModal.tsx`
4. **VisitActionModal** - `/src/components/modals/VisitActionModal.tsx`
5. **AppointmentActionModal** - `/src/components/modals/AppointmentActionModal.tsx`
6. **CommunicationHub** - `/src/components/messages/CommunicationHub.tsx`
7. **ReminderSettings** - `/src/components/settings/ReminderSettings.tsx`

## Testing

After migration, test the following:

1. **SMS Delivery**: Send test SMS and verify in `practice_sms_logs`
2. **Email Delivery**: Send test email and verify in `practice_email_logs`  
3. **Subscription Limits**: Test limit enforcement
4. **Error Handling**: Test with invalid data
5. **Logging**: Verify all fields are logged correctly
6. **Usage Tracking**: Verify subscription usage is updated

## Security Considerations

1. **Never log sensitive data** like passwords or medical details
2. **Always validate phone numbers** before sending SMS
3. **Always validate email addresses** before sending emails
4. **Use proper message types** for audit trail
5. **Link to patient records** whenever possible

## Support

For questions about the migration:
1. Check the communication service code: `/src/services/communicationService.ts`
2. See examples: `/src/services/communicationExamples.ts`
3. Review CLAUDE.md for architectural guidelines

Remember: ALL SMS and Email MUST go through the centralized gateways - no exceptions!