# Visits Migration Plan - Timeline & Grid View Updates

## Overview
This document outlines the plan to update timeline and grid view components to work with the enhanced visits table instead of the appointments table.

## 1. Enhanced Visits Table Structure

The visits table now includes the following scheduling properties:
```sql
-- New boolean flags for visit states
is_scheduled BOOLEAN DEFAULT false      -- Visit is scheduled (from website booking)
is_confirmed BOOLEAN DEFAULT false      -- Practice has confirmed the booking
is_ready BOOLEAN DEFAULT false          -- Patient is next to see doctor
is_checked_in BOOLEAN DEFAULT false     -- Patient has arrived at practice
is_cancelled BOOLEAN DEFAULT false      -- Visit has been cancelled

-- New scheduling fields
scheduled_date DATE                     -- Date of scheduled visit
scheduled_time TIME                     -- Time of scheduled visit
```

## 2. Visit State Transitions

### Website Booking → Practice Workflow
1. **Website Booking**: `is_scheduled=true, is_confirmed=false`
2. **Practice Confirmation**: `is_confirmed=true`
3. **Patient Arrival**: `is_checked_in=true`
4. **Ready for Doctor**: `is_ready=true`
5. **Visit Started**: `status='in-progress'`
6. **Visit Completed**: `status='completed'`

### Direct Practice Booking
1. **Practice Creates Visit**: `is_scheduled=true, is_confirmed=true`
2. **Continue from step 3 above**

## 3. Component Updates Required

### A. Grid View Components
Files to update:
- `/src/components/appointments/AppointmentGridView.tsx`
- `/src/components/appointments/PremiumWeekGridView.tsx`
- `/src/components/appointments/PremiumDayGridView.tsx`
- `/src/components/appointments/ModernWeekView.tsx`

**Changes:**
1. Replace `appointments` table queries with `visits`
2. Update status filters to use boolean flags
3. Add quick action buttons:
   - Confirm (for unconfirmed bookings)
   - Check In
   - Mark Ready
   - Start Visit
4. Visual indicators:
   - Orange badge for unconfirmed (`is_scheduled && !is_confirmed`)
   - Blue for confirmed (`is_confirmed && !is_checked_in`)
   - Green for checked in (`is_checked_in && !is_ready`)
   - Pulsing green for ready (`is_ready`)
   - Active blue for in progress (`status='in-progress'`)

### B. Timeline View Components
Files to update:
- `/src/components/appointments/DayTimelineView.tsx`
- `/src/components/patients/EncounterTimeline.tsx`
- `/src/components/visits/VisitsTimeline.tsx`

**Changes:**
1. Display visits in chronological order using `scheduled_date/time` or `visit_date/time`
2. Show state badges for each visit
3. Add hover actions for state transitions
4. Group by state sections (unconfirmed, scheduled, in-practice, completed)

### C. Forms & Modals
Files to update:
- `/src/components/forms/AddAppointmentForm.tsx` → `AddScheduledVisitForm.tsx`
- `/src/components/forms/EnhancedAppointmentForm.tsx` → `EnhancedScheduledVisitForm.tsx`
- `/src/components/modals/AppointmentActionModal.tsx` → `VisitActionModal.tsx`
- `/src/components/modals/AppointmentApprovalModal.tsx` → `VisitConfirmationModal.tsx`
- `/src/components/modals/RescheduleAppointmentModal.tsx` → `RescheduleVisitModal.tsx`

**Changes:**
1. Create scheduled visits with appropriate flags
2. Handle confirmation workflow
3. Update rescheduling to modify `scheduled_date/time`

### D. Dashboard Components
Files to update:
- `/src/components/dashboard/DashboardStats.tsx`
- `/src/components/dashboard/FloatingVisitTracker.tsx`
- `/src/components/dashboard/PracticeOverviewTile.tsx`

**Changes:**
1. Show unconfirmed booking count prominently
2. Display today's schedule from visits table
3. Add real-time alerts for new bookings

## 4. Query Updates

### Old Appointment Query
```typescript
const { data } = await supabase
  .from('appointments')
  .select('*')
  .eq('status', 'scheduled')
  .eq('date', todayDate);
```

### New Visit Query
```typescript
const { data } = await supabase
  .from('visits')
  .select('*')
  .eq('is_confirmed', true)
  .eq('is_cancelled', false)
  .eq('scheduled_date', todayDate)
  .order('scheduled_time');
```

### Unconfirmed Bookings Query
```typescript
const { data } = await supabase
  .from('visits')
  .select('*')
  .eq('is_scheduled', true)
  .eq('is_confirmed', false)
  .eq('is_cancelled', false);
```

## 5. State Management Updates

### appointmentsStore.ts → visitsStore.ts
```typescript
interface VisitsStore {
  visits: Visit[];
  unconfirmedCount: number;
  checkedInCount: number;
  readyCount: number;
  
  // Actions
  confirmVisit: (visitId: string) => Promise<void>;
  checkInPatient: (visitId: string) => Promise<void>;
  markPatientReady: (visitId: string) => Promise<void>;
  startVisit: (visitId: string) => Promise<void>;
}
```

## 6. Real-time Subscriptions

Update real-time hooks to listen for visit changes:
```typescript
const subscription = supabase
  .channel('visits-changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'visits' },
    (payload) => {
      // Handle visit updates
      // Alert for new unconfirmed bookings
      if (payload.new.is_scheduled && !payload.new.is_confirmed) {
        showNotification('New booking requires confirmation!');
      }
    }
  )
  .subscribe();
```

## 7. Migration Steps

1. **Phase 1**: Update TypeScript types and interfaces
2. **Phase 2**: Create new visit-based components alongside existing
3. **Phase 3**: Update queries to use visits table
4. **Phase 4**: Add state transition UI elements
5. **Phase 5**: Implement real-time updates
6. **Phase 6**: Test thoroughly with all user roles
7. **Phase 7**: Remove appointment-based components

## 8. Testing Checklist

- [ ] Website bookings create unconfirmed visits
- [ ] Staff can confirm bookings
- [ ] Check-in workflow functions correctly
- [ ] Ready state properly queues patients
- [ ] Visit transitions update in real-time
- [ ] Dashboard shows correct counts
- [ ] Timeline views display all states
- [ ] Grid views allow quick actions
- [ ] Rescheduling maintains state
- [ ] Cancellations work properly