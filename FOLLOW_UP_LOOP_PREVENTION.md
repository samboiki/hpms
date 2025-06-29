# Follow-up Automation Loop Prevention & Scheduling

## Overview
The follow-up automation system includes sophisticated loop prevention and proper appointment scheduling to ensure safe and efficient operation.

## Loop Prevention Mechanisms

### 1. Maximum Loop Count
- Each follow-up chain is limited to **3 iterations** maximum
- Tracked via `follow_up_loop_count` column in visits table
- Prevents infinite loops when same tariff codes trigger follow-ups repeatedly

### 2. Existing Follow-up Detection
- System checks if a follow-up already exists before creating new ones
- Prevents duplicate follow-ups for the same visit
- Query: `preceding_visit_id = current_visit AND status = 'scheduled'`

### 3. Template-Specific Tracking
- `applied_template_id` tracks which template triggered the follow-up
- `care_plan_step` tracks progress through multi-step plans
- Ensures proper continuation of care plans without duplication

## Scheduling Improvements

### 1. Required Visit Fields
The automation now properly sets all required fields:
- `patient_id` - From original visit
- `practice_id` - From original visit (security critical)
- `branch_id` - From original visit
- `doctor_id` - From original visit
- `visit_type` - General category (consultation, follow-up, procedure, etc.)
- `visit_sub_type` - Specific type (e.g., "Periodontal Maintenance")
- `scheduled_date` - Calculated based on template interval
- `scheduled_time` - Found via availability check or default
- `scheduled_duration` - Default 30 minutes
- `status` - Always 'scheduled' for new appointments
- `is_scheduled` - Always true for automated follow-ups

### 2. Visit Type Mapping
Specific visit types are mapped to general categories:
```typescript
'Periodontal Maintenance' → 'follow-up'
'Root Canal Follow-up' → 'follow-up'
'Post-Extraction Check' → 'follow-up'
'Routine Cleaning' → 'routine-checkup'
'Initial Consultation' → 'consultation'
'Emergency Visit' → 'emergency'
'Surgical Procedure' → 'procedure'
```

### 3. Doctor Availability Checking
- System attempts to find available time slots
- Uses `find_next_available_slot` function (when available)
- Defaults to 9:00 AM if no availability check possible
- Respects existing appointments to prevent double-booking

## Example Scenarios

### Scenario 1: Simple Follow-up
1. Patient has extraction (tariff 8104)
2. System creates 1-week follow-up
3. Follow-up completed with same tariff 8104
4. System detects loop count = 1, allows creation
5. Second follow-up completed with 8104
6. System detects loop count = 2, allows creation
7. Third follow-up completed with 8104
8. System detects loop count = 3, PREVENTS creation

### Scenario 2: Multi-step Care Plan
1. Patient diagnosed with "Chronic Periodontitis"
2. System creates step 1: 3-month maintenance
3. After completion, creates step 2: 6-month review
4. Each step maintains same `applied_template_id`
5. Loop count doesn't increase for planned steps

### Scenario 3: Duplicate Prevention
1. Patient has consultation with diagnosis
2. System creates follow-up
3. Manual follow-up also scheduled
4. System detects existing follow-up, skips creation

## Database Schema Changes

```sql
-- Loop prevention fields
follow_up_loop_count INTEGER DEFAULT 0 CHECK (follow_up_loop_count <= 3)
visit_sub_type TEXT -- Stores specific visit type
scheduled_duration INTEGER DEFAULT 30 -- Duration in minutes

-- Indexes for performance
CREATE INDEX idx_visits_preceding_template 
ON visits(preceding_visit_id, applied_template_id);
```

## Edge Function Updates

The `follow-up-automation-engine` now includes:
1. Loop count checking before creating follow-ups
2. Existing follow-up detection
3. Proper visit type mapping
4. Doctor availability checking
5. All required fields populated

## Testing Checklist

- [ ] Create template with common tariff code
- [ ] Complete visit with that code 4 times
- [ ] Verify only 3 follow-ups created
- [ ] Check all visit fields populated correctly
- [ ] Verify visit_sub_type stores specific type
- [ ] Confirm no scheduling conflicts
- [ ] Test multi-step plans work correctly
- [ ] Verify duplicate prevention works