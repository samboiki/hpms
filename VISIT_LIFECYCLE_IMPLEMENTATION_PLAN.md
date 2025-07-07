# Visit Lifecycle Implementation Plan

## Current Status

### ✅ Completed
1. **Database Schema**: Visit table has all required fields (is_scheduled, is_confirmed, is_ready, is_checked_in, is_cancelled, status)
2. **Type Definitions**: Enhanced visit types with proper helper functions in `enhanced-visit.types.ts`
3. **Dashboard Updates**:
   - Removed "pending" references
   - Using date filters instead of hardcoded "today"
   - Proper visit state calculations
   - Date indicator in header

### 🔄 In Progress
1. **Component Alignment**: Need to update components to use visit data instead of appointment data
2. **Visual Indicators**: Need to implement proper color coding for each state

### ❌ Not Started
1. **FloatingVisitTracker**: Still using appointment data, needs to use visit data
2. **PremiumAppointmentScheduler**: Needs proper visit state handling
3. **Forms**: Need to update forms to work with visit lifecycle

## Visit Lifecycle States

```typescript
// Core states stored in database
status: 'scheduled' | 'in-progress' | 'completed'

// Additional boolean flags for sub-states
is_scheduled: boolean     // Booking request from website
is_confirmed: boolean     // Practice confirmed the booking
is_ready: boolean        // Next patient in queue
is_checked_in: boolean   // Patient in waiting room
is_cancelled: boolean    // Visit cancelled
```

## State Transitions

1. **Unconfirmed Booking**: `is_scheduled=true, is_confirmed=false`
2. **Confirmed Visit**: `is_confirmed=true, is_checked_in=false`
3. **Checked In**: `is_checked_in=true, is_ready=false`
4. **Ready**: `is_ready=true, status='scheduled'`
5. **In Progress**: `status='in-progress'`
6. **Completed**: `status='completed'`
7. **Cancelled**: `is_cancelled=true`

## Visual Indicators

- **Unconfirmed**: Orange/amber (needs attention)
- **Scheduled**: Blue (confirmed)
- **Checked In**: Green (in practice)
- **Ready**: Pulsing green (next patient)
- **In Progress**: Active blue (with doctor)
- **Completed**: Gray (finished)
- **Cancelled**: Red strikethrough

## Key Issues to Fix

1. **Data Model Confusion**: 
   - Some components use appointments table
   - Some use visits table
   - Need to standardize on visits table

2. **FloatingVisitTracker**:
   - Currently uses `useTodayAppointments` hook
   - Should use visits data from `useVisitsStore`
   - Stats calculation needs to align with visit lifecycle

3. **PremiumAppointmentScheduler**:
   - Expects appointment format
   - Dashboard transforms visits to appointments
   - Should work directly with visits

4. **Date Filtering**:
   - Dashboard now uses selectedDate
   - All components need to respect this filter
   - No more hardcoded "today" logic

## Next Steps

1. Update FloatingVisitTracker to use visit data
2. Update PremiumAppointmentScheduler to handle visits directly
3. Implement proper visual indicators using getVisitDisplayStatus
4. Update all forms to work with visit lifecycle
5. Ensure all components respect date filtering