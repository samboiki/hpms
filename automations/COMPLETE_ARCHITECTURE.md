# Complete HPMS Automation Architecture

## System Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   HPMS Events   │────▶│ Automation Queue │────▶│   n8n Engine    │
│ (Patient Create)│     │  (Master Table)  │     │ (Runs 1/minute) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                           │
                                ┌──────────────────────────┴───────────────────────┐
                                │                                                  │
                        ┌───────▼────────┐                              ┌──────────▼─────────┐
                        │ Gmail Gateway  │                              │   SMS Gateway      │
                        │ (Practice Email)│                              │ (Central Portal)   │
                        └────────────────┘                              └────────────────────┘
```

## Database Tables

### 1. **automation_queue** (Master Queue)
- Stores ALL automations to be executed
- Status: pending → processing → completed/failed
- Tracks attempts, errors, processing time

### 2. **automation_executions** (History)
- Complete audit trail of all executed automations
- Links to SMS/Email logs
- Performance metrics

### 3. **automation_definitions** (Templates)
- 25 pre-defined automation types
- Default templates and timings
- Trigger events mapping

### 4. **practice_automation_settings** (Customization)
- Per-practice enable/disable
- Custom templates
- Gmail OAuth tokens
- Channel preferences

### 5. **practice_oauth_credentials** (Secure OAuth)
- Stores Gmail refresh tokens
- Multi-provider support
- Token refresh tracking

## Execution Flow

### 1. Event Triggers
```sql
Patient Created → trigger_queue_welcome_patient() → Insert into automation_queue
Appointment Created → trigger_queue_appointment_confirmation() → Insert into automation_queue
Invoice Overdue → trigger_queue_payment_reminder() → Insert into automation_queue
```

### 2. n8n Processing (Every Minute)
```
1. Call get_pending_automations_by_type('welcome-new-patient')
2. Batch process up to 100 records
3. For each automation:
   - Replace template variables
   - Send SMS via centralized gateway
   - Send Email via Gmail OAuth or centralized gateway
   - Update queue status
   - Log execution details
```

### 3. Delivery Tracking
- SMS → practice_sms_logs (with delivery status)
- Email → practice_email_logs (with open/click tracking)
- Both respect subscription limits

## Gmail Integration Options

### Option 1: Database Storage (Recommended)
**Pros:**
- Centralized management
- Easy to scale
- Single OAuth flow per practice
- Automatic token refresh

**Implementation:**
1. Add Gmail settings in Practice Settings → Social tab
2. OAuth flow stores tokens in `practice_oauth_credentials`
3. n8n uses stored tokens to send emails
4. Edge function handles token refresh

### Option 2: n8n Credentials
**Pros:**
- Built-in OAuth handling
- No custom OAuth implementation

**Cons:**
- Manual setup per practice
- Hard to manage at scale
- No programmatic access

## Recommended Implementation Path

### Phase 1: Core Infrastructure ✅
- [x] automation_queue table
- [x] automation_definitions with 25 types
- [x] practice_automation_settings
- [x] Welcome patient trigger
- [x] n8n workflow template

### Phase 2: Gmail Integration
- [ ] OAuth setup UI in Settings → Social
- [ ] Edge function for OAuth callback
- [ ] Token refresh mechanism
- [ ] Update n8n to use stored tokens

### Phase 3: Complete Automations
- [ ] Appointment reminders (highest value)
- [ ] Payment reminders (revenue impact)
- [ ] Lab results notifications
- [ ] Birthday wishes (easy win)

### Phase 4: Advanced Features
- [ ] A/B testing templates
- [ ] Delivery time optimization
- [ ] Engagement analytics
- [ ] Template library

## Cost Analysis

**Traditional Approach:**
- 100 practices × 25 automations × 1440 checks/day = 3.6M executions/month

**Our Approach:**
- 25 automation types × 1440 checks/day = 36K executions/month
- 99% cost reduction!

## Security Considerations

1. **OAuth Tokens:** Encrypted at rest, refresh tokens never exposed
2. **RLS Policies:** Practices can only see their own data
3. **Audit Trail:** Complete history of all automations
4. **Rate Limiting:** Respect SMS/Email quotas

## Monitoring & Maintenance

```sql
-- Daily health check
SELECT 
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    AVG(processing_time_ms) as avg_time_ms
FROM automation_queue
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Reset stuck automations
SELECT reset_stuck_automations();

-- Practice automation performance
SELECT * FROM get_practice_automation_stats('practice-id', 30);
```