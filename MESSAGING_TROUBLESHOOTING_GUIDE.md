# Messaging System Troubleshooting Guide

## Current Status

The messaging system is experiencing infinite recursion errors in the RLS policies. I've created progressively simpler implementations to isolate the issue.

## Solutions Implemented

### 1. Database Cleanup (Applied)
- Removed all complex RLS policies
- Created simple practice-based policies
- Added all missing columns
- Fixed constraints

### 2. Component Versions Created

#### BasicMessaging.tsx (Simplest)
- No complex queries or joins
- Direct table access only
- Manual sender lookup
- Basic error handling
- Currently active in Communications page

#### SimpleMessagingView.tsx
- Slightly more features
- Real-time updates
- Better UI

#### InternalMessagingView.tsx (Original)
- Full featured but has errors
- Complex state management
- Many dependencies

## Testing Steps

1. **Test with HTML file**:
   - Open `/test-messaging-simple.html` in browser
   - Log in with your credentials
   - Test each button to see what works

2. **Use BasicMessaging**:
   - Go to Communications > Messages
   - Try selecting a channel
   - Try sending a message

## Common Issues & Fixes

### "Infinite recursion detected"
This means the RLS policies are referencing each other in a loop. The current simple policies should prevent this.

### "Thread not found"
The BasicMessaging component creates threads automatically if they don't exist.

### "No channels showing"
Make sure you have channels created for your practice. You can create them using the test HTML file or database directly.

## Next Steps

1. **If BasicMessaging works**: 
   - We can gradually add features back
   - Keep the simple RLS policies
   - Add UI improvements

2. **If still having issues**:
   - May need to temporarily disable RLS
   - Check for conflicting database triggers
   - Consider resetting the messaging tables

## Emergency Fix

If nothing works, you can temporarily disable RLS:
```sql
ALTER TABLE internal_channel_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE internal_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE internal_message_threads DISABLE ROW LEVEL SECURITY;
```

Then re-enable when we find the issue.

## Database Structure

The messaging system uses these main tables:
- `internal_message_channels` - Chat channels
- `internal_message_threads` - Threads within channels
- `internal_messages` - Individual messages
- `internal_channel_members` - Who's in each channel

All should have `practice_id` for multi-tenancy.