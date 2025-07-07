# Internal Messaging and Notifications System Schema

## Overview
This document describes the comprehensive internal messaging and notification system for HPMS, including real-time chat, notifications, and engagement tracking.

## Database Tables

### 1. System Notifications (`system_notifications`)
Central table for all in-app notifications with comprehensive tracking.

**Key Features:**
- Multiple notification types (lab results, appointments, messages, tasks, etc.)
- Priority levels (low, medium, high, urgent, critical)
- Status tracking (pending, delivered, read, dismissed, expired, failed)
- Related entity linking (patient_id, visit_id, invoice_id, etc.)
- Expiration dates for time-sensitive notifications
- Action URLs for direct navigation
- Read/click tracking with timestamps

**Indexes:**
- User-based queries
- Unread notification filtering
- Type and priority filtering
- Related entity lookups

### 2. Internal Message Channels (`internal_message_channels`)
Manages different types of communication channels.

**Channel Types:**
- `direct` - 1-on-1 messaging between users
- `group` - Group conversations
- `department` - Department-wide channels
- `practice` - Practice-wide announcements
- `broadcast` - Admin broadcast channels
- `patient_care` - Patient-specific care team channels

**Features:**
- Archive functionality
- Mute settings
- Reply permissions
- Patient association for care coordination

### 3. Channel Members (`internal_channel_members`)
Tracks channel membership and permissions.

**Features:**
- Admin roles within channels
- Post permissions
- Notification preferences per channel
- Sidebar visibility settings
- Join/leave tracking
- Last read timestamps

### 4. Message Threads (`internal_message_threads`)
Supports threaded conversations within channels.

**Features:**
- Main thread and reply threads
- Thread locking
- Message and participant counts
- Last activity tracking

### 5. Internal Messages (`internal_messages`)
Core messaging table with rich features.

**Features:**
- Multiple content types (text, HTML, markdown)
- Edit/delete functionality
- Pin important messages
- Announcement support
- Importance scoring (0-100)
- Soft delete with timestamps

### 6. Message Attachments (`internal_message_attachments`)
File sharing within messages.

**Features:**
- File metadata storage
- Thumbnail support
- Upload tracking

### 7. Message Reactions (`internal_message_reactions`)
Emoji reactions to messages.

**Features:**
- Any emoji support
- User tracking
- Unique constraint per user/message/emoji

### 8. Read Receipts (`internal_message_read_receipts`)
Tracks message read status.

**Features:**
- Per-message read tracking
- Timestamp recording
- User-specific receipts

### 9. Typing Indicators (`typing_indicators`)
Real-time typing status.

**Features:**
- Channel and thread specific
- Auto-expiration (10 seconds)
- Automatic cleanup

### 10. Notification Deliveries (`notification_deliveries`)
Multi-channel delivery tracking.

**Channels Tracked:**
- In-app delivery
- Email delivery
- SMS delivery
- Push notifications

**Features:**
- Delivery timestamps
- Failure reason tracking
- Email open/click tracking
- Push notification engagement

### 11. User Notification Preferences (`user_notification_preferences`)
Granular notification control.

**Features:**
- Global on/off switches
- Channel-specific preferences
- Quiet hours with timezone support
- Type-specific preferences (stored as JSONB)
- Message notification settings

**Example Type Preferences:**
```json
{
    "lab_results": {"in_app": true, "email": true, "sms": false},
    "appointment_reminder": {"in_app": true, "email": true, "sms": true},
    "new_message": {"in_app": true, "email": false, "sms": false}
}
```

### 12. Internal Notification Templates (`internal_notification_templates`)
Reusable notification templates.

**Features:**
- Title and message templates
- Email subject/body templates
- SMS templates
- Variable substitution support
- Active/inactive status

### 13. Message Engagement Metrics (`message_engagement_metrics`)
Daily engagement tracking per user/channel.

**Metrics Tracked:**
- Messages sent/read
- Reactions given/received
- Files shared
- Response times (avg/min/max)
- Active time
- Last activity

## Key Functions

### Notification Management
- `mark_notification_read(notification_id)` - Mark notification as read
- `get_unread_notification_count(user_id)` - Get unread count

### Messaging Functions
- `send_typing_indicator(channel_id, thread_id)` - Send typing status
- `create_direct_message_channel(user1_id, user2_id, practice_id)` - Create/get direct channel
- `cleanup_expired_typing_indicators()` - Remove expired indicators

### Automatic Triggers
- New message notifications
- Thread statistics updates
- Updated timestamp maintenance
- Typing indicator cleanup

## Security Features

### Row Level Security (RLS)
All tables have RLS enabled with appropriate policies:
- Users can only see their own notifications
- Channel access restricted to members
- Message visibility based on channel membership
- Preference access limited to owner

### Performance Optimizations
- Comprehensive indexing strategy
- Optimized for common query patterns
- Efficient unread/active filters
- Date-based partitioning ready

## Integration Points

### With Existing HPMS Systems
- Links to patients, visits, invoices
- User authentication integration
- Practice multi-tenancy support
- Audit trail compatibility

### With Communication Gateways
- Integrates with centralized SMS gateway
- Integrates with centralized email gateway
- Delivery tracking for all channels
- Unified notification system

## Usage Examples

### Creating a Notification
```sql
INSERT INTO system_notifications (
    user_id,
    notification_type,
    priority,
    title,
    message,
    patient_id,
    action_url
) VALUES (
    'user-uuid',
    'lab_results',
    'high',
    'Lab Results Ready',
    'Lab results for John Doe are now available',
    'patient-uuid',
    '/patients/patient-uuid/lab-results'
);
```

### Sending a Message
```sql
-- First create a thread if needed
INSERT INTO internal_message_threads (channel_id)
VALUES ('channel-uuid')
RETURNING id;

-- Then send the message
INSERT INTO internal_messages (
    thread_id,
    sender_id,
    content,
    content_type
) VALUES (
    'thread-uuid',
    'sender-uuid',
    'Hello team!',
    'text'
);
```

### Setting User Preferences
```sql
INSERT INTO user_notification_preferences (
    user_id,
    quiet_hours_enabled,
    quiet_hours_start,
    quiet_hours_end,
    type_preferences
) VALUES (
    'user-uuid',
    true,
    '22:00',
    '08:00',
    '{
        "lab_results": {"in_app": true, "email": true, "sms": false},
        "new_message": {"in_app": true, "email": false, "sms": false}
    }'::jsonb
);
```

## Best Practices

1. **Always use the helper functions** for common operations
2. **Check user preferences** before sending notifications
3. **Respect quiet hours** when sending non-urgent notifications
4. **Use appropriate priority levels** for notifications
5. **Include action URLs** for actionable notifications
6. **Set expiration dates** for time-sensitive notifications
7. **Track delivery status** for important communications
8. **Use templates** for consistent messaging
9. **Monitor engagement metrics** to improve communication
10. **Implement proper error handling** for failed deliveries