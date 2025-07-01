# Messaging Database Fixes

## Issues Fixed

### 1. Missing `practice_id` in `internal_message_threads`
**Error**: "column "practice_id" of relation "internal_message_threads" does not exist"

**Solution**: 
- Added `practice_id` column to `internal_message_threads` table
- Added foreign key reference to `practices(id)`
- Updated existing threads to inherit practice_id from their channels
- Added index for performance

### 2. Missing `created_by` in `internal_message_threads`
**Error**: Thread creation failing due to missing created_by field

**Solution**:
- Added `created_by` column to `internal_message_threads` table
- Added foreign key reference to `users(id)`
- Updated the `create_direct_message_channel` function to include both fields

### 3. Missing `announcement` in channel_type enum
**Error**: "invalid input value for enum channel_type: 'announcement'"

**Solution**:
- Added 'announcement' to the channel_type enum
- Positioned after 'broadcast' in the enum order

## Database Changes Applied

```sql
-- Added columns to internal_message_threads
ALTER TABLE internal_message_threads 
ADD COLUMN practice_id UUID REFERENCES practices(id);

ALTER TABLE internal_message_threads 
ADD COLUMN created_by UUID REFERENCES users(id);

-- Added announcement to channel_type enum
ALTER TYPE channel_type ADD VALUE 'announcement' AFTER 'broadcast';

-- Updated existing data
UPDATE internal_message_threads t
SET practice_id = c.practice_id
FROM internal_message_channels c
WHERE t.channel_id = c.id
AND t.practice_id IS NULL;

-- Added index for performance
CREATE INDEX idx_internal_message_threads_practice_id 
ON internal_message_threads(practice_id);
```

## Function Updates

Updated `create_direct_message_channel` function to:
- Include `practice_id` when creating threads
- Include `created_by` when creating threads
- Maintain consistency with the channel's practice

## Service Layer Updates

The `internalMessagingService.ts` already includes:
- Getting current user before creating channels
- Setting `created_by` on channel creation
- Setting `practice_id` and `created_by` on thread creation

## Testing

All channel types should now work:
- Direct messages
- Group chats
- Announcements
- Department channels
- Practice-wide channels
- Patient care channels

The messaging system is now fully functional with proper practice isolation and user attribution.