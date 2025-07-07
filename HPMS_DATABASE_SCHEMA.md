# HPMS Database Schema Documentation

This document provides a comprehensive listing of all tables in the Healthcare Practice Management System (HPMS) database, organized by functional area. Each table includes complete field definitions with data types and constraints.

## Table of Contents

1. [Medical/Clinical Tables](#medicalclinical-tables)
2. [Patient Management Tables](#patient-management-tables)
3. [Appointment & Visit Tables](#appointment--visit-tables)
4. [Financial/Billing Tables](#financialbilling-tables)
5. [HR/Payroll Tables](#hrpayroll-tables)
6. [Communication Tables](#communication-tables)
7. [Practice Management Tables](#practice-management-tables)
8. [User & Authentication Tables](#user--authentication-tables)
9. [Audit & Logging Tables](#audit--logging-tables)
10. [System Configuration Tables](#system-configuration-tables)
11. [Analytics & Reporting Views](#analytics--reporting-views)
12. [Automation Tables](#automation-tables)

---

## Medical/Clinical Tables

### visits
**Description:** Central table for all patient visits, appointments, and medical encounters. This is the PRIMARY table for appointment scheduling and visit management.

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier for the visit |
| patient_id | uuid | YES | NULL | FOREIGN KEY (patients) | Reference to the patient |
| doctor_id | uuid | YES | NULL | FOREIGN KEY (users) | Reference to the doctor/healthcare provider |
| visit_date | date | YES | NULL |  | Date of the actual visit |
| visit_time | time | YES | NULL |  | Time of the actual visit |
| visit_type | text | NO | NULL |  | Type of visit (consultation, follow-up, etc.) |
| chief_complaint | text | YES | NULL |  | Primary reason for the visit |
| diagnosis | text | YES | NULL |  | Medical diagnosis |
| treatment_plan | text | YES | NULL |  | Treatment plan and recommendations |
| prescription | text | YES | NULL |  | Prescription details |
| follow_up_required | boolean | YES | false |  | Whether follow-up is needed |
| follow_up_date | date | YES | NULL |  | Scheduled follow-up date |
| notes | text | YES | NULL |  | Additional clinical notes |
| status | text | NO | 'in-progress' |  | Visit status (scheduled, in-progress, completed, cancelled) |
| practice_id | uuid | YES | NULL | FOREIGN KEY (practices) | Reference to the practice |
| encounter_date | date | YES | NULL |  | Date of the medical encounter |
| visit_number | integer | YES | NULL |  | Sequential visit number for the patient |
| is_scheduled | boolean | YES | false |  | Whether this is a scheduled appointment |
| is_confirmed | boolean | YES | false |  | Whether appointment is confirmed |
| is_ready | boolean | YES | false |  | Whether patient is ready to be seen |
| is_checked_in | boolean | YES | false |  | Whether patient has checked in |
| is_cancelled | boolean | YES | false |  | Whether appointment is cancelled |
| scheduled_date | date | YES | NULL |  | Scheduled appointment date |
| scheduled_time | time | YES | NULL |  | Scheduled appointment time |
| is_handoff | boolean | YES | false |  | Whether this is a handoff between providers |
| is_from_website | boolean | YES | false |  | Whether appointment was booked online |
| branch_id | uuid | YES | NULL | FOREIGN KEY (branches) | Reference to the practice branch |
| preceding_visit_id | uuid | YES | NULL | FOREIGN KEY (visits) | Reference to previous visit in care plan |
| applied_template_id | uuid | YES | NULL | FOREIGN KEY (follow_up_templates) | Applied follow-up template |
| care_plan_step | integer | YES | NULL |  | Step number in care plan |
| visit_subtype | text | YES | NULL |  | Sub-category of visit type |
| duration_minutes | integer | YES | 30 |  | Expected duration in minutes |
| automation_source | text | YES | NULL |  | Source of automated scheduling |
| created_at | timestamp with time zone | YES | now() |  | Record creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Last update timestamp |

### vitals
**Description:** Patient vital signs recorded during visits

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| visit_id | uuid | YES | NULL | FOREIGN KEY (visits) | Reference to the visit |
| blood_pressure | text | YES | NULL |  | Blood pressure reading (e.g., "120/80") |
| temperature | numeric(4,1) | YES | NULL |  | Body temperature |
| pulse_rate | integer | YES | NULL |  | Heart rate in beats per minute |
| respiratory_rate | integer | YES | NULL |  | Breathing rate per minute |
| weight | numeric(5,2) | YES | NULL |  | Patient weight |
| height | numeric(5,2) | YES | NULL |  | Patient height |
| bmi | numeric(4,1) | YES | NULL |  | Body Mass Index |
| created_at | timestamp with time zone | YES | now() |  | Record creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Last update timestamp |

### lab_requests
**Description:** Laboratory test requests for patients

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| patient_id | uuid | NO | NULL | FOREIGN KEY (patients) | Reference to the patient |
| visit_id | uuid | YES | NULL | FOREIGN KEY (visits) | Reference to the visit |
| practice_id | uuid | YES | NULL | FOREIGN KEY (practices) | Reference to the practice |
| request_date | date | NO | CURRENT_DATE |  | Date of the request |
| preferred_date | date | YES | NULL |  | Patient's preferred test date |
| lab_facility | text | YES | NULL |  | Laboratory facility name |
| status | text | NO | 'pending' |  | Request status (pending, completed, cancelled) |
| notes | text | YES | NULL |  | Additional notes |
| media_url | text | YES | NULL |  | URL to related media/documents |
| media_type | text | YES | NULL |  | Type of media attached |
| created_at | timestamp with time zone | YES | now() |  | Record creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Last update timestamp |

### lab_results
**Description:** Laboratory test results

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| lab_request_id | uuid | NO | NULL | FOREIGN KEY (lab_requests) | Reference to the lab request |
| test_name | text | NO | NULL |  | Name of the test |
| test_value | text | NO | NULL |  | Test result value |
| test_unit | text | YES | NULL |  | Unit of measurement |
| reference_range | text | YES | NULL |  | Normal reference range |
| status | text | YES | NULL |  | Result status (normal, abnormal, critical) |
| created_at | timestamp with time zone | YES | now() |  | Record creation timestamp |

### imaging_requests
**Description:** Medical imaging requests (X-rays, MRI, CT scans, etc.)

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| patient_id | uuid | NO | NULL | FOREIGN KEY (patients) | Reference to the patient |
| visit_id | uuid | YES | NULL | FOREIGN KEY (visits) | Reference to the visit |
| requested_by | uuid | NO | NULL | FOREIGN KEY (users) | Doctor who requested the imaging |
| request_date | date | NO | CURRENT_DATE |  | Date of the request |
| priority | text | NO | 'routine' |  | Priority level (routine, urgent, stat) |
| status | text | NO | 'pending' |  | Request status |
| imaging_type | text | NO | NULL |  | Type of imaging (X-ray, MRI, CT, etc.) |
| body_part | text | NO | NULL |  | Body part to be imaged |
| view_position | text | YES | NULL |  | Specific views required |
| contrast_required | boolean | YES | false |  | Whether contrast medium is needed |
| clinical_indication | text | NO | NULL |  | Clinical reason for imaging |
| clinical_history | text | YES | NULL |  | Relevant clinical history |
| special_instructions | text | YES | NULL |  | Special instructions for radiologist |
| preferred_date | date | YES | NULL |  | Patient's preferred date |
| scheduled_date | date | YES | NULL |  | Actual scheduled date |
| scheduled_time | time | YES | NULL |  | Scheduled time |
| facility_name | text | YES | NULL |  | Imaging facility name |
| result_file_ids | uuid[] | YES | NULL |  | Array of file IDs for results |
| radiologist_name | text | YES | NULL |  | Name of interpreting radiologist |
| report_text | text | YES | NULL |  | Radiology report |
| notes | text | YES | NULL |  | Additional notes |
| completed_date | date | YES | NULL |  | Date imaging was completed |
| expected_results_date | date | YES | NULL |  | Expected date for results |
| created_at | timestamp with time zone | YES | now() |  | Record creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Last update timestamp |

### medications
**Description:** Patient medications and prescriptions

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| visit_id | uuid | YES | NULL | FOREIGN KEY (visits) | Reference to the visit |
| patient_id | uuid | YES | NULL | FOREIGN KEY (patients) | Reference to the patient |
| medication_name | text | NO | NULL |  | Name of the medication |
| dosage | text | YES | NULL |  | Dosage information |
| frequency | text | YES | NULL |  | Frequency of administration |
| duration | text | YES | NULL |  | Duration of treatment |
| instructions | text | YES | NULL |  | Administration instructions |
| prescribed_by | uuid | YES | NULL | FOREIGN KEY (users) | Prescribing doctor |
| prescribed_date | timestamp with time zone | YES | now() |  | Date prescribed |
| status | text | YES | 'active' |  | Medication status (active, discontinued, completed) |
| notes | text | YES | NULL |  | Additional notes |
| created_at | timestamp with time zone | YES | now() |  | Record creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Last update timestamp |

### medications_with_details (View)
**Description:** Enriched view of medications with patient and visit details

| Field | Data Type | Description |
|-------|-----------|-------------|
| id | uuid | Medication ID |
| visit_id | uuid | Visit ID |
| patient_id | uuid | Patient ID |
| medication_name | text | Medication name |
| dosage | text | Dosage information |
| frequency | text | Frequency |
| duration | text | Duration |
| instructions | text | Instructions |
| prescribed_by | uuid | Prescribing doctor ID |
| prescribed_date | timestamp with time zone | Date prescribed |
| status | text | Medication status |
| notes | text | Notes |
| created_at | timestamp with time zone | Creation timestamp |
| updated_at | timestamp with time zone | Update timestamp |
| patient_name | text | Patient full name |
| date_of_birth | date | Patient DOB |
| cell_number | text | Patient phone |
| prescribed_by_email | varchar(255) | Prescriber email |
| visit_date | date | Visit date |
| visit_time | time | Visit time |
| visit_type | text | Visit type |
| chief_complaint | text | Chief complaint |
| visit_number | bigint | Visit number |
| encounter_date | date | Encounter date |
| diagnosis | text | Diagnosis |
| treatment_plan | text | Treatment plan |

---

## Patient Management Tables

### patients
**Description:** Core patient demographic and contact information

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| first_name | text | NO | NULL |  | Patient's first name |
| last_name | text | NO | NULL |  | Patient's last name |
| id_number | text | NO | NULL | UNIQUE | National ID number |
| date_of_birth | date | NO | NULL |  | Date of birth |
| gender | text | NO | NULL |  | Gender (Male, Female, Other) |
| marital_status | text | YES | NULL |  | Marital status |
| occupation | text | YES | NULL |  | Patient's occupation |
| employer | text | YES | NULL |  | Employer name |
| home_language | text | YES | NULL |  | Preferred language |
| cell_number | text | YES | NULL |  | Mobile phone number |
| email | text | YES | NULL |  | Email address |
| home_address | text | YES | NULL |  | Physical home address |
| postal_address | text | YES | NULL |  | Postal address |
| postal_code | text | YES | NULL |  | Postal/ZIP code |
| practice_id | uuid | YES | NULL | FOREIGN KEY (practices) | Associated practice |
| system_patient_reference_number | integer | NO | NULL |  | System-generated reference number |
| created_at | timestamp with time zone | YES | now() |  | Record creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Last update timestamp |

### patient_documents
**Description:** Document storage for patient files

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| patient_id | uuid | NO | NULL | FOREIGN KEY (patients) | Reference to patient |
| visit_id | uuid | YES | NULL | FOREIGN KEY (visits) | Reference to visit |
| file_name | text | NO | NULL |  | System file name |
| original_name | text | NO | NULL |  | Original uploaded file name |
| file_type | text | NO | NULL |  | File extension/type |
| file_size | integer | NO | NULL |  | File size in bytes |
| mime_type | text | NO | NULL |  | MIME type |
| storage_path | text | NO | NULL |  | Storage location path |
| description | text | YES | NULL |  | Document description |
| category | text | YES | 'general' |  | Document category |
| tags | text[] | YES | NULL |  | Array of tags |
| uploaded_by | uuid | YES | NULL | FOREIGN KEY (users) | User who uploaded |
| is_processed | boolean | YES | false |  | Processing status |
| created_at | timestamp with time zone | YES | now() |  | Upload timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Last update timestamp |

### patient_media
**Description:** Media file storage for patient images and videos

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| patient_id | uuid | NO | NULL | FOREIGN KEY (patients) | Reference to patient |
| visit_id | uuid | YES | NULL | FOREIGN KEY (visits) | Reference to visit |
| file_name | text | NO | NULL |  | System file name |
| original_name | text | NO | NULL |  | Original file name |
| file_size | bigint | NO | NULL |  | File size in bytes |
| file_type | text | NO | NULL |  | File type/extension |
| mime_type | text | NO | NULL |  | MIME type |
| storage_path | text | NO | NULL | UNIQUE | Unique storage path |
| storage_bucket | text | NO | 'patient-media' |  | Storage bucket name |
| category | text | NO | NULL |  | Media category |
| subcategory | text | YES | NULL |  | Media subcategory |
| description | text | YES | NULL |  | Media description |
| tags | text[] | YES | NULL |  | Array of tags |
| metadata | jsonb | YES | '{}' |  | Additional metadata |
| is_sensitive | boolean | YES | false |  | Sensitive content flag |
| title | text | YES | NULL |  | Media title |
| uploaded_by | uuid | NO | NULL | FOREIGN KEY (users) | Uploading user |
| uploaded_at | timestamp with time zone | YES | now() |  | Upload timestamp |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### patient_locations
**Description:** Patient address mapping to suburbs

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| patient_id | uuid | YES | NULL | FOREIGN KEY (patients), UNIQUE | Reference to patient |
| suburb_id | uuid | YES | NULL | FOREIGN KEY (suburbs) | Reference to suburb |
| raw_address | text | YES | NULL |  | Original address text |
| mapped_address | text | YES | NULL |  | Normalized address |
| confidence_score | double precision | YES | NULL |  | Mapping confidence (0-1) |
| mapping_source | varchar(50) | YES | 'openai' |  | Mapping service used |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### next_of_kin
**Description:** Emergency contact information for patients

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| patient_id | uuid | YES | NULL | FOREIGN KEY (patients) | Reference to patient |
| name | text | NO | NULL |  | Contact person's name |
| relationship | text | NO | NULL |  | Relationship to patient |
| phone | text | NO | NULL |  | Contact phone number |
| address | text | YES | NULL |  | Contact address |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |

### medical_aid_details
**Description:** Patient medical insurance details

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| patient_id | uuid | YES | NULL | FOREIGN KEY (patients) | Reference to patient |
| provider | text | NO | NULL |  | Insurance provider name |
| scheme | text | NO | NULL |  | Insurance scheme/plan |
| membership_number | text | NO | NULL |  | Membership number |
| plan_type | text | NO | NULL |  | Plan type/level |
| main_member_name | text | NO | NULL |  | Primary member name |
| main_member_id_number | text | NO | NULL |  | Primary member ID |
| relationship_to_main | text | NO | NULL |  | Relationship to primary |
| medical_aid_provider_id | uuid | YES | NULL | FOREIGN KEY (medical_aid_providers) | Provider reference |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### medical_aid_providers
**Description:** Medical insurance provider information

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| name | text | NO | NULL | UNIQUE | Provider name |
| short_name | text | YES | NULL |  | Abbreviated name |
| logo_url | text | YES | NULL |  | Logo image URL |
| contact_number | text | YES | NULL |  | Contact phone |
| email | text | YES | NULL |  | Contact email |
| website | text | YES | NULL |  | Website URL |
| address | text | YES | NULL |  | Physical address |
| medical_aid_reference | text | YES | NULL |  | Provider reference code |
| theme_color | text | YES | NULL |  | Brand color |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### medical_aid_schemes
**Description:** Medical aid scheme/plan details

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| provider_id | uuid | YES | NULL | FOREIGN KEY (medical_aid_providers) | Provider reference |
| name | text | NO | NULL |  | Scheme name |
| description | text | YES | NULL |  | Scheme description |
| hospital_cover_percentage | numeric(5,2) | YES | NULL |  | Hospital coverage % |
| specialist_cover_percentage | numeric(5,2) | YES | NULL |  | Specialist coverage % |
| gp_cover_percentage | numeric(5,2) | YES | NULL |  | GP coverage % |
| medication_annual_limit | numeric(10,2) | YES | NULL |  | Annual medication limit |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |

---

## Appointment & Visit Tables

### appointments
**Description:** Legacy appointment scheduling table (being phased out in favor of visits table)

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| patient_id | uuid | YES | NULL | FOREIGN KEY (patients) | Reference to patient |
| doctor_id | uuid | YES | NULL | FOREIGN KEY (users) | Reference to doctor |
| date | date | NO | NULL |  | Appointment date |
| time | time | NO | NULL |  | Appointment time |
| duration | integer | NO | 30 |  | Duration in minutes |
| type | text | NO | NULL |  | Appointment type |
| status | text | NO | NULL |  | Appointment status |
| notes | text | YES | NULL |  | Additional notes |
| practice_id | uuid | YES | NULL | FOREIGN KEY (practices) | Reference to practice |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### appointment_analytics (View)
**Description:** Aggregated appointment analytics by practice and date

| Field | Data Type | Description |
|-------|-----------|-------------|
| practice_id | uuid | Practice identifier |
| practice_name | varchar(255) | Practice name |
| date | date | Analytics date |
| total_appointments | bigint | Total appointments count |
| completed_appointments | bigint | Completed count |
| cancelled_appointments | bigint | Cancelled count |
| no_show_appointments | bigint | No-show count |
| ready_appointments | bigint | Ready status count |
| avg_duration_minutes | numeric | Average duration |
| completion_rate | numeric | Completion percentage |
| peak_hour | numeric | Busiest hour of day |

### encounters_view (View)
**Description:** Enriched view of visits with patient and practice details

| Field | Data Type | Description |
|-------|-----------|-------------|
| (Multiple fields from visits table joined with patient and practice data) | Various | Comprehensive encounter information |

---

## Financial/Billing Tables

### invoices_enhanced
**Description:** Enhanced invoice management for patient billing

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| invoice_number | text | NO | NULL | UNIQUE | Unique invoice number |
| patient_id | uuid | NO | NULL | FOREIGN KEY (patients) | Reference to patient |
| visit_id | uuid | NO | NULL | FOREIGN KEY (visits) | Reference to visit |
| practice_id | uuid | YES | NULL | FOREIGN KEY (practices) | Reference to practice |
| issue_date | date | YES | CURRENT_DATE |  | Invoice issue date |
| due_date | date | NO | NULL |  | Payment due date |
| subtotal | numeric(10,2) | YES | 0 |  | Subtotal amount |
| tax | numeric(10,2) | YES | 0 |  | Tax amount |
| total | numeric(10,2) | YES | 0 |  | Total amount |
| medical_aid_total | numeric(10,2) | YES | 0 |  | Medical aid portion |
| patient_total | numeric(10,2) | YES | 0 |  | Patient portion |
| payment_status | text | YES | 'pending' |  | Payment status |
| payment_method | text | YES | NULL |  | Payment method |
| medical_aid_claim_number | text | YES | NULL |  | Medical aid claim reference |
| medical_aid_status | text | YES | NULL |  | Medical aid claim status |
| notes | text | YES | NULL |  | Additional notes |
| batch_id | uuid | YES | NULL | FOREIGN KEY (batch_headers) | Reference to batch submission |
| practitioner_id | uuid | YES | NULL | FOREIGN KEY (users) | Treating practitioner |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### invoice_services
**Description:** Line items for services on invoices

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| invoice_id | uuid | NO | NULL | FOREIGN KEY (invoices_enhanced) | Reference to invoice |
| tariff_id | uuid | YES | NULL |  | Reference to tariff |
| code | text | NO | NULL |  | Service/tariff code |
| description | text | NO | NULL |  | Service description |
| quantity | integer | YES | 1 |  | Quantity |
| unit_price | numeric(10,2) | NO | NULL |  | Unit price |
| total_price | numeric(10,2) | NO | NULL |  | Total price |
| medical_aid_covered | numeric(10,2) | YES | 0 |  | Medical aid coverage |
| patient_portion | numeric(10,2) | NO | NULL |  | Patient responsibility |
| notes | text | YES | NULL |  | Service notes |
| system_transaction_number | integer | NO | NULL |  | System transaction ID |
| tooth_number | text | YES | NULL |  | Dental tooth number |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### batch_headers
**Description:** Medical aid batch submission headers

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | YES | NULL | FOREIGN KEY (practices), UNIQUE* | Reference to practice |
| practice_number | varchar(15) | NO | NULL |  | Practice number |
| system_identification | integer | YES | 1 |  | System ID |
| transaction_type | char(1) | YES | 'D' |  | Transaction type |
| batch_number | integer | NO | NULL | UNIQUE* | Batch sequence number |
| batch_date | date | NO | NULL | UNIQUE* | Batch creation date |
| source_software | varchar(50) | YES | 'OneHealth' |  | Source software name |
| source_software_version | varchar(10) | YES | '2.1' |  | Software version |
| medical_aid_reference | varchar(10) | NO | NULL | UNIQUE* | Medical aid code |
| total_invoices | integer | YES | 0 |  | Total invoice count |
| total_amount | numeric(10,2) | YES | 0.00 |  | Total batch amount |
| status | varchar(20) | YES | 'active' |  | Batch status |
| sent_at | timestamp with time zone | YES | NULL |  | Submission timestamp |
| confirmed_at | timestamp with time zone | YES | NULL |  | Confirmation timestamp |
| recipient_email | varchar(255) | YES | NULL |  | Recipient email |
| generated_file_content | text | YES | NULL |  | Generated EDI content |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

*UNIQUE constraint is composite on (practice_id, medical_aid_reference, batch_date, batch_number)

### batch_details
**Description:** Detailed line items for medical aid batch submissions (EDI format)

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| batch_header_id | uuid | YES | NULL | FOREIGN KEY (batch_headers) | Reference to batch header |
| invoice_id | uuid | YES | NULL |  | Reference to invoice |
| patient_id | uuid | YES | NULL | FOREIGN KEY (patients) | Reference to patient |
| visit_id | uuid | YES | NULL | FOREIGN KEY (visits) | Reference to visit |
| visit_service_id | uuid | YES | NULL |  | Reference to visit service |
| transaction_id | char(1) | YES | 'D' |  | Transaction identifier |
| transaction_number_in_batch | integer | NO | NULL |  | Sequence in batch |
| system_transaction_number | integer | YES | NULL |  | System transaction ID |
| system_patient_reference_number | text | YES | NULL |  | Patient reference |
| type_of_service | char(1) | YES | 'T' |  | Service type |
| medical_aid_reference | varchar(10) | NO | NULL |  | Medical aid code |
| medical_aid_membership_number | varchar(20) | YES | NULL |  | Membership number |
| member_surname | varchar(50) | YES | NULL |  | Member surname |
| member_initials | varchar(10) | YES | NULL |  | Member initials |
| patient_name | varchar(100) | YES | NULL |  | Patient full name |
| patient_date_of_birth | text | YES | NULL |  | Patient DOB |
| patient_id_number | varchar(20) | NO | NULL |  | Patient ID number |
| gender | char(1) | NO | NULL |  | Patient gender |
| bhf_tariff_code | varchar(10) | NO | NULL |  | BHF tariff code |
| tariff_code_type | char(1) | YES | 'T' |  | Tariff code type |
| service_amount | numeric(10,2) | NO | NULL |  | Service amount |
| discount_amount | numeric(10,2) | YES | 0.00 |  | Discount amount |
| service_date | text | NO | NULL |  | Service date |
| service_time | time | YES | NULL |  | Service time |
| number_of_services | numeric(5,2) | YES | 1.00 |  | Service quantity |
| service_fee | integer | YES | 7 |  | Service fee code |
| diagnosis | text | YES | NULL |  | Diagnosis text |
| diagnostic_code | varchar(20) | YES | '' |  | ICD code |
| diagnostic_code_type | varchar(10) | YES | '' |  | ICD code type |
| invoice_number | varchar(20) | NO | NULL |  | Invoice number |
| practice_number | varchar(15) | NO | NULL |  | Practice number |
| treating_doctor_hpcsa_number | varchar(20) | YES | NULL |  | Doctor HPCSA number |
| referring_doctor | varchar(50) | YES | '' |  | Referring doctor |
| referring_doctor_2 | varchar(50) | YES | '' |  | Second referring doctor |
| referred_to_practice_number | varchar(15) | YES | '' |  | Referral practice |
| hospital_indicator | varchar(10) | YES | '' |  | Hospital indicator |
| authorisation_number | varchar(20) | YES | '' |  | Auth number |
| resubmission_flag | varchar(10) | YES | '' |  | Resubmission flag |
| modifier_1 | varchar(10) | YES | '' |  | Modifier 1 |
| modifier_2 | varchar(10) | YES | '' |  | Modifier 2 |
| modifier_3 | varchar(10) | YES | '' |  | Modifier 3 |
| modifier_4 | varchar(10) | YES | '' |  | Modifier 4 |
| nappi_code | varchar(20) | YES | '' |  | NAPPI code |
| cpt_cdt_code | varchar(20) | YES | '' |  | CPT/CDT code |
| tooth_numbers | varchar(50) | YES | '' |  | Tooth numbers |
| dosage_description | text | YES | '' |  | Dosage description |
| free_text | text | YES | '' |  | Free text field |
| place_of_service | varchar(20) | YES | '' |  | Service location |
| tracking_number | varchar(30) | YES | '' |  | Tracking number |
| reading_additions | varchar(100) | YES | '' |  | Reading additions |
| lens_prescription | varchar(100) | YES | '' |  | Lens prescription |
| density_of_tint | varchar(50) | YES | '' |  | Tint density |
| employer_name | varchar(100) | YES | '' |  | Employer name |
| employee_number | varchar(50) | YES | '' |  | Employee number |
| date_of_injury | date | YES | NULL |  | Injury date |
| iod_reference_number | varchar(30) | YES | '' |  | IOD reference |
| not_used_1 | varchar(10) | YES | '' |  | Reserved field 1 |
| not_used_2 | varchar(10) | YES | '' |  | Reserved field 2 |
| not_used_3 | varchar(10) | YES | '' |  | Reserved field 3 |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### batch_trailer
**Description:** Batch submission trailer records

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| batch_header_id | uuid | YES | NULL | FOREIGN KEY (batch_headers), UNIQUE | Reference to batch header |
| trailer_identifier | char(1) | YES | 'Z' |  | Trailer identifier |
| total_detail_transactions | integer | NO | NULL |  | Total transaction count |
| total_amount_detail_transactions | numeric(12,2) | NO | NULL |  | Total amount |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### batch_submissions
**Description:** Batch submission tracking and delivery

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| batch_header_id | uuid | NO | NULL | FOREIGN KEY (batch_headers) | Reference to batch |
| file_name | text | NO | NULL |  | Generated file name |
| file_size | integer | NO | NULL |  | File size in bytes |
| file_content_compressed | bytea | YES | NULL |  | Compressed file content |
| file_format | text | NO | 'EDI' |  | File format |
| recipient_email | text | NO | NULL |  | Recipient email |
| sender_email | text | YES | NULL |  | Sender email |
| email_service | text | YES | 'resend' |  | Email service used |
| email_id | text | YES | NULL |  | Email service ID |
| email_subject | text | YES | NULL |  | Email subject |
| status | text | NO | 'pending' |  | Submission status |
| submission_attempt | integer | YES | 1 |  | Attempt number |
| max_attempts | integer | YES | 3 |  | Maximum attempts |
| delivery_confirmation | jsonb | YES | NULL |  | Delivery details |
| error_details | jsonb | YES | NULL |  | Error information |
| provider_response | jsonb | YES | NULL |  | Provider response |
| submitted_at | timestamp with time zone | NO | now() |  | Submission time |
| sent_at | timestamp with time zone | YES | NULL |  | Send timestamp |
| delivered_at | timestamp with time zone | YES | NULL |  | Delivery timestamp |
| confirmed_at | timestamp with time zone | YES | NULL |  | Confirmation time |
| submitted_by | uuid | YES | NULL | FOREIGN KEY (users) | Submitting user |
| practice_id | uuid | YES | NULL |  | Practice reference |
| medical_aid_reference | text | YES | NULL |  | Medical aid code |
| total_claims | integer | YES | NULL |  | Total claims count |
| total_amount | numeric(10,2) | YES | NULL |  | Total amount |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### practice_expenses
**Description:** Practice expense tracking

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | NO | NULL | FOREIGN KEY (practices) | Reference to practice |
| branch_id | uuid | YES | NULL | FOREIGN KEY (branches) | Reference to branch |
| expense_type | varchar(50) | NO | NULL |  | Expense type |
| expense_category | varchar(50) | NO | NULL |  | Expense category |
| name | varchar(255) | NO | NULL |  | Expense name |
| description | text | YES | NULL |  | Description |
| amount | numeric(12,2) | NO | NULL |  | Amount |
| currency | varchar(3) | YES | 'NAD' |  | Currency code |
| payment_method | varchar(50) | YES | NULL |  | Payment method |
| payment_frequency | varchar(50) | YES | NULL |  | Payment frequency |
| vendor_name | varchar(255) | YES | NULL |  | Vendor name |
| vendor_contact | varchar(255) | YES | NULL |  | Vendor contact |
| account_number | varchar(100) | YES | NULL |  | Account number |
| expense_date | date | NO | NULL |  | Expense date |
| due_date | date | YES | NULL |  | Due date |
| paid_date | date | YES | NULL |  | Payment date |
| next_payment_date | date | YES | NULL |  | Next payment date |
| status | varchar(20) | YES | 'pending' |  | Expense status |
| is_recurring | boolean | YES | false |  | Recurring flag |
| is_active | boolean | YES | true |  | Active flag |
| created_by | uuid | YES | NULL | FOREIGN KEY (users) | Created by user |
| updated_by | uuid | YES | NULL | FOREIGN KEY (users) | Updated by user |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### expense_items
**Description:** Line items for practice expenses

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| expense_id | uuid | NO | NULL | FOREIGN KEY (practice_expenses) | Reference to expense |
| item_name | varchar(255) | NO | NULL |  | Item name |
| quantity | numeric(10,2) | YES | 1 |  | Quantity |
| unit_price | numeric(12,2) | NO | NULL |  | Unit price |
| total_amount | numeric(12,2) | YES | NULL |  | Total amount |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### practice_expense_templates
**Description:** Reusable expense templates

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | NO | NULL | FOREIGN KEY (practices) | Reference to practice |
| branch_id | uuid | YES | NULL | FOREIGN KEY (branches) | Reference to branch |
| template_name | varchar(255) | NO | NULL |  | Template name |
| expense_type | varchar(50) | NO | NULL |  | Expense type |
| expense_category | varchar(50) | NO | NULL |  | Expense category |
| description | text | YES | NULL |  | Description |
| default_amount | numeric(12,2) | YES | NULL |  | Default amount |
| currency | varchar(3) | YES | 'NAD' |  | Currency code |
| payment_method | varchar(50) | YES | NULL |  | Payment method |
| payment_frequency | varchar(50) | YES | NULL |  | Payment frequency |
| vendor_name | varchar(255) | YES | NULL |  | Vendor name |
| vendor_contact | varchar(255) | YES | NULL |  | Vendor contact |
| account_number | varchar(100) | YES | NULL |  | Account number |
| is_active | boolean | YES | true |  | Active flag |
| created_by | uuid | YES | NULL | FOREIGN KEY (users) | Created by user |
| updated_by | uuid | YES | NULL | FOREIGN KEY (users) | Updated by user |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

---

## HR/Payroll Tables

### employee_salaries
**Description:** Employee base salary information

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| user_id | uuid | YES | NULL | FOREIGN KEY (users) | Reference to employee |
| basic_salary | numeric(12,2) | NO | NULL |  | Base salary amount |
| currency | text | YES | 'NAD' |  | Currency code |
| effective_from | date | NO | NULL |  | Effective start date |
| effective_to | date | YES | NULL |  | Effective end date |
| is_active | boolean | YES | true |  | Active status |
| created_by | uuid | YES | NULL | FOREIGN KEY (users) | Created by user |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### payslips
**Description:** Monthly payslip records

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| user_id | uuid | YES | NULL | FOREIGN KEY (users), UNIQUE* | Reference to employee |
| pay_period_start | date | NO | NULL | UNIQUE* | Pay period start date |
| pay_period_end | date | NO | NULL | UNIQUE* | Pay period end date |
| payment_date | date | NO | NULL |  | Payment date |
| basic_salary | numeric(12,2) | NO | NULL |  | Base salary amount |
| gross_earnings | numeric(12,2) | NO | NULL |  | Total gross earnings |
| total_deductions | numeric(12,2) | NO | NULL |  | Total deductions |
| net_pay | numeric(12,2) | NO | NULL |  | Net payment amount |
| payment_method | text | YES | NULL |  | Payment method |
| bank_details | jsonb | YES | NULL |  | Bank account details |
| status | text | YES | 'unpaid' |  | Payment status |
| approved_by | uuid | YES | NULL | FOREIGN KEY (users) | Approving manager |
| approved_at | timestamp with time zone | YES | NULL |  | Approval timestamp |
| notes | text | YES | NULL |  | Additional notes |
| ytd_gross_earnings | numeric | YES | 0 |  | Year-to-date gross |
| ytd_total_deductions | numeric | YES | 0 |  | Year-to-date deductions |
| ytd_net_pay | numeric | YES | 0 |  | Year-to-date net pay |
| leave_balances | jsonb | YES | '{}' |  | Leave balance snapshot |
| practice_name | text | YES | NULL |  | Practice name |
| employee_code | text | YES | NULL |  | Employee code |
| earnings_details | jsonb | YES | '[]' |  | Earnings breakdown |
| deductions_details | jsonb | YES | '[]' |  | Deductions breakdown |
| currency | text | YES | 'NAD' |  | Currency code |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

*UNIQUE constraint is composite on (user_id, pay_period_start, pay_period_end)

### payslip_items
**Description:** Line items on payslips

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| payslip_id | uuid | YES | NULL | FOREIGN KEY (payslips) | Reference to payslip |
| component_id | uuid | YES | NULL | FOREIGN KEY (salary_components) | Reference to component |
| component_name | text | NO | NULL |  | Component name |
| type | text | NO | NULL |  | Type (earning/deduction) |
| amount | numeric(12,2) | NO | NULL |  | Amount |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |

### payslip_adjustments
**Description:** Manual payslip adjustments

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| payslip_id | uuid | YES | NULL | FOREIGN KEY (payslips) | Reference to payslip |
| user_id | uuid | YES | NULL | FOREIGN KEY (users), UNIQUE* | Employee reference |
| type | text | YES | NULL |  | Adjustment type |
| component_id | uuid | YES | NULL | UNIQUE* | Component reference |
| name | text | NO | NULL |  | Adjustment name |
| amount | numeric(10,2) | NO | NULL |  | Adjustment amount |
| reason | text | YES | NULL |  | Reason for adjustment |
| month | integer | NO | NULL | UNIQUE* | Month number |
| year | integer | NO | NULL | UNIQUE* | Year |
| is_approved | boolean | YES | false |  | Approval status |
| approved_by | uuid | YES | NULL | FOREIGN KEY (users) | Approving user |
| approved_at | timestamp with time zone | YES | NULL |  | Approval timestamp |
| created_by | uuid | YES | NULL | FOREIGN KEY (users) | Created by user |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

*UNIQUE constraint is composite on (user_id, component_id, month, year)

### salary_components
**Description:** Configurable salary components

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | YES | NULL | FOREIGN KEY (practices), UNIQUE* | Practice reference |
| name | text | NO | NULL | UNIQUE* | Component name |
| type | text | NO | NULL |  | Type (earning/deduction) |
| category | text | NO | NULL |  | Component category |
| is_recurring | boolean | YES | true |  | Recurring flag |
| is_taxable | boolean | YES | true |  | Taxable flag |
| description | text | YES | NULL |  | Description |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

*UNIQUE constraint is composite on (practice_id, name)

### employee_salary_components
**Description:** Employee-specific salary components

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| user_id | uuid | YES | NULL | FOREIGN KEY (users), UNIQUE* | Employee reference |
| component_id | uuid | YES | NULL | FOREIGN KEY (salary_components), UNIQUE* | Component reference |
| amount | numeric(12,2) | NO | NULL |  | Amount |
| percentage | numeric(5,2) | YES | NULL |  | Percentage (if applicable) |
| effective_from | date | NO | NULL | UNIQUE* | Effective start date |
| effective_to | date | YES | NULL |  | Effective end date |
| is_active | boolean | YES | true |  | Active status |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |

*UNIQUE constraint is composite on (user_id, component_id, effective_from)

### employee_salary_configurations
**Description:** Employee benefit and deduction configurations

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| user_id | uuid | YES | NULL | FOREIGN KEY (users) | Employee reference |
| benefit_id | uuid | YES | NULL | FOREIGN KEY (benefits) | Benefit reference |
| deduction_id | uuid | YES | NULL | FOREIGN KEY (deductions) | Deduction reference |
| bonus_configuration_id | uuid | YES | NULL | FOREIGN KEY (bonus_configurations) | Bonus config reference |
| custom_value | numeric | YES | NULL |  | Custom override value |
| is_active | boolean | YES | true |  | Active status |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### benefits
**Description:** Practice-defined benefits

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | YES | NULL | FOREIGN KEY (practices), UNIQUE* | Practice reference |
| name | text | NO | NULL |  | Benefit name |
| code | text | NO | NULL | UNIQUE* | Benefit code |
| type | text | NO | NULL |  | Type (percentage/fixed) |
| value | numeric | NO | NULL |  | Value amount/percentage |
| base_calculation | text | YES | 'basic_salary' |  | Calculation base |
| is_company_contribution | boolean | YES | false |  | Company contribution flag |
| is_active | boolean | YES | true |  | Active status |
| is_recurring | boolean | YES | true |  | Recurring flag |
| description | text | YES | NULL |  | Description |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

*UNIQUE constraint is composite on (practice_id, code)

### deductions
**Description:** Practice-defined deductions

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | YES | NULL | FOREIGN KEY (practices), UNIQUE* | Practice reference |
| name | text | NO | NULL |  | Deduction name |
| code | text | NO | NULL | UNIQUE* | Deduction code |
| type | text | NO | NULL |  | Type (percentage/fixed) |
| value | numeric | NO | NULL |  | Value amount/percentage |
| base_calculation | text | YES | 'basic_salary' |  | Calculation base |
| is_statutory | boolean | YES | false |  | Statutory deduction flag |
| is_active | boolean | YES | true |  | Active status |
| is_recurring | boolean | YES | true |  | Recurring flag |
| description | text | YES | NULL |  | Description |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

*UNIQUE constraint is composite on (practice_id, code)

### timesheets
**Description:** Employee timesheet records

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| user_id | uuid | YES | NULL | FOREIGN KEY (users), UNIQUE* | Employee reference |
| period_start | date | NO | NULL | UNIQUE* | Period start date |
| period_end | date | NO | NULL | UNIQUE* | Period end date |
| total_hours | numeric(5,2) | YES | 0 |  | Total hours worked |
| regular_hours | numeric(5,2) | YES | 0 |  | Regular hours |
| overtime_hours | numeric(5,2) | YES | 0 |  | Overtime hours |
| status | text | YES | 'draft' |  | Timesheet status |
| submitted_at | timestamp with time zone | YES | NULL |  | Submission timestamp |
| approver_id | uuid | YES | NULL | FOREIGN KEY (users) | Approving manager |
| approved_at | timestamp with time zone | YES | NULL |  | Approval timestamp |
| approver_comments | text | YES | NULL |  | Approver comments |
| notes | text | YES | NULL |  | Employee notes |
| pdf_url | text | YES | NULL |  | PDF document URL |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

*UNIQUE constraint is composite on (user_id, period_start, period_end)

### timesheet_entries
**Description:** Daily timesheet entries

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| timesheet_id | uuid | YES | NULL | FOREIGN KEY (timesheets), UNIQUE* | Timesheet reference |
| date | date | NO | NULL | UNIQUE* | Entry date |
| start_time | time | YES | NULL |  | Start time |
| end_time | time | YES | NULL |  | End time |
| break_duration | interval | YES | '00:00:00' |  | Break duration |
| total_hours | numeric(5,2) | NO | NULL |  | Total hours |
| project_code | text | YES | NULL |  | Project code |
| task_description | text | YES | NULL |  | Task description |
| is_overtime | boolean | YES | false |  | Overtime flag |
| is_holiday | boolean | YES | false |  | Holiday flag |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

*UNIQUE constraint is composite on (timesheet_id, date)

### leave_types
**Description:** Practice-defined leave types

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | YES | NULL | FOREIGN KEY (practices), UNIQUE* | Practice reference |
| name | text | NO | NULL |  | Leave type name |
| code | text | NO | NULL | UNIQUE* | Leave type code |
| days_per_year | numeric(5,2) | NO | NULL |  | Annual entitlement |
| is_paid | boolean | YES | true |  | Paid leave flag |
| carryover_allowed | boolean | YES | false |  | Carryover flag |
| max_carryover_days | numeric(5,2) | YES | 0 |  | Max carryover days |
| requires_approval | boolean | YES | true |  | Approval required flag |
| min_notice_days | integer | YES | 1 |  | Minimum notice period |
| supporting_documents_required | boolean | YES | false |  | Documents required flag |
| description | text | YES | NULL |  | Description |
| color | text | YES | '#6B7280' |  | Display color |
| is_active | boolean | YES | true |  | Active status |
| accrual_rate | numeric(10,4) | YES | 0 |  | Accrual rate |
| accrual_frequency | text | YES | 'monthly' |  | Accrual frequency |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

*UNIQUE constraint is composite on (practice_id, code)

### leave_requests
**Description:** Employee leave requests

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| user_id | uuid | YES | NULL | FOREIGN KEY (users) | Employee reference |
| leave_type_id | uuid | YES | NULL | FOREIGN KEY (leave_types) | Leave type reference |
| start_date | date | NO | NULL |  | Leave start date |
| end_date | date | NO | NULL |  | Leave end date |
| days_requested | numeric(5,2) | NO | NULL |  | Days requested |
| reason | text | NO | NULL |  | Leave reason |
| is_half_day | boolean | YES | false |  | Half day flag |
| half_day_period | text | YES | NULL |  | Half day period (AM/PM) |
| status | text | YES | 'pending' |  | Request status |
| approver_id | uuid | YES | NULL | FOREIGN KEY (users) | Approving manager |
| approved_at | timestamp with time zone | YES | NULL |  | Approval timestamp |
| approver_comments | text | YES | NULL |  | Approver comments |
| supporting_document_url | text | YES | NULL |  | Supporting document |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### leave_balances
**Description:** Employee leave balance tracking

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| user_id | uuid | YES | NULL | FOREIGN KEY (users), UNIQUE* | Employee reference |
| leave_type_id | uuid | YES | NULL | FOREIGN KEY (leave_types), UNIQUE* | Leave type reference |
| year | integer | NO | NULL | UNIQUE* | Calendar year |
| entitled_days | numeric(5,2) | NO | NULL |  | Annual entitlement |
| used_days | numeric(5,2) | YES | 0 |  | Days used |
| carried_over_days | numeric(5,2) | YES | 0 |  | Days carried over |
| balance_days | numeric(5,2) | YES | NULL |  | Current balance |
| accrued_this_month | numeric(10,2) | YES | 0 |  | Monthly accrual |
| last_accrual_date | date | YES | NULL |  | Last accrual date |
| total_accrued | numeric(10,2) | YES | 0 |  | Total accrued |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

*UNIQUE constraint is composite on (user_id, leave_type_id, year)

### leave_request_history
**Description:** Leave request audit trail

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| leave_request_id | uuid | YES | NULL | FOREIGN KEY (leave_requests) | Leave request reference |
| action | text | NO | NULL |  | Action taken |
| performed_by | uuid | YES | NULL | FOREIGN KEY (users) | User who performed action |
| comments | text | YES | NULL |  | Action comments |
| old_status | text | YES | NULL |  | Previous status |
| new_status | text | YES | NULL |  | New status |
| created_at | timestamp with time zone | YES | now() |  | Action timestamp |

---

## Communication Tables

### practice_sms_logs
**Description:** Centralized SMS communication logs for practice

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | NO | NULL | FOREIGN KEY (practices) | Practice reference |
| recipient_phone | text | NO | NULL |  | Recipient phone number |
| sender_phone | text | YES | NULL |  | Sender phone number |
| message_content | text | NO | NULL |  | SMS message content |
| message_type | text | NO | NULL |  | Message type category |
| provider | text | NO | 'smsportal' |  | SMS provider |
| provider_message_id | text | YES | NULL |  | Provider's message ID |
| provider_response | jsonb | YES | NULL |  | Provider API response |
| status | text | NO | 'pending' |  | Message status |
| sent_at | timestamp with time zone | YES | NULL |  | Send timestamp |
| delivered_at | timestamp with time zone | YES | NULL |  | Delivery timestamp |
| failed_at | timestamp with time zone | YES | NULL |  | Failure timestamp |
| failure_reason | text | YES | NULL |  | Failure reason |
| cost_units | numeric(10,4) | YES | 0 |  | Cost in units |
| cost_amount | numeric(10,2) | YES | 0 |  | Cost in currency |
| patient_id | uuid | YES | NULL | FOREIGN KEY (patients) | Related patient |
| appointment_id | uuid | YES | NULL | FOREIGN KEY (appointments) | Related appointment |
| visit_id | uuid | YES | NULL | FOREIGN KEY (visits) | Related visit |
| user_id | uuid | YES | NULL | FOREIGN KEY (users) | Sending user |
| metadata | jsonb | YES | '{}' |  | Additional metadata |
| tags | text[] | YES | '{}' |  | Message tags |
| created_at | timestamp with time zone | YES | CURRENT_TIMESTAMP |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | CURRENT_TIMESTAMP |  | Update timestamp |

### practice_sms_subscriptions
**Description:** SMS subscription plans for practices

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | YES | NULL | FOREIGN KEY (practices) | Practice reference |
| plan_id | uuid | YES | NULL | FOREIGN KEY (sms_plans) | SMS plan reference |
| monthly_limit | integer | NO | NULL |  | Monthly SMS limit |
| additional_sms_purchased | integer | YES | 0 |  | Additional SMS units |
| current_usage | integer | YES | 0 |  | Current month usage |
| billing_cycle_start | date | NO | NULL |  | Billing cycle start |
| billing_cycle_end | date | NO | NULL |  | Billing cycle end |
| is_active | boolean | YES | true |  | Active status |
| auto_renew | boolean | YES | true |  | Auto-renewal flag |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### practice_email_logs
**Description:** Centralized email communication logs for practice

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | NO | NULL | FOREIGN KEY (practices) | Practice reference |
| recipient_email | text | NO | NULL |  | Recipient email address |
| recipient_name | text | YES | NULL |  | Recipient name |
| sender_email | text | NO | NULL |  | Sender email address |
| sender_name | text | YES | NULL |  | Sender name |
| subject | text | NO | NULL |  | Email subject |
| html_content | text | YES | NULL |  | HTML email content |
| text_content | text | YES | NULL |  | Plain text content |
| email_type | text | NO | NULL |  | Email type category |
| provider | text | NO | 'resend' |  | Email provider |
| provider_message_id | text | YES | NULL |  | Provider's message ID |
| provider_response | jsonb | YES | NULL |  | Provider API response |
| status | text | NO | 'pending' |  | Email status |
| sent_at | timestamp with time zone | YES | NULL |  | Send timestamp |
| delivered_at | timestamp with time zone | YES | NULL |  | Delivery timestamp |
| opened_at | timestamp with time zone | YES | NULL |  | First open timestamp |
| clicked_at | timestamp with time zone | YES | NULL |  | First click timestamp |
| bounced_at | timestamp with time zone | YES | NULL |  | Bounce timestamp |
| failed_at | timestamp with time zone | YES | NULL |  | Failure timestamp |
| failure_reason | text | YES | NULL |  | Failure reason |
| open_count | integer | YES | 0 |  | Total opens |
| click_count | integer | YES | 0 |  | Total clicks |
| attachments | jsonb | YES | '[]' |  | Attachment details |
| patient_id | uuid | YES | NULL | FOREIGN KEY (patients) | Related patient |
| appointment_id | uuid | YES | NULL | FOREIGN KEY (appointments) | Related appointment |
| visit_id | uuid | YES | NULL | FOREIGN KEY (visits) | Related visit |
| invoice_id | uuid | YES | NULL | FOREIGN KEY (invoices_enhanced) | Related invoice |
| user_id | uuid | YES | NULL | FOREIGN KEY (users) | Sending user |
| metadata | jsonb | YES | '{}' |  | Additional metadata |
| tags | text[] | YES | '{}' |  | Email tags |
| created_at | timestamp with time zone | YES | CURRENT_TIMESTAMP |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | CURRENT_TIMESTAMP |  | Update timestamp |

### practice_email_subscriptions
**Description:** Email subscription plans for practices

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | YES | NULL | FOREIGN KEY (practices), UNIQUE* | Practice reference |
| plan_id | uuid | YES | NULL | FOREIGN KEY (email_plans), UNIQUE* | Email plan reference |
| monthly_limit | integer | NO | NULL |  | Monthly email limit |
| current_usage | integer | YES | 0 |  | Current month usage |
| additional_emails_purchased | integer | YES | 0 |  | Additional email units |
| billing_cycle_start | date | NO | NULL |  | Billing cycle start |
| billing_cycle_end | date | NO | NULL |  | Billing cycle end |
| auto_renew | boolean | YES | true |  | Auto-renewal flag |
| is_active | boolean | YES | true |  | Active status |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

*UNIQUE constraint is composite on (practice_id, plan_id)

### communications_log
**Description:** Generic communication log for all channels

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | NO | NULL | FOREIGN KEY (practices) | Practice reference |
| communication_type | text | NO | NULL |  | Type of communication |
| channel | text | YES | NULL |  | Communication channel |
| recipient_type | text | YES | NULL |  | Recipient type |
| recipient_id | uuid | YES | NULL |  | Recipient ID |
| recipient_name | text | YES | NULL |  | Recipient name |
| recipient_contact | text | YES | NULL |  | Contact details |
| subject | text | YES | NULL |  | Message subject |
| message | text | YES | NULL |  | Message content |
| status | text | YES | 'pending' |  | Communication status |
| metadata | jsonb | YES | '{}' |  | Additional metadata |
| cost | numeric(10,4) | YES | 0 |  | Communication cost |
| provider | text | YES | NULL |  | Service provider |
| provider_message_id | text | YES | NULL |  | Provider message ID |
| error_message | text | YES | NULL |  | Error details |
| created_by | uuid | YES | NULL | FOREIGN KEY (users) | Created by user |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| delivered_at | timestamp with time zone | YES | NULL |  | Delivery timestamp |
| read_at | timestamp with time zone | YES | NULL |  | Read timestamp |

### messages
**Description:** Message queue for scheduled communications

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| type | text | NO | NULL |  | Message type (sms/email) |
| template_id | uuid | YES | NULL | FOREIGN KEY (message_templates) | Template reference |
| recipient | text | NO | NULL |  | Recipient contact |
| subject | text | YES | NULL |  | Message subject |
| content | text | NO | NULL |  | Message content |
| status | text | NO | 'pending' |  | Message status |
| scheduled_for | timestamp with time zone | YES | NULL |  | Scheduled send time |
| sent_at | timestamp with time zone | YES | NULL |  | Actual send time |
| error | text | YES | NULL |  | Error message |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### message_templates
**Description:** Reusable message templates

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| name | text | NO | NULL |  | Template name |
| type | text | NO | NULL |  | Template type (sms/email) |
| subject | text | YES | NULL |  | Email subject template |
| content | text | NO | NULL |  | Message content template |
| variables | jsonb | YES | '{}' |  | Template variables |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### sms_templates
**Description:** SMS-specific templates

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | YES | NULL | FOREIGN KEY (practices) | Practice reference |
| name | text | NO | NULL |  | Template name |
| template_type | text | YES | NULL |  | Template category |
| content | text | NO | NULL |  | SMS content template |
| variables | jsonb | YES | '[]' |  | Template variables |
| is_default | boolean | YES | false |  | Default template flag |
| is_active | boolean | YES | true |  | Active status |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### sms_logs (Legacy)
**Description:** Legacy SMS log table (being phased out)

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | YES | NULL | FOREIGN KEY (practices) | Practice reference |
| recipient_phone | text | NO | NULL |  | Recipient phone |
| message_content | text | NO | NULL |  | Message content |
| status | text | YES | 'pending' |  | Message status |
| sent_at | timestamp with time zone | YES | now() |  | Send timestamp |
| delivered_at | timestamp with time zone | YES | NULL |  | Delivery timestamp |
| error_message | text | YES | NULL |  | Error details |
| cost | numeric(10,4) | YES | NULL |  | Message cost |
| message_id | text | YES | NULL |  | Message ID |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |

### sms_analytics (View)
**Description:** SMS usage analytics by practice

| Field | Data Type | Description |
|-------|-----------|-------------|
| practice_id | uuid | Practice identifier |
| practice_name | varchar(255) | Practice name |
| date | date | Analytics date |
| sms_sent | bigint | Total SMS sent |
| sms_delivered | bigint | Total delivered |
| sms_failed | bigint | Total failed |
| daily_sms_cost | numeric | Daily cost |
| delivery_rate | numeric | Delivery percentage |
| message_types | text | Message type breakdown |
| monthly_limit | integer | Monthly limit |
| current_usage | integer | Current usage |
| usage_percentage | numeric | Usage percentage |

### email_analytics
**Description:** Email usage analytics

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | YES | NULL | FOREIGN KEY (practices) | Practice reference |
| sent_count | integer | YES | 0 |  | Emails sent |
| delivered_count | integer | YES | 0 |  | Emails delivered |
| failed_count | integer | YES | 0 |  | Emails failed |
| opened_count | integer | YES | 0 |  | Emails opened |
| clicked_count | integer | YES | 0 |  | Links clicked |
| period_start | date | NO | NULL |  | Period start date |
| period_end | date | NO | NULL |  | Period end date |
| period_type | varchar(20) | YES | 'daily' |  | Period type |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |

---

## Practice Management Tables

### practices
**Description:** Main practice/clinic entity table for multi-tenant support

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| name | varchar(255) | NO | NULL |  | Practice name |
| practice_number | varchar(50) | YES | NULL |  | Official practice number |
| vat_number | varchar(50) | YES | NULL |  | VAT registration number |
| contact_phone | varchar(20) | YES | NULL |  | Primary phone number |
| contact_email | varchar(255) | YES | NULL |  | Primary email address |
| address | text | YES | NULL |  | Physical address |
| postal_address | text | YES | NULL |  | Postal address |
| website_url | varchar(255) | YES | NULL |  | Practice website |
| logo_url | varchar(255) | YES | NULL |  | Logo image URL |
| practice_type_id | uuid | YES | NULL | FOREIGN KEY (practice_types) | Practice type reference |
| is_active | boolean | YES | true |  | Active status |
| subscription_tier | varchar(50) | YES | 'basic' |  | Subscription level |
| subscription_expires_at | timestamp with time zone | YES | NULL |  | Subscription expiry |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |
| domain | varchar(255) | YES | NULL | UNIQUE | Custom domain |
| onboarding_completed | boolean | YES | false |  | Onboarding status |
| trial_ends_at | timestamp with time zone | YES | NULL |  | Trial period end |

### branches
**Description:** Practice branch locations

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | NO | NULL | FOREIGN KEY (practices) | Practice reference |
| name | varchar(255) | NO | NULL |  | Branch name |
| branch_code | varchar(50) | YES | NULL |  | Branch code |
| contact_phone | varchar(20) | YES | NULL |  | Branch phone |
| contact_email | varchar(255) | YES | NULL |  | Branch email |
| address | text | YES | NULL |  | Physical address |
| is_main_branch | boolean | YES | false |  | Main branch flag |
| is_active | boolean | YES | true |  | Active status |
| operating_hours | jsonb | YES | NULL |  | Operating hours JSON |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### practice_settings
**Description:** Practice-specific configuration and settings

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | NO | NULL | FOREIGN KEY (practices), UNIQUE | Practice reference |
| appointment_duration | integer | YES | 30 |  | Default appointment duration (minutes) |
| working_days | jsonb | YES | '["Monday","Tuesday","Wednesday","Thursday","Friday"]' |  | Working days array |
| business_hours | jsonb | YES | '{"start":"08:00","end":"17:00"}' |  | Business hours JSON |
| allow_online_booking | boolean | YES | true |  | Online booking enabled |
| booking_lead_time | integer | YES | 24 |  | Minimum booking lead time (hours) |
| max_advance_booking | integer | YES | 90 |  | Maximum advance booking (days) |
| currency | varchar(3) | YES | 'NAD' |  | Default currency |
| tax_rate | numeric(5,2) | YES | 15.00 |  | Default tax rate |
| invoice_prefix | varchar(10) | YES | 'INV' |  | Invoice number prefix |
| invoice_footer | text | YES | NULL |  | Invoice footer text |
| reminder_settings | jsonb | YES | NULL |  | Appointment reminder settings |
| notification_settings | jsonb | YES | NULL |  | Notification preferences |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### practice_types
**Description:** Reference table for practice types/specialties

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| name | varchar(100) | NO | NULL | UNIQUE | Practice type name |
| description | text | YES | NULL |  | Description |
| icon | varchar(50) | YES | NULL |  | Icon identifier |
| is_active | boolean | YES | true |  | Active status |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |

### practice_features
**Description:** Feature flags and settings per practice

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | NO | NULL | FOREIGN KEY (practices) | Practice reference |
| feature_name | varchar(100) | NO | NULL |  | Feature identifier |
| is_enabled | boolean | YES | false |  | Feature enabled flag |
| configuration | jsonb | YES | NULL |  | Feature configuration |
| enabled_at | timestamp with time zone | YES | NULL |  | When feature was enabled |
| disabled_at | timestamp with time zone | YES | NULL |  | When feature was disabled |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

*UNIQUE constraint is composite on (practice_id, feature_name)

### practice_tariffs
**Description:** Practice-specific service tariffs and pricing

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | NO | NULL | FOREIGN KEY (practices) | Practice reference |
| service_code | varchar(50) | NO | NULL |  | Service/tariff code |
| service_name | varchar(255) | NO | NULL |  | Service name |
| description | text | YES | NULL |  | Service description |
| category | varchar(100) | YES | NULL |  | Service category |
| unit_price | numeric(12,2) | NO | NULL |  | Base price |
| medical_aid_price | numeric(12,2) | YES | NULL |  | Medical aid price |
| is_active | boolean | YES | true |  | Active status |
| effective_from | date | YES | NULL |  | Effective start date |
| effective_to | date | YES | NULL |  | Effective end date |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

*UNIQUE constraint is composite on (practice_id, service_code)

### practice_invitations
**Description:** Invitations for staff to join practices

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | NO | NULL | FOREIGN KEY (practices) | Practice reference |
| email | varchar(255) | NO | NULL |  | Invitee email |
| role | varchar(50) | NO | NULL |  | Assigned role |
| token | varchar(255) | NO | NULL | UNIQUE | Invitation token |
| expires_at | timestamp with time zone | NO | NULL |  | Expiration timestamp |
| accepted_at | timestamp with time zone | YES | NULL |  | Acceptance timestamp |
| rejected_at | timestamp with time zone | YES | NULL |  | Rejection timestamp |
| invited_by | uuid | YES | NULL | FOREIGN KEY (users) | Inviting user |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |

### practice_documents
**Description:** Practice documents and files storage

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | NO | NULL | FOREIGN KEY (practices) | Practice reference |
| document_type | varchar(50) | NO | NULL |  | Document type |
| document_name | varchar(255) | NO | NULL |  | Document name |
| file_url | text | NO | NULL |  | File storage URL |
| file_size | integer | YES | NULL |  | File size in bytes |
| mime_type | varchar(100) | YES | NULL |  | MIME type |
| description | text | YES | NULL |  | Description |
| tags | text[] | YES | NULL |  | Document tags |
| uploaded_by | uuid | YES | NULL | FOREIGN KEY (users) | Uploading user |
| is_public | boolean | YES | false |  | Public access flag |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### doctor_branch_schedules
**Description:** Doctor schedules per branch location

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| doctor_id | uuid | NO | NULL | FOREIGN KEY (users) | Doctor reference |
| branch_id | uuid | NO | NULL | FOREIGN KEY (branches) | Branch reference |
| day_of_week | integer | NO | NULL |  | Day of week (0-6) |
| start_time | time without time zone | NO | NULL |  | Start time |
| end_time | time without time zone | NO | NULL |  | End time |
| is_active | boolean | YES | true |  | Active status |
| effective_from | date | YES | NULL |  | Schedule start date |
| effective_to | date | YES | NULL |  | Schedule end date |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

*UNIQUE constraint is composite on (doctor_id, branch_id, day_of_week)

### practice_service_subscriptions
**Description:** Practice subscriptions to various services

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | NO | NULL | FOREIGN KEY (practices) | Practice reference |
| service_type | varchar(50) | NO | NULL |  | Service type (sms, email, etc) |
| plan_id | uuid | YES | NULL |  | Reference to service plan |
| status | varchar(20) | YES | 'active' |  | Subscription status |
| monthly_limit | integer | YES | NULL |  | Monthly usage limit |
| current_usage | integer | YES | 0 |  | Current month usage |
| reset_date | date | YES | NULL |  | Usage reset date |
| expires_at | timestamp with time zone | YES | NULL |  | Subscription expiry |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

*UNIQUE constraint is composite on (practice_id, service_type)

### service_plans
**Description:** Available service plans for practices

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| name | varchar(100) | NO | NULL |  | Plan name |
| service_type | varchar(50) | NO | NULL |  | Service type |
| monthly_limit | integer | YES | NULL |  | Monthly limit |
| price | numeric(10,2) | NO | NULL |  | Monthly price |
| features | jsonb | YES | NULL |  | Plan features |
| is_active | boolean | YES | true |  | Active status |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |

### email_plans
**Description:** Email service plan definitions

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| name | varchar(100) | NO | NULL |  | Plan name |
| monthly_limit | integer | NO | NULL |  | Monthly email limit |
| price | numeric(10,2) | NO | NULL |  | Monthly price |
| features | jsonb | YES | NULL |  | Plan features JSON |
| is_active | boolean | YES | true |  | Active status |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### sms_plans
**Description:** SMS service plan definitions

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| name | varchar(100) | NO | NULL |  | Plan name |
| monthly_limit | integer | NO | NULL |  | Monthly SMS limit |
| price | numeric(10,2) | NO | NULL |  | Monthly price |
| features | jsonb | YES | NULL |  | Plan features JSON |
| is_active | boolean | YES | true |  | Active status |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

---

## User & Authentication Tables

### users
**Description:** Main user accounts table containing all system users (staff, doctors, admins)

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| email | text | NO | NULL | UNIQUE | User email address |
| full_name | text | NO | NULL |  | User's full name |
| role | text | NO | NULL |  | User role (admin, doctor, nurse, receptionist, etc.) |
| created_at | timestamp with time zone | YES | now() |  | Account creation timestamp |
| last_login | timestamp with time zone | YES | NULL |  | Last login timestamp |
| avatar | text | YES | NULL |  | Avatar URL |
| practice_id | uuid | YES | NULL | FOREIGN KEY (practices) | Associated practice |
| is_super_admin | boolean | YES | false |  | Super admin flag |
| can_manage_practices | boolean | YES | false |  | Practice management permission |
| permissions | jsonb | YES | '{}' |  | Custom permissions JSON |
| last_active_at | timestamp with time zone | YES | NULL |  | Last activity timestamp |
| hpcsa_number | text | YES | NULL |  | Healthcare professional council number |
| branch_id | uuid | YES | NULL | FOREIGN KEY (branches) | Primary branch |
| allowed_branches | uuid[] | YES | '{}' |  | Array of allowed branch IDs |
| job_title | text | YES | NULL |  | Job title |
| start_date | date | YES | NULL |  | Employment start date |
| reporting_manager_id | uuid | YES | NULL | FOREIGN KEY (users) | Manager reference |
| contact_number | text | YES | NULL |  | Contact phone |
| address | text | YES | NULL |  | Physical address |
| is_active | boolean | YES | true |  | Active status |
| department | text | YES | NULL |  | Department name |
| employee_number | text | YES | NULL | UNIQUE | Employee ID |
| updated_at | timestamp with time zone | YES | now() |  | Last update timestamp |
| bank_name | text | YES | NULL |  | Bank name |
| account_number | text | YES | NULL |  | Bank account number |
| branch_code | text | YES | NULL |  | Bank branch code |
| swift_code | text | YES | NULL |  | SWIFT code |
| account_type | text | YES | NULL |  | Account type |
| staff_title | text | YES | NULL |  | Professional title |
| gender | text | YES | NULL |  | Gender |

---

## Audit & Logging Tables

### hr_audit_logs
**Description:** Audit trail for HR-related changes and actions

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| table_name | text | NO | NULL |  | Target table name |
| record_id | uuid | NO | NULL |  | Target record ID |
| action | text | NO | NULL |  | Action type (insert, update, delete) |
| performed_by | uuid | YES | NULL | FOREIGN KEY (users) | User who performed action |
| old_values | jsonb | YES | NULL |  | Previous values JSON |
| new_values | jsonb | YES | NULL |  | New values JSON |
| ip_address | inet | YES | NULL |  | Client IP address |
| user_agent | text | YES | NULL |  | Browser user agent |
| created_at | timestamp with time zone | YES | now() |  | Action timestamp |

### system_logs
**Description:** General system event logging

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| event_type | varchar(100) | YES | NULL |  | Event category |
| details | text | YES | NULL |  | Event details |
| created_at | timestamp with time zone | YES | now() |  | Event timestamp |

---

## System Configuration Tables

### follow_up_templates
**Description:** Templates for automated follow-up scheduling

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | uuid_generate_v4() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | NO | NULL | FOREIGN KEY (practices) | Practice reference |
| template_name | text | NO | NULL |  | Template name |
| trigger_type | text | NO | NULL |  | Trigger type (visit_type, diagnosis, etc.) |
| trigger_value | text | NO | NULL |  | Trigger value to match |
| steps | jsonb | NO | NULL |  | Follow-up steps configuration |
| is_active | boolean | NO | false |  | Active status |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

---

## Analytics & Reporting Views

### admin_practice_overview (View)
**Description:** Administrative overview of all practices in the system

### appointment_analytics (View)
**Description:** Appointment statistics and analytics

### automation_queue_dashboard (View)
**Description:** Dashboard view of automation queue status

### batch_submission_summary (View)
**Description:** Summary of medical aid batch submissions

### financial_dashboard_fast (View)
**Description:** Optimized financial dashboard metrics

### follow_up_automation_log_summary (View)
**Description:** Summary of follow-up automation activities

### monthly_revenue_summary (View)
**Description:** Monthly revenue aggregation and trends

### payment_status_analytics (View)
**Description:** Payment status distribution and analytics

### practice_automation_queue_stats (View)
**Description:** Practice-specific automation queue statistics

### practice_performance_dashboard (View)
**Description:** Key performance indicators per practice

### service_performance_summary (View)
**Description:** Service utilization and performance metrics

### sms_analytics (View)
**Description:** SMS usage analytics and delivery statistics

---

## Automation Tables

### follow_up_automation_queue
**Description:** Queue for processing automated follow-up scheduling

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| visit_id | uuid | NO | NULL | FOREIGN KEY (visits) | Visit reference |
| practice_id | uuid | NO | NULL | FOREIGN KEY (practices) | Practice reference |
| status | text | NO | 'pending' |  | Queue status (pending, processed, failed) |
| created_at | timestamp with time zone | YES | now() |  | Queue entry timestamp |
| processed_at | timestamp with time zone | YES | NULL |  | Processing timestamp |
| error_message | text | YES | NULL |  | Error details if failed |
| result | jsonb | YES | NULL |  | Processing result JSON |

---

## Additional System Tables

### ai_insights
**Description:** AI-generated practice insights and analytics

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | NO | NULL | FOREIGN KEY (practices) | Practice reference |
| insights | jsonb | NO | NULL |  | AI-generated insights JSON |
| generated_at | timestamp with time zone | NO | now() |  | Generation timestamp |
| period_start | timestamp with time zone | NO | NULL |  | Analysis period start |
| period_end | timestamp with time zone | NO | NULL |  | Analysis period end |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### automation_settings
**Description:** Configuration for practice automation rules

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| practice_id | uuid | NO | NULL | FOREIGN KEY (practices) | Practice reference |
| automation_id | text | NO | NULL |  | Automation identifier |
| name | text | NO | NULL |  | Automation name |
| description | text | YES | NULL |  | Description |
| category | text | YES | NULL |  | Automation category |
| icon | text | YES | NULL |  | Icon identifier |
| is_active | boolean | YES | false |  | Active status |
| channels | jsonb | YES | '[]' |  | Communication channels |
| timings | jsonb | YES | '[]' |  | Timing configuration |
| sms_template | jsonb | YES | '{}' |  | SMS template settings |
| email_template | jsonb | YES | '{}' |  | Email template settings |
| variables | jsonb | YES | '[]' |  | Available variables |
| trigger_config | jsonb | YES | '{}' |  | Trigger configuration |
| conditions | jsonb | YES | '{}' |  | Condition rules |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |
| created_by | uuid | YES | NULL | FOREIGN KEY (users) | Created by user |

*UNIQUE constraint is composite on (practice_id, automation_id)

### medical_aid_service_prices
**Description:** Medical aid-specific service pricing

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| provider_id | uuid | YES | NULL | FOREIGN KEY (medical_aid_providers) | Provider reference |
| scheme_id | uuid | YES | NULL | FOREIGN KEY (medical_aid_schemes) | Scheme reference |
| service_name | text | NO | NULL |  | Service name |
| service_code | text | YES | NULL |  | Service code |
| category | text | YES | NULL |  | Service category |
| base_price | numeric(10,2) | YES | NULL |  | Base price |
| covered_amount | numeric(10,2) | YES | NULL |  | Amount covered by medical aid |
| patient_copay_percentage | numeric(5,2) | YES | NULL |  | Patient co-payment percentage |
| requires_preauth | boolean | YES | false |  | Pre-authorization required |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |

### suburbs
**Description:** Geographic suburb/area reference data

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| suburb_name | varchar(255) | NO | NULL |  | Suburb name |
| city | varchar(255) | NO | NULL |  | City name |
| region | varchar(255) | YES | NULL |  | Region/state |
| country | varchar(100) | YES | 'Namibia' |  | Country |
| postal_codes | text[] | YES | NULL |  | Array of postal codes |
| coordinates | point | YES | NULL |  | Geographic coordinates |
| aliases | text[] | YES | NULL |  | Alternative names |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

### system_config
**Description:** System-wide configuration settings

| Field | Data Type | Nullable | Default | Constraints | Description |
|-------|-----------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PRIMARY KEY | Unique identifier |
| config_key | varchar(100) | NO | NULL | UNIQUE | Configuration key |
| config_value | jsonb | NO | NULL |  | Configuration value |
| config_type | varchar(50) | YES | 'general' |  | Configuration type |
| description | text | YES | NULL |  | Description |
| is_public | boolean | YES | false |  | Public visibility |
| created_at | timestamp with time zone | YES | now() |  | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() |  | Update timestamp |

---

## Summary of Additional Tables

The HPMS database contains numerous additional tables that support various specialized functions. Below is a categorized summary of these tables:

### Admin & Security Tables
- **admin_users**: Administrative user accounts
- **admin_roles**: Administrative role definitions
- **admin_sessions**: Admin session tracking
- **admin_audit_logs**: Administrative action audit trail
- **audit_logs**: General audit logging
- **user_profiles**: Extended user profile information
- **user_practice_assignments**: User-to-practice assignments

### Internal Messaging & Collaboration
- **internal_messages**: Internal messaging system
- **internal_message_channels**: Message channels
- **internal_message_threads**: Message threading
- **internal_message_attachments**: Message attachments
- **internal_message_reactions**: Message reactions
- **internal_message_read_receipts**: Read receipt tracking
- **internal_channel_members**: Channel membership
- **internal_channel_read_status**: Channel read status
- **internal_notification_templates**: Notification templates
- **typing_indicators**: Real-time typing indicators

### Advanced Automation & Notifications
- **automation_templates**: Reusable automation templates
- **automation_triggers**: Automation trigger definitions
- **automation_executions**: Automation execution tracking
- **automation_queue**: Automation job queue
- **automation_notifications**: Automation-generated notifications
- **notification_queue**: General notification queue
- **notification_triggers**: Notification trigger rules
- **notification_deliveries**: Notification delivery tracking
- **notification_follow_up_sequences**: Follow-up sequences
- **smart_notification_deliveries**: Smart notification tracking
- **user_notification_preferences**: User notification settings
- **system_notifications**: System-generated notifications

### Practice Operations & Inventory
- **practice_inventory**: Inventory management
- **practice_analytics**: Practice performance analytics
- **practice_notification_templates**: Practice-specific templates
- **practice_social_accounts**: Social media integrations
- **social_media_accounts**: Social media account details

### HR & Organizational Structure
- **departments**: Department definitions
- **staff_titles**: Staff title management
- **bonus_configurations**: Bonus structure configuration

### Patient Extended Records
- **patient_imaging**: Patient imaging records
- **patient_laboratory**: Patient lab records

### Communication & Engagement
- **message_engagement_metrics**: Message engagement tracking
- **sms_portal_config**: SMS portal configuration
- **sms_usage_logs**: SMS usage logging

### Automation Logging
- **follow_up_automation_logs**: Follow-up automation logs

---

## Database Statistics

- **Total Tables**: 135
- **Documented in Detail**: 88
- **Views**: 13
- **Primary Functional Areas**: 12

## Notes

1. The **visits** table is the central hub for all appointment scheduling and medical encounters
2. All communication (SMS/Email) must go through centralized gateway functions
3. The database uses UUID primary keys throughout for better distributed system support
4. JSONB fields are used extensively for flexible schema storage
5. Most tables include audit fields (created_at, updated_at, created_by)
6. Row-Level Security (RLS) policies ensure practice data isolation

---

## Document Information

- **Generated**: Using Supabase MCP Tools
- **Database**: Healthcare Practice Management System (HPMS)
- **Version**: Current as of document generation date
- **Purpose**: Comprehensive database schema reference for developers and system administrators
