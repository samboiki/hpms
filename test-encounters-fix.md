# Test Plan for Encounters View Fixes

## Issues Fixed:

1. **State Management Fix**: Fixed the issue where rows kept increasing when switching filters
   - Modified the useEffect to re-fetch encounters when filters change
   - Filters now properly replace data instead of appending

2. **Navigation Fix**: Fixed clicking rows to open EditVisitModal instead of navigating to non-existent route
   - Changed navigation from `/patients/{id}` to `/patients?patientId={id}&visitId={visitId}&action=edit-visit`
   - Added URL parameter handling in Patients.tsx
   - ComprehensivePatientModal now accepts and handles `visitIdToEdit` prop
   - Modal automatically opens EditVisitModal when visitIdToEdit is provided

3. **Lab/Imaging Sorting**: The data structure appears correct in the database, sorting should work now

## Testing Steps:

1. **Test Filter Switching**:
   - Go to Encounters page
   - Switch between different status filters (All, Scheduled, In Progress, Completed, Cancelled)
   - Verify that row count changes correctly and doesn't accumulate

2. **Test Row Click Navigation**:
   - Click on any encounter row
   - Should open ComprehensivePatientModal with the patient
   - Should automatically open EditVisitModal for that specific visit
   - Should switch to the encounters tab for context

3. **Test Sorting**:
   - Click on the Labs column header to sort
   - Click on the Imaging column header to sort
   - Verify sorting works correctly for all columns

## Key Code Changes:

1. **EncountersView.tsx**:
   - Added filter dependencies to fetchEncounters useEffect
   - Changed handleRowClick to navigate with URL parameters
   - Fixed status count display to use actual filtered data

2. **Patients.tsx**:
   - Added useSearchParams hook
   - Added URL parameter handling in useEffect
   - Pass visitIdToEdit to ComprehensivePatientModal

3. **ComprehensivePatientModal.tsx**:
   - Added visitIdToEdit prop
   - Added useEffect to handle opening edit visit modal when visitIdToEdit is provided
   - Switches to encounters tab for context