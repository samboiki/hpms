# Visit Lifecycle Changes Summary

## Changes Implemented

### 1. Removed "Pending" Status
- ✅ Updated PremiumAppointmentScheduler type definition
- ✅ Updated Dashboard visit status mapping (no longer maps to "pending")
- ✅ Replaced `pendingAppointments` with `unconfirmedBookings` throughout

### 2. Proper Visit State Terminology
- **Unconfirmed Bookings**: `is_scheduled=true && !is_confirmed`
- **Scheduled Visits**: `is_confirmed=true && !is_checked_in`
- **Completed Visits**: `status='completed'`

### 3. Date-Based Filtering
- ✅ Dashboard header shows selected date
- ✅ All visit statistics filtered by selected date
- ✅ Activities filtered by selected date
- ✅ Notifications filtered by selected date
- ✅ Visit fetching uses selected date
- ✅ Refresh operations use selected date

### 4. Code Changes in Dashboard.tsx

```typescript
// Old: Hardcoded today
const todayVisits = visits.filter(v => 
  v.scheduled_date === format(new Date(), 'yyyy-MM-dd')
);

// New: Uses selected date
const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
const dateFilteredVisits = visits.filter(v => 
  (v.scheduled_date === selectedDateStr || v.visit_date === selectedDateStr) && 
  !v.is_cancelled
);
```

### 5. Visit Lifecycle States Used

```typescript
// Dashboard calculations
const unconfirmedBookings = dateFilteredVisits.filter(v => v.is_scheduled && !v.is_confirmed);
const scheduledVisits = dateFilteredVisits.filter(v => v.is_confirmed && !v.is_checked_in);
const completedVisits = dateFilteredVisits.filter(v => v.status === 'completed').length;
```

### 6. Visual Indicators in Calendar

```typescript
// Calendar day visit indicators
className={`w-1.5 h-1.5 rounded-full ${
  v.status === 'completed' ? 'bg-green-400' 
  : v.is_scheduled && !v.is_confirmed ? 'bg-amber-400'
  : v.is_cancelled ? 'bg-red-400'
  : 'bg-blue-400'
}`}
```

## Still Need to Fix

### 1. FloatingVisitTracker
- Currently uses appointment data from `useTodayAppointments`
- Should use visit data from `useVisitsStore`
- Stats calculation needs proper visit lifecycle alignment

### 2. PremiumAppointmentScheduler
- Still expects appointment format
- Dashboard transforms visits to appointments
- Should work directly with visits

### 3. Forms
- Need to ensure all forms create visits with proper lifecycle states
- Default state should be `is_scheduled=true, is_confirmed=false` for web bookings

### 4. Visual Consistency
- Need to implement `getVisitDisplayStatus` from enhanced-visit.types.ts everywhere
- Ensure consistent color coding across all components

## Next Steps

1. Create a visits hook that respects selected date
2. Update FloatingVisitTracker to use visits
3. Update PremiumAppointmentScheduler to handle visits natively
4. Implement visual indicators consistently using the helper functions