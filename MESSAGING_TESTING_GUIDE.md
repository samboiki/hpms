# Internal Messaging & Notifications Testing Guide

## Overview
This guide provides comprehensive test scenarios for validating the internal messaging and notifications system integration in HPMS.

## Pre-requisites
1. Ensure all migrations have been applied
2. Deploy the `smart-notification-processor` edge function
3. Have at least 2 test user accounts in different roles (doctor, admin)
4. Have test patient data available

## Test Scenarios

### 1. Notification Creation & Delivery

#### 1.1 Manual Notification Creation
**Steps:**
1. Navigate to Communications page → Messages tab
2. Access notification management interface
3. Create a new notification with:
   - Type: General announcement
   - Priority: Normal
   - Message: "System maintenance scheduled"
4. Verify notification appears in recipient's notification list
5. Check Dashboard tile shows notification count

**Expected Result:**
- Notification created successfully
- Real-time delivery to all practice users
- Dashboard tile updates immediately

#### 1.2 Automatic Trigger - Visit Status Change
**Steps:**
1. Create or update a visit record
2. Change status from "scheduled" to "completed"
3. Monitor notifications panel

**Expected Result:**
- Automatic notification generated for assigned doctor
- Notification contains patient name and visit details
- Notification marked as action_required

#### 1.3 Lab Results Upload Trigger
**Steps:**
1. Create a lab request for a patient
2. Update status to "completed"
3. Upload test results

**Expected Result:**
- Critical result notifications for abnormal values
- Normal priority for standard results
- Links to view full lab report

### 2. Internal Messaging

#### 2.1 Direct Message Channel Creation
**Steps:**
1. Open Messages tab
2. Click "New Message" 
3. Select a user to message
4. Send initial message

**Expected Result:**
- Direct channel created automatically
- Message delivered in real-time
- Channel appears in both users' channel lists

#### 2.2 Group Channel Creation
**Steps:**
1. Click "New Channel"
2. Select "Group" type
3. Add multiple participants
4. Name the channel (e.g., "Emergency Team")

**Expected Result:**
- Group channel created
- All participants see channel
- Can send messages visible to all

#### 2.3 Real-time Message Delivery
**Steps:**
1. Open existing channel
2. Have another user send message
3. Observe message appearance

**Expected Result:**
- Message appears instantly without refresh
- Typing indicator shows while other user types
- Read receipts update when message viewed

#### 2.4 Typing Indicators
**Steps:**
1. Open a direct message channel
2. Have other user start typing
3. Observe typing indicator

**Expected Result:**
- "User is typing..." appears
- Disappears after 3 seconds of inactivity
- Multiple users show as "User1, User2 typing..."

### 3. FloatingVisitTracker Integration

#### 3.1 Messages Tab
**Steps:**
1. Click FloatingVisitTracker button
2. Switch to Messages tab
3. Review notifications list

**Expected Result:**
- Tab shows unread count badge
- Notifications sorted by date
- Can mark as read from tracker

#### 3.2 Real-time Updates
**Steps:**
1. Keep FloatingVisitTracker open
2. Have another user send notification
3. Observe update

**Expected Result:**
- Badge count increases
- New notification appears at top
- No page refresh required

### 4. Dashboard Integration

#### 4.1 Notifications Panel
**Steps:**
1. View main dashboard
2. Check Notifications tile
3. Click to expand

**Expected Result:**
- Shows total unread count
- Recent notifications preview
- Click navigates to full list

#### 4.2 Quick Actions
**Steps:**
1. From dashboard notification
2. Click action button (if available)
3. Complete action

**Expected Result:**
- Action modal/page opens
- Can complete task
- Notification marked as actioned

### 5. Communication Gateway Testing

#### 5.1 SMS Notifications
**Steps:**
1. Enable SMS notifications in preferences
2. Trigger appointment reminder
3. Check SMS logs

**Expected Result:**
- SMS sent via centralized gateway
- Logged in practice_sms_logs
- Delivery status tracked

#### 5.2 Email Notifications
**Steps:**
1. Enable email notifications
2. Send invoice notification
3. Verify email delivery

**Expected Result:**
- Email sent via centralized gateway
- Logged in practice_email_logs
- HTML format preserved

### 6. Performance Testing

#### 6.1 Message History Loading
**Steps:**
1. Open channel with 100+ messages
2. Scroll to load history
3. Monitor performance

**Expected Result:**
- Pagination loads 50 messages at a time
- Smooth scrolling
- No UI freezing

#### 6.2 Multiple Active Channels
**Steps:**
1. Open 5+ channels
2. Receive messages in multiple channels
3. Switch between channels rapidly

**Expected Result:**
- All channels update in real-time
- Quick channel switching
- Messages persist correctly

### 7. Error Handling

#### 7.1 Network Disconnection
**Steps:**
1. Open messaging interface
2. Disconnect network
3. Try sending message
4. Reconnect network

**Expected Result:**
- Connection status shows "disconnected"
- Message queued locally
- Auto-retry on reconnection

#### 7.2 Permission Errors
**Steps:**
1. Try accessing another practice's channels
2. Attempt to delete others' messages

**Expected Result:**
- Access denied gracefully
- Error message displayed
- No data leakage

### 8. Smart Triggers Testing

#### 8.1 Custom Trigger Creation
**Steps:**
1. Navigate to Settings → Notification Triggers
2. Create custom trigger:
   - Event: Lab result critical
   - Condition: Value > threshold
   - Template: "Critical {{test_name}} result"
3. Test with matching event

**Expected Result:**
- Trigger saves successfully
- Activates on matching condition
- Template variables replaced

#### 8.2 Trigger Management
**Steps:**
1. View all triggers
2. Disable a trigger
3. Test disabled trigger

**Expected Result:**
- Can view/edit all practice triggers
- Disabled triggers don't fire
- Changes apply immediately

## Performance Benchmarks

### Expected Response Times:
- Notification delivery: < 500ms
- Message send/receive: < 300ms  
- Channel list load: < 1s
- Message history (50 items): < 2s
- Typing indicator: < 100ms

### Concurrent User Testing:
- Test with 10+ active users
- 5+ users typing simultaneously
- 20+ notifications per minute

## Database Verification

### Check Tables:
```sql
-- Verify notifications
SELECT COUNT(*) FROM system_notifications WHERE practice_id = 'your-practice-id';

-- Check message channels
SELECT * FROM internal_message_channels WHERE practice_id = 'your-practice-id';

-- Review message counts
SELECT thread_id, COUNT(*) 
FROM internal_messages 
GROUP BY thread_id;

-- Check notification triggers
SELECT * FROM notification_triggers WHERE enabled = true;
```

### Monitor Real-time Subscriptions:
```sql
-- Active typing indicators
SELECT * FROM typing_indicators 
WHERE is_typing = true 
AND expires_at > NOW();

-- Unread notifications
SELECT user_id, COUNT(*) 
FROM system_notifications 
WHERE status IN ('pending', 'delivered')
GROUP BY user_id;
```

## Troubleshooting

### Common Issues:

1. **Messages not appearing in real-time**
   - Check Supabase real-time is enabled
   - Verify RLS policies
   - Check browser console for errors

2. **Notifications not triggering**
   - Verify trigger is enabled
   - Check trigger conditions
   - Review edge function logs

3. **Typing indicators stuck**
   - Check expires_at timestamp
   - Verify cleanup job running
   - Clear expired indicators manually

4. **Performance degradation**
   - Check message indexes
   - Verify pagination working
   - Monitor subscription count

## Security Testing

1. **Cross-Practice Access**
   - Verify users cannot see other practices' data
   - Test RLS policies thoroughly

2. **Message Tampering**
   - Ensure users cannot edit others' messages
   - Verify sender_id integrity

3. **Notification Spoofing**
   - Test creating notifications for other users (should fail)
   - Verify practice_id enforcement

## Edge Function Testing

### Test smart-notification-processor:
```bash
# Test notification creation
curl -X POST https://your-project.supabase.co/functions/v1/smart-notification-processor \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "practiceId": "test-practice-id",
    "userId": "test-user-id",
    "notificationType": "test",
    "title": "Test Notification",
    "message": "This is a test",
    "priority": "normal"
  }'
```

## Reporting Issues

When reporting issues, include:
1. Steps to reproduce
2. Expected vs actual behavior
3. Browser console errors
4. Network tab screenshots
5. Relevant database queries
6. User roles and permissions