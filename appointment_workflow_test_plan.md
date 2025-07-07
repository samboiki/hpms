# Appointment Workflow Test Plan

## Overview
This document outlines the test scenarios for the new appointment workflow system implemented in HPMS.

## Status Transitions
- **Removed**: `confirmed` status has been completely removed from the system
- **Valid statuses**: `pending`, `scheduled`, `in-progress`, `completed`, `cancelled`, `no-show`

## Test Scenarios

### 1. Pending Appointment Approval (Receptionist/Admin)
**Steps:**
1. Navigate to Appointments page
2. Click on "Pending" stat card (should open grid view filtered by pending)
3. Find a pending appointment (doctor_id should be NULL)
4. Click action menu → "Approve"
5. **Verify**: Approval modal opens with mandatory doctor selection
6. Select a doctor and approve
7. **Verify**: Appointment status changes to "scheduled" and doctor is assigned

### 2. Start Visit from Scheduled Appointment (Doctor/Nurse)
**Steps:**
1. Navigate to Appointments page
2. Click on "Scheduled" stat card
3. Find a scheduled appointment for today
4. Click action menu → "Start Visit"
5. **Verify**: 
   - Visit record is created with status "in-progress"
   - Appointment status changes to "in-progress"
   - Action menu now shows "Complete Visit" option

### 3. Complete Visit from In-Progress (Doctor)
**Method A - From Appointments Page:**
1. Navigate to Appointments page
2. Click on "In Progress" stat card
3. Find an in-progress appointment
4. Click action menu → "Complete Visit"
5. **Verify**: 
   - Visit status changes to "completed"
   - Appointment status changes to "completed"

**Method B - From Patient Detail Page:**
1. Navigate to patient detail page
2. Find an in-progress visit
3. Click "End Visit" button
4. **Verify**:
   - Visit status changes to "completed"
   - Linked appointment status also changes to "completed"

### 4. Reschedule Workflow
**Steps:**
1. Find a scheduled appointment
2. Click action menu → "Reschedule"
3. Select new date/time
4. **Verify**: Appointment remains in "scheduled" status with new date/time

### 5. Cancel Appointment
**Steps:**
1. Find any non-completed appointment
2. Click action menu → "Cancel"
3. **Verify**: Status changes to "cancelled"

### 6. Grid View Filtering
**Steps:**
1. Click each stat card on Appointments page
2. **Verify**: Grid view opens with correct status filter applied
3. **Verify**: Only appointments with selected status are shown

## Database Verification Queries

```sql
-- Check pending appointments have NULL doctor_id
SELECT id, patient_id, doctor_id, status 
FROM appointments 
WHERE status = 'pending' AND doctor_id IS NOT NULL;
-- Should return 0 rows

-- Check all appointments have valid status
SELECT DISTINCT status 
FROM appointments 
WHERE status NOT IN ('pending', 'scheduled', 'in-progress', 'completed', 'cancelled', 'no-show');
-- Should return 0 rows

-- Check visits linked to appointments
SELECT 
  a.id as appointment_id,
  a.status as appointment_status,
  v.id as visit_id,
  v.status as visit_status
FROM appointments a
LEFT JOIN visits v ON v.appointment_id = a.id
WHERE a.status = 'in-progress';
-- All in-progress appointments should have a visit
```

## Expected UI Changes

### Appointment Cards/Rows
- **Pending**: Shows "Approve" and "Reschedule" actions
- **Scheduled**: Shows "Start Visit", "Reschedule", and "Cancel" actions  
- **In-Progress**: Shows "Complete Visit" and "Cancel Visit" actions
- **Completed**: Shows view-only (no actions)
- **Cancelled**: Shows "Delete" action (if permitted)

### Status Colors
- Pending: Yellow/Amber
- Scheduled: Blue
- In-Progress: Orange
- Completed: Green
- Cancelled: Red
- No-show: Gray

## Notes
- Appointments created via the booking widget start with `pending` status and NULL doctor_id
- Only approved appointments (scheduled status) can start visits
- Completing a visit automatically completes the linked appointment
- The system maintains referential integrity between appointments and visits