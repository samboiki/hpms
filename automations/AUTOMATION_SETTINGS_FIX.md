# Automation Settings Fix Documentation

## Problem
The Communications page was saving automation settings in a single JSON column format that wasn't compatible with the n8n workflow expectations. The n8n workflow expects individual rows in `practice_automation_settings` with specific `automation_id` values.

## Solution Implemented

### 1. Created Save Function
**File**: `/src/utils/saveAutomationSettings.ts`
- Maps Communications page keys to proper automation IDs
- Saves individual rows per automation type
- Handles SMS/Email channel configuration properly
- Extracts email subject from templates

### 2. Created Migration Function
**File**: `/src/utils/migrateAutomationSettings.ts`
- Converts old JSON format to new row-based format
- Runs automatically when Communications page loads
- Preserves existing settings

### 3. Updated Communications Page
**File**: `/src/pages/Communications.tsx`
- Uses new save function when updating settings
- Runs migration on page load
- Shows success/error toasts

## Automation ID Mapping

| Communications Page Key | Automation ID in Database |
|------------------------|---------------------------|
| welcomeNewPatients | welcome-new-patient |
| appointmentReminders | appointment-reminder |
| birthdayMessages | birthday-wishes |
| followUpCare | post-visit-follow-up |
| paymentReminders | payment-reminder |
| invoiceDelivery | invoice-sent |
| thankYouMessages | visit-thank-you |
| healthScreenings | health-screening-reminder |

## Database Structure

Each automation setting is now saved as:
```sql
practice_automation_settings (
  practice_id,
  automation_id,     -- e.g., 'welcome-new-patient'
  enabled,           -- boolean
  sms_enabled,       -- boolean
  email_enabled,     -- boolean
  sms_template,      -- text template
  email_subject,     -- email subject line
  email_body,        -- email HTML body
  timing_settings    -- JSONB with timing configuration
)
```

## Testing

1. **Create test patient**:
```sql
INSERT INTO patients (
  practice_id,
  first_name,
  last_name,
  id_number,
  email,
  cell_number,
  date_of_birth,
  gender
) VALUES (
  'ffed1160-00ec-4c4f-8810-913a24348d90',
  'Test',
  'Patient',
  '123456TEST',
  'test@example.com',
  '+27123456789',
  '1990-01-01',
  'male'
);
```

2. **Check automation queue**:
```sql
SELECT * FROM automation_queue 
WHERE practice_id = 'ffed1160-00ec-4c4f-8810-913a24348d90'
ORDER BY created_at DESC;
```

3. **Test n8n function**:
```sql
SELECT * FROM get_all_pending_automations(10, 3);
```

## n8n Workflow Integration

The n8n workflow will now:
1. Fetch pending automations with templates
2. Process SMS and Email based on enabled flags
3. Use the templates from `practice_automation_settings`
4. Update queue status after processing

## Important Notes

- Always enable automations in Communications > Settings tab
- Templates support variables like {{patientName}}, {{practiceName}}, etc.
- Test mode sends only to staff members
- Check `practice_sms_logs` and `practice_email_logs` for delivery status