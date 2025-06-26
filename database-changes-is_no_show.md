# Database Change: Add is_no_show Column to Visits Table

## Overview
Added a new boolean column `is_no_show` to the `visits` table to track when patients don't show up for their scheduled visits.

## SQL Migration
```sql
-- Add is_no_show column to visits table
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS is_no_show BOOLEAN DEFAULT false;

-- Add comment to document the column
COMMENT ON COLUMN visits.is_no_show IS 'Indicates whether the patient did not show up for their scheduled visit';

-- Create an index for better query performance when filtering by no-show status
CREATE INDEX IF NOT EXISTS idx_visits_is_no_show ON visits(is_no_show) WHERE is_no_show = true;
```

## Implementation Details

### 1. Database Column
- **Column Name**: `is_no_show`
- **Type**: `BOOLEAN`
- **Default Value**: `false`
- **Purpose**: Track whether a patient failed to attend their scheduled visit

### 2. TypeScript Updates
Updated the `Visit` interface in `/src/types/enhanced-visit.types.ts`:
- Added `is_no_show: boolean` property
- Updated `isNoShow()` helper function to check both `is_no_show` flag and `status === 'no-show'`
- Updated `appointmentToEnhancedVisit()` to map appointment no-show status

### 3. Files Modified
- `/src/types/enhanced-visit.types.ts` - Added is_no_show property and updated helper functions
- `/supabase/migrations/add_is_no_show_to_visits.sql` - Migration file for database change

### 4. Usage Examples
```typescript
// Check if a visit is marked as no-show
if (visit.is_no_show || visit.status === 'no-show') {
  // Handle no-show logic
}

// Mark a visit as no-show
await supabase
  .from('visits')
  .update({ 
    is_no_show: true, 
    status: 'no-show' 
  })
  .eq('id', visitId);
```

### 5. Benefits
- Better tracking of patient attendance patterns
- Improved reporting capabilities for no-show rates
- Indexed column for efficient querying of no-show visits
- Supports both legacy status-based and new flag-based no-show tracking

## Deployment Steps
1. Execute the SQL migration in your Supabase Dashboard SQL Editor
2. Deploy the updated TypeScript code
3. The column will be available immediately with default value `false` for existing records