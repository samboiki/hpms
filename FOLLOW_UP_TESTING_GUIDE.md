# Follow-up Automation Testing Guide

## Pre-Test Setup

### 1. Enable Follow-up Automation
1. Navigate to **Encounters** → **Follow-up Automations** tab
2. Toggle **"Backend Automation Engine"** to ON
3. Ensure you have at least one active template for tariff code "8104"

### 2. Check Active Templates
```sql
-- Run this query to see active templates
SELECT template_name, trigger_value, is_active 
FROM follow_up_templates 
WHERE is_active = true;
```

## Testing Process

### Step 1: Create a Patient Visit with Tariff 8104
1. Go to **Patients** section
2. Select any patient
3. Click **"New Visit"** or **"Schedule Appointment"**
4. During the visit:
   - Add chief complaint
   - Add service with tariff code **8104** (Tooth Extraction)
   - Complete any other required fields
5. **Complete and finalize** the visit
6. Ensure the invoice shows the 8104 service

### Step 2: Trigger the Automation
The follow-up automation runs in two ways:
1. **Automatic**: Backend job processes completed visits every hour
2. **Manual**: You can trigger it immediately via SQL

To manually trigger for testing:
```sql
-- Check if your visit was completed
SELECT id, patient_id, status, visit_date 
FROM visits 
WHERE status = 'completed' 
ORDER BY created_at DESC 
LIMIT 5;
```

### Step 3: Verify Follow-up Was Created
After the automation runs, check for the created follow-up:

```sql
-- Find follow-ups created from your test visit
SELECT 
    v.id,
    v.patient_id,
    v.scheduled_date,
    v.scheduled_time,
    v.visit_type,
    v.visit_subtype,
    v.status,
    v.notes,
    v.preceding_visit_id,
    v.applied_template_id,
    v.care_plan_step,
    v.is_scheduled
FROM visits v
WHERE v.preceding_visit_id IS NOT NULL
AND v.created_at > NOW() - INTERVAL '1 hour'
ORDER BY v.created_at DESC;
```

## Expected Results

When a visit with tariff 8104 is completed, you should see:

### New Visit Record Created:
- **status**: 'scheduled'
- **visit_type**: 'follow-up'
- **visit_subtype**: 'Follow-up' (or specific type from template)
- **scheduled_date**: 7 days from completion date
- **scheduled_time**: '09:00:00' (or next available slot)
- **is_scheduled**: true
- **preceding_visit_id**: ID of the original visit
- **applied_template_id**: 'd1233035-76d2-491b-8d53-b7bf786217f9'
- **care_plan_step**: 1
- **notes**: "Post-extraction follow-up for 8104. Check healing progress, assess for dry socket, remove sutures if needed."

### Invoice Service Created:
A service with tariff code "8101" should be automatically added to the follow-up visit invoice.

## Manual Testing Without Waiting

To test immediately without waiting for the cron job:

1. **Option 1**: Call the edge function directly
```bash
curl -X POST https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/follow-up-automation-engine \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

2. **Option 2**: Check what the automation would do
```sql
-- See completed visits that would trigger follow-ups
SELECT 
    v.id as visit_id,
    v.patient_id,
    v.status,
    ie.id as invoice_id,
    array_agg(ins.tariff_code) as tariff_codes
FROM visits v
JOIN invoices_enhanced ie ON ie.visit_id = v.id
JOIN invoice_services ins ON ins.invoice_id = ie.id
WHERE v.status = 'completed'
AND v.created_at > NOW() - INTERVAL '24 hours'
AND ins.tariff_code = '8104'
GROUP BY v.id, v.patient_id, v.status, ie.id;
```

## Troubleshooting

### Follow-up Not Created?
1. Check if automation is enabled for your practice
2. Verify the template is active
3. Ensure the visit status is 'completed'
4. Check if a follow-up already exists (prevents duplicates)
5. Verify loop count hasn't exceeded 3

### Check Automation Logs
```sql
-- Check recent automation activity
SELECT * FROM audit_logs 
WHERE table_name = 'follow_up_automation' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Testing Multi-Step Plans

If your template has multiple steps:
1. Complete the first follow-up visit
2. The automation should create the second step
3. Each subsequent completion triggers the next step
4. The chain continues until all steps are complete

## Testing Loop Prevention

To test loop prevention:
1. Create a visit with 8104
2. Complete the follow-up (which might also have 8104)
3. Repeat 3 times
4. The 4th attempt should be blocked (loop count = 3)