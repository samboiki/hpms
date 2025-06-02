# Doctor Queue Management Workflow

## Overview
The HPMS Live Queue Management system provides doctors with real-time visibility into their daily appointments and seamless patient navigation. The system works across both the Dashboard and Patient Detail pages for a harmonious workflow.

## Key Features

### 1. Dashboard Live Queue (DoctorQueueManagement)
Located on the main Dashboard, shows:
- **Statistics**: Completed, In Queue, In Progress counts
- **Live Queue**: Real-time list of appointments
- **Status Workflow**: Scheduled → Ready → In Progress → Completed
- **Quick Actions**: Mark Ready, Start Visit, Complete Visit

### 2. Patient Detail Queue (PatientDetailQueue)
When viewing a patient, doctors see:
- **My Queue Today**: All doctor's appointments for the day
- **Completed Count**: How many patients completed today
- **Next Patients**: Excluding current patient
- **Start Next Visit**: One-click navigation to next patient

### 3. Patient Data Tabs
Comprehensive view of patient data:
- **Appointments**: History of all appointments
- **Vitals**: All recorded vital signs (linkable to visits)
- **Lab Results**: Laboratory test requests and results
- **Imaging**: Medical imaging requests

## Workflow Steps

### 1. Patient Check-in
- Receptionist marks patient as **"Ready"** when they arrive
- Patient appears in doctor's queue with "Ready" status

### 2. Start Visit
- Doctor clicks **"Start Visit"** (from Dashboard or Patient Detail)
- System creates a visit record linked to appointment
- Appointment status changes to **"In Progress"**
- Doctor navigates to patient profile

### 3. During Visit
- Record vitals (can be done by nurse beforehand)
- Order labs/imaging
- Add clinical notes
- All data can be linked to the current visit

### 4. Complete Visit
- Doctor clicks **"Complete"** 
- Visit and appointment marked as completed
- Stats update in real-time

### 5. Next Patient
- From patient detail page, click **"Start Next Visit"**
- Automatically navigates to next ready/scheduled patient
- Creates visit record and starts consultation

## Real-time Updates
- All changes sync instantly across all views
- Multiple staff members see updates immediately
- Toast notifications for important status changes
- Activity logs track all actions

## Data Linking
- Vitals, labs, and imaging can be created independently
- Link to visits after creation for complete records
- Maintains flexibility for different workflows

## Benefits
1. **Efficiency**: One-click navigation between patients
2. **Visibility**: Always know who's next in queue
3. **Flexibility**: Works for scheduled and walk-in patients
4. **Integration**: Seamless connection between appointments and visits
5. **Real-time**: Instant updates across the practice

## Technical Implementation
- Uses Supabase real-time subscriptions
- Optimistic UI updates for instant feedback
- Proper error handling with rollback
- Responsive design for all screen sizes