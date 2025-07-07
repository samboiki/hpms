# HPMS Smart Notification Triggers System

## Overview

The HPMS Smart Notification Triggers System provides comprehensive automated notifications for healthcare workflow events. Built around the visit-centric workflow, it ensures critical medical events are communicated promptly through appropriate channels with intelligent routing and follow-up sequences.

## Architecture

### Core Components

1. **Database Triggers** - Automatically detect data changes and queue notifications
2. **Notification Queue** - Process notifications asynchronously with priority handling
3. **Centralized Communication** - Route through SMS/Email gateways with full logging
4. **Smart Routing** - Intelligent channel selection based on priority and user role
5. **Follow-up Sequences** - Automated escalation and reminder workflows

### Database Schema

```sql
-- Core notification infrastructure
notification_triggers         -- Trigger configurations
notification_queue           -- Queued notifications for processing
smart_notification_deliveries -- Delivery tracking and status
notification_follow_up_sequences -- Scheduled follow-up actions
```

## Trigger Categories

### 1. Visit/Appointment Workflow Notifications

#### Visit Scheduled
**When**: `visits.is_scheduled` changes from `false` to `true`
**Priority**: Medium
**Recipients**: Patient (SMS + Email), Doctor (In-app)
**Template**: Appointment confirmation with date, time, doctor name
**Follow-up**: 24h reminder, 2h reminder

#### Visit Confirmed
**When**: `visits.is_confirmed` changes from `false` to `true`
**Priority**: Low
**Recipients**: Receptionist + Doctor (In-app)
**Template**: Patient confirmation notification

#### Patient No-Show
**When**: `visits.scheduled_date < CURRENT_DATE` AND `is_checked_in = false` AND `is_cancelled = false`
**Priority**: High
**Recipients**: Patient (SMS), Receptionist (Task)
**Follow-up**: 24h reschedule reminder, 72h welfare check

#### Patient Ready for Doctor
**When**: `visits.is_ready` changes from `false` to `true`
**Priority**: High
**Recipients**: Doctor (In-app + Push)
**Template**: Patient ready notification with room info

#### Visit Completed - Follow-up Required
**When**: `visits.status = 'completed'` AND `follow_up_required = true`
**Priority**: Medium
**Recipients**: Receptionist (Task)
**Follow-up**: 1 week patient reminder if not scheduled

### 2. Lab and Imaging Result Notifications

#### Critical Lab Results
**When**: `lab_requests.status = 'completed'` AND `priority = 'urgent'`
**Priority**: Critical
**Recipients**: Requesting Doctor (SMS + Email + In-app), Nurse (In-app)
**Template**: Critical lab results alert with patient details
**Follow-up**: 1h escalation if not acknowledged

#### Imaging Results Available
**When**: `imaging_requests.status = 'completed'` AND `report_text IS NOT NULL`
**Priority**: Medium
**Recipients**: Requesting Doctor (In-app + Email)
**Follow-up**: 48h review reminder

#### Lab Request Overdue
**When**: `lab_requests.expected_results_date < CURRENT_DATE` AND `status != 'completed'`
**Priority**: High
**Recipients**: Nurse (In-app + Task)
**Template**: Overdue lab results with facility info

### 3. Billing and Invoice Notifications

#### Invoice Generated
**When**: `invoices_enhanced` INSERT
**Priority**: Medium
**Recipients**: Patient (Email + SMS)
**Template**: Invoice notification with amount and due date

#### Payment Overdue
**When**: `invoices_enhanced.due_date < CURRENT_DATE` AND `payment_status != 'paid'`
**Priority**: High
**Recipients**: Patient (SMS + Email), Admin (Task)
**Follow-up**: 1 week final notice, 2 weeks debt collection

#### Medical Aid Claim Rejected
**When**: `invoices_enhanced.medical_aid_status = 'rejected'`
**Priority**: High
**Recipients**: Admin (In-app + Task), Patient (Email)
**Template**: Rejection notice with reason

### 4. Staff Scheduling and HR Notifications

#### Timesheet Not Submitted
**When**: `timesheets.period_end_date < CURRENT_DATE` AND `status = 'draft'`
**Priority**: Medium
**Recipients**: Employee (Email + In-app)
**Follow-up**: 24h urgent reminder

#### Leave Request Pending
**When**: `leave_requests.status = 'pending'` for 24h
**Priority**: Medium
**Recipients**: Manager/Admin (Email + In-app)
**Follow-up**: 48h escalation

#### Payroll Processing Due
**When**: System date = payroll_date - 3 days
**Priority**: High
**Recipients**: HR/Admin (Email + Task)
**Template**: Payroll processing reminder

### 5. Compliance and Audit Notifications

#### Audit Log Anomaly
**When**: Multiple failed login attempts detected
**Priority**: Critical
**Recipients**: Admin (Email + SMS + Task)
**Template**: Security alert with details

#### Patient Data Access Tracking
**When**: Patient record viewed
**Priority**: Low
**Action**: Log event for HIPAA compliance
**Retention**: 7 years

#### Backup Failure
**When**: System backup fails
**Priority**: Critical
**Recipients**: Admin (SMS + Email + Task)
**Template**: Backup failure alert

### 6. Emergency and Urgent Care Notifications

#### Critical Patient Vitals
**When**: `vitals.systolic_bp > 180` OR `diastolic_bp > 120` OR `heart_rate > 120` OR `oxygen_saturation < 90`
**Priority**: Critical
**Recipients**: Doctor + Nurse (SMS + In-app + Push)
**Follow-up**: 15min escalation if not acknowledged

#### Medication Allergy Alert
**When**: Prescribed medication conflicts with known allergies
**Priority**: Critical
**Recipients**: Doctor (In-app + Push + Task)
**Template**: Allergy conflict warning

#### After Hours Emergency
**When**: `visit_type = 'emergency'` during after hours
**Priority**: Critical
**Recipients**: On-call Doctor (SMS), Admin (Email)
**Template**: After hours emergency contact

## Smart Routing Logic

### Priority-Based Channel Selection

```typescript
// Critical Priority
- Doctor: In-app → Push → SMS (immediate)
- Nurse: In-app → SMS (immediate)
- Admin: SMS → Email (immediate)

// High Priority  
- Doctor: In-app → Email (within 15min)
- Nurse: In-app → Email (within 15min)
- Patient: SMS → Email (within 30min)

// Medium Priority
- All Users: In-app → Email (within 1h)
- Patient: SMS → Email (within 2h)

// Low Priority
- All Users: In-app → Email (within 4h)
```

### Time-Based Routing

**Business Hours (8AM - 6PM)**
- Prefer in-app and email notifications
- SMS for urgent/critical only

**After Hours (6PM - 8AM)**
- Prefer SMS and email
- Route to on-call staff for emergencies

**Weekends/Holidays**
- Emergency routing only
- Escalate to practice management

## Installation and Setup

### 1. Database Setup

```sql
-- Run the migration to create notification infrastructure
-- This creates tables, triggers, and functions
```

### 2. Install Default Triggers

```bash
# Call edge function to install default triggers
curl -X POST "https://your-project.supabase.co/functions/v1/smart-notification-processor?action=install_defaults" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### 3. Configure Practice Settings

```typescript
// Set practice-specific notification preferences
const practiceConfig = {
  businessHours: { start: '08:00', end: '18:00' },
  emergencyContacts: ['admin@practice.com'],
  smsCredits: 1000,
  emailQuota: 5000
};
```

### 4. Start Notification Processor

```bash
# Process notification queue (run every 5 minutes)
curl -X POST "https://your-project.supabase.co/functions/v1/smart-notification-processor?action=process" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Notification Templates

### SMS Templates

```
appointment_confirmation_sms:
"Hi {{patient_name}}, your appointment is confirmed for {{scheduled_date}} at {{scheduled_time}} with Dr. {{doctor_name}}. Reply CONFIRM to acknowledge."

critical_vitals_alert:
"CRITICAL VITALS ALERT: {{patient_name}} - BP: {{blood_pressure}}, HR: {{heart_rate}}, O2: {{oxygen_saturation}}%. Immediate attention required."

payment_overdue_sms:
"Payment reminder: Invoice #{{invoice_number}} for R{{total}} was due on {{due_date}}. Please settle to avoid service interruption."
```

### Email Templates

```
appointment_confirmation_email:
Subject: "Appointment Confirmed - {{practice_name}}"
Content: Detailed appointment information with practice address and contact details

invoice_email_with_attachment:
Subject: "Invoice #{{invoice_number}} - {{practice_name}}"
Content: Professional invoice email with PDF attachment

critical_lab_results_email:
Subject: "URGENT: Critical Lab Results - {{patient_name}}"
Content: Secure notification to review results in system
```

## Monitoring and Analytics

### Key Metrics

1. **Delivery Success Rate** - % of notifications successfully delivered
2. **Response Time** - Time from trigger to delivery
3. **Escalation Rate** - % of notifications requiring escalation
4. **Channel Effectiveness** - Success rates by channel (SMS/Email/In-app)
5. **Practice Engagement** - User interaction with notifications

### Dashboard Features

- Real-time notification queue status
- Delivery tracking and error monitoring
- Trigger configuration management
- Performance analytics and reporting
- Practice-specific usage statistics

## Security and Compliance

### Data Protection

- All sensitive data encrypted in transit and at rest
- Patient information never exposed in notification logs
- Secure template interpolation prevents data leakage
- Practice-level data isolation with RLS policies

### HIPAA Compliance

- Complete audit trail for all communications
- Secure delivery confirmation tracking
- Patient consent management for SMS/Email
- Data retention policies for compliance

### Access Control

- Role-based notification routing
- Practice-specific trigger configurations
- Administrative controls for system management
- Emergency override capabilities

## Configuration Examples

### Custom Trigger Configuration

```typescript
const customTrigger = {
  trigger_name: 'medication_refill_due',
  table_name: 'medications',
  event_type: 'UPDATE',
  priority: 'medium',
  category: 'medication',
  conditions: {
    and: [
      { field: 'refill_due_date', operator: 'equals', value: 'CURRENT_DATE + INTERVAL \'3 days\'' },
      { field: 'auto_refill', operator: 'equals', value: true }
    ]
  },
  actions: [
    {
      type: 'send_notification',
      channel: 'sms',
      recipients: [{ type: 'patient', identifier: 'patient_id' }],
      template: 'medication_refill_reminder'
    }
  ],
  enabled: true
};
```

### Practice-Specific Settings

```typescript
const practiceSettings = {
  practice_id: 'practice-uuid',
  notification_preferences: {
    appointment_reminders: {
      enabled: true,
      advance_hours: [24, 2],
      channels: ['sms', 'email']
    },
    lab_results: {
      critical_immediate: true,
      routine_batch: true,
      channels: ['in_app', 'email']
    },
    billing_notifications: {
      invoice_delivery: 'email',
      overdue_reminders: ['sms', 'email'],
      escalation_days: [7, 14, 30]
    }
  }
};
```

## Troubleshooting

### Common Issues

1. **Notifications Not Triggering**
   - Check trigger enabled status
   - Verify database triggers are installed
   - Confirm practice_id is set correctly

2. **Delivery Failures**
   - Check SMS/Email gateway credentials
   - Verify recipient contact information
   - Review error logs in delivery tracking

3. **Performance Issues**
   - Monitor notification queue size
   - Check database trigger performance
   - Optimize trigger conditions

### Debugging Commands

```sql
-- Check pending notifications
SELECT * FROM notification_queue WHERE status = 'pending';

-- Review failed deliveries
SELECT * FROM smart_notification_deliveries WHERE status = 'failed';

-- Monitor trigger activity
SELECT trigger_name, COUNT(*) as trigger_count 
FROM notification_queue 
GROUP BY trigger_name 
ORDER BY trigger_count DESC;
```

## Best Practices

### Performance Optimization

1. **Efficient Trigger Conditions** - Use indexed fields in conditions
2. **Batch Processing** - Process notifications in batches
3. **Queue Management** - Regular cleanup of old notifications
4. **Rate Limiting** - Respect SMS/Email provider limits

### Notification Design

1. **Clear Templates** - Use patient-friendly language
2. **Actionable Content** - Include next steps for recipients
3. **Proper Timing** - Respect business hours and time zones
4. **Channel Selection** - Match urgency to appropriate channel

### Maintenance

1. **Regular Monitoring** - Daily review of notification metrics
2. **Template Updates** - Keep content current and relevant
3. **Trigger Optimization** - Refine conditions based on usage
4. **Compliance Reviews** - Regular audit of notification practices

## Support and Maintenance

### Automated Cleanup

```sql
-- Daily cleanup job
SELECT cleanup_old_notifications();
```

### Health Monitoring

```sql
-- Check system health
SELECT 
  'pending' as status, COUNT(*) as count 
FROM notification_queue WHERE status = 'pending'
UNION ALL
SELECT 
  'failed' as status, COUNT(*) as count 
FROM notification_queue WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours';
```

### Escalation Procedures

1. **Critical Failures** - Immediate admin notification
2. **Queue Backup** - Automatic retry with exponential backoff
3. **Provider Outages** - Fallback to alternative channels
4. **Emergency Override** - Manual notification dispatch capability

The Smart Notification Triggers System provides comprehensive healthcare workflow automation while maintaining security, compliance, and optimal user experience. Regular monitoring and maintenance ensure reliable operation for critical medical communications.