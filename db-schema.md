# HPMS Database Schema & Relationships

## 🏥 Core Tables Overview

### 1. **patients** (5 records)
The central table - most other tables reference this.
- `id`: UUID primary key
- `first_name`, `last_name`: Patient name
- `id_number`: National ID
- `date_of_birth`: Date
- `gender`: male/female
- `email`, `cell_number`: Contact info
- `occupation`, `employer`: Work details
- `home_address`: Physical address
- Timestamps: `created_at`, `updated_at`

### 2. **visits** (6 records)
Records of patient visits to the facility.
- `id`: UUID primary key
- `patient_id`: → patients.id (required)
- `doctor_id`: → users.id (nullable)
- `appointment_id`: → appointments.id (nullable)
- `visit_date`, `visit_time`: When the visit occurred
- `visit_type`: consultation/follow-up/procedure/emergency
- `chief_complaint`: Why patient came in
- `diagnosis`: What was diagnosed
- `treatment_plan`: Treatment approach
- `prescription`: Medications prescribed
- `status`: in-progress/completed

### 3. **appointments** (5 records)
Scheduled appointments.
- `id`: UUID primary key
- `patient_id`: → patients.id
- `doctor_id`: → users.id
- `date`, `time`: Appointment schedule
- `duration`: Minutes (integer)
- `type`: Type of appointment
- `status`: scheduled/confirmed/cancelled/completed

### 4. **vitals** (11 records)
Patient vital signs recorded during visits.
- `id`: UUID primary key
- `visit_id`: → visits.id
- `blood_pressure`: Text (e.g., "120/80")
- `temperature`, `pulse_rate`, `respiratory_rate`: Integers
- `weight`, `height`: Integers
- `bmi`: Calculated numeric

### 5. **lab_results** (15 records)
Laboratory test results.
- `id`: UUID primary key
- `visit_id`: → visits.id
- `name`: Test name
- `value`: Result value
- `unit`: Measurement unit
- `reference_range`: Normal range
- `status`: normal/abnormal/critical
- `date`: When test was done

### 6. **medical_aid_details** (4 records)
Patient insurance/medical aid information.
- `id`: UUID primary key
- `patient_id`: → patients.id
- `provider`: Insurance company
- `scheme`: Insurance plan
- `membership_number`: Member ID
- `main_member_name`, `main_member_id_number`: Primary member details
- `relationship_to_main`: self/spouse/child/etc

### 7. **next_of_kin** (3 records)
Emergency contacts for patients.
- `id`: UUID primary key
- `patient_id`: → patients.id
- `name`: Contact person name
- `relationship`: Relationship to patient
- `phone`: Contact number
- `address`: Physical address

### 8. **users** (4 records)
System users (doctors, nurses, staff).
- `id`: UUID primary key
- `email`: Login email
- `full_name`: Display name
- `role`: admin/doctor/nurse/receptionist
- `last_login`: Timestamp
- `avatar`: Profile picture URL

## 🔗 Relationship Diagram

```
┌─────────────┐
│   PATIENTS  │ ←─────────────────────────────┐
└──────┬──────┘                               │
       │                                      │
       ├─[patient_id]─→ VISITS               │
       │                   ├─[visit_id]─→ VITALS
       │                   ├─[visit_id]─→ LAB_RESULTS
       │                   └─[appointment_id]─→ APPOINTMENTS ←─[patient_id]─┘
       │                                            │
       ├─[patient_id]─→ MEDICAL_AID_DETAILS       │
       │                                            │
       ├─[patient_id]─→ NEXT_OF_KIN                │
       │                                            │
       └─[patient_id]─────────────────────────────┘

USERS ←─[doctor_id]─── VISITS
      ←─[doctor_id]─── APPOINTMENTS
```

## 📊 Key Relationships

1. **One Patient → Many Visits**
   - A patient can have multiple visits
   - Each visit belongs to one patient

2. **One Visit → Many Vitals/Lab Results**
   - Each visit can have multiple vital recordings
   - Each visit can have multiple lab results

3. **One Patient → One Medical Aid**
   - Each patient can have one medical aid record
   - Not all patients have medical aid

4. **One Patient → Many Next of Kin**
   - A patient can have multiple emergency contacts

5. **Appointments ↔ Visits**
   - An appointment can result in a visit
   - Not all visits come from appointments (walk-ins)

## 🔍 Common Query Examples

### Get patient with latest visit:
```javascript
const { data } = await supabase
  .from('patients')
  .select(`
    *,
    visits!inner (
      *,
      vitals (*),
      lab_results (*)
    )
  `)
  .eq('id', patientId)
  .order('visits.visit_date', { ascending: false })
  .limit(1);
```

### Get all patients with medical aid:
```javascript
const { data } = await supabase
  .from('patients')
  .select(`
    *,
    medical_aid_details!inner (*)
  `);
```

### Get doctor's appointments for today:
```javascript
const { data } = await supabase
  .from('appointments')
  .select(`
    *,
    patients (first_name, last_name, cell_number)
  `)
  .eq('doctor_id', doctorId)
  .eq('date', new Date().toISOString().split('T')[0])
  .order('time');
```

## 📝 Tables with No Data Yet:
- `lab_requests` - For requesting lab tests
- `media_files` - For storing documents/images
- `media_requests` - For requesting media uploads
- `messages` - Internal messaging system
- `message_recipients` - Message delivery tracking