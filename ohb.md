# 🏥 OneHealth System Blueprint

**Version**: 5.0  
**Last Updated**: 2025-07-11 12:00:00 UTC  
**Description**: This is the master blueprint for the OneHealth system. It serves as a living document for system architecture, workflows, and components, ensuring traceability and efficient development.

---

## 📋 Table of Contents

- [👥 Patients](#-patients)
- [🩺 Encounters](#-encounters)
- [📱 Communications](#-communications)
- [💰 Finance & Operations](#-finance--operations)
- [⚙️ Settings](#️-settings)

---

## 👥 Patients
<details>
<summary><b>🔍 Click to expand Patients section</b></summary>

**📅 Section Last Updated**: `2025-07-11 11:00:00 UTC`

**📝 Description**: This module handles all aspects of patient management, from registration and demographic data to document and media storage. It is the foundation for most other system modules.

---

### 📊 Database Tables Overview

| Table Name | Purpose | Key Relations | Timestamps |
|:-----------|:--------|:--------------|:-----------|
| **`patients`** | Core patient records with demographics and identification | `practice_id` → `practices.id`<br>`branch_id` → `branches.id`<br>`created_by` → `users.id`<br>`updated_by` → `users.id` | `created_at`<br>`updated_at` |
| **`medical_aid_details`** | Insurance/medical aid information | `patient_id` → `patients.id`<br>`medical_aid_id` → `medical_aid_providers.id` | `created_at`<br>`updated_at` |
| **`next_of_kin`** | Emergency contacts and relationships | `patient_id` → `patients.id` | `created_at`<br>`updated_at` |
| **`patient_documents`** | Document metadata and storage | `patient_id` → `patients.id`<br>`uploaded_by` → `users.id` | `created_at`<br>`updated_at` |
| **`patient_media`** | Images and media files | `patient_id` → `patients.id`<br>`uploaded_by` → `users.id` | `created_at`<br>`uploaded_at` |

---

### 🗂️ Table Details

#### 📋 `patients` Table

| Field Name | Data Type | Description |
|:-----------|:----------|:------------|
| **`id`** | `UUID` | Primary key, unique identifier for the patient |
| **`system_patient_reference_number`** | `TEXT` | Auto-generated patient reference (e.g., P000001) |
| **`government_id_number`** | `TEXT` | National identification number |
| **`first_name`** * | `TEXT` | Patient's first name (required) |
| **`middle_name`** | `TEXT` | Patient's middle name (optional) |
| **`last_name`** * | `TEXT` | Patient's last name (required) |
| **`date_of_birth`** | `DATE` | Patient's birth date |
| **`gender`** | `TEXT` | Gender (male/female/other) |
| **`phone`** | `TEXT` | Primary contact number |
| **`email`** | `TEXT` | Email address |
| **`address`** | `TEXT` | Physical address |
| **`city`** | `TEXT` | City of residence |
| **`country`** | `TEXT` | Country (default: Namibia) |
| **`occupation`** | `TEXT` | Patient's occupation |
| **`emergency_contact_name`** | `TEXT` | Emergency contact person |
| **`emergency_contact_phone`** | `TEXT` | Emergency contact number |
| **`blood_type`** | `TEXT` | Blood type (A+, B+, O+, etc.) |
| **`allergies`** | `TEXT` | Known allergies |
| **`chronic_conditions`** | `TEXT` | Chronic medical conditions |
| **`practice_id`** | `UUID` | Associated practice ID |
| **`branch_id`** | `UUID` | Associated branch ID |
| **`created_at`** | `TIMESTAMPTZ` | Record creation timestamp |
| **`updated_at`** | `TIMESTAMPTZ` | Last update timestamp |
| **`created_by`** | `UUID` | User who created the record |
| **`updated_by`** | `UUID` | User who last updated the record |

> **Note**: Fields marked with * are required

#### 🔧 Triggers

```sql
-- Active triggers on patients table
✅ assign_system_patient_reference_number_trigger  -- Auto-generates patient reference numbers
✅ update_patients_updated_at                      -- Updates timestamp on record modification  
✅ audit_patients_trigger                          -- Creates audit trail for all changes
```

</details>

---

## 🩺 Encounters
<details>
<summary><b>Click to expand Encounters section</b></summary>

### Overview
Encounters encompass all patient interactions including appointments, visits, clinical documentation, and medical procedures.

### Key Components
- **Appointment Scheduling**
- **Visit Management**
- **Clinical Documentation**
- **Vital Signs**
- **Laboratory & Imaging**
- **Prescriptions**

### Database Tables
- `visits` - Primary appointment/visit table
- `vitals` - Vital signs records
- `medical_records` - Clinical notes
- `lab_requests` - Laboratory orders
- `imaging_requests` - Imaging orders
- `medications` - Prescription records

</details>

---

## 📱 Communications
<details>
<summary><b>Click to expand Communications section</b></summary>

### Overview
Centralized communication system handling all SMS, email, and automated messaging with full tracking and compliance.

### Key Components
- **SMS Gateway**
- **Email Gateway**
- **Automation Engine**
- **Template Management**
- **Communication Logs**
- **Subscription Management**

### Database Tables
- `practice_sms_logs` - SMS tracking
- `practice_email_logs` - Email tracking
- `automation_templates` - Message templates
- `automation_executions` - Automation runs
- `automation_queue` - Scheduled messages

### Edge Functions
- `centralized-sms-gateway`
- `centralized-email-gateway`
- `process-automation-queue`

</details>

---

## 💰 Finance & Operations
<details>
<summary><b>Click to expand Finance & Operations section</b></summary>

### Overview
Complete financial management including invoicing, payments, medical aid claims, HR/payroll, and operational reporting.

### Key Components
- **Invoice Generation**
- **Payment Processing**
- **Medical Aid Claims**
- **Batch Processing**
- **HR & Payroll**
- **Financial Reports**

### Database Tables
- `invoices_enhanced` - Invoice management
- `invoice_services` - Line items
- `payments` - Payment records
- `batch_headers` - Medical aid batches
- `employee_salaries` - Payroll data
- `payslips` - Employee payslips

</details>

---

## ⚙️ Settings
<details>
<summary><b>Click to expand Settings section</b></summary>

### Overview
System configuration, practice management, user administration, and integration settings.

### Key Components
- **Practice Configuration**
- **User Management**
- **Role & Permissions**
- **Branch Management**
- **Tariff Management**
- **Integration Settings**
- **System Preferences**

### Database Tables
- `practices` - Practice information
- `branches` - Multi-location support
- `users` - User accounts
- `admin_roles` - Role definitions
- `practice_settings` - Configuration
- `practice_tariffs` - Service pricing

</details>

---

## 🎨 Document Styling Guide

### Typography
- **Headers**: Use emoji icons for visual hierarchy
- **Bold**: Key terms and important concepts
- **Code blocks**: Technical specifications
- **Tables**: Structured data presentation

### Organization
- **Collapsible sections**: Keep document navigable
- **Clear hierarchy**: H2 for main sections, H3 for subsections
- **Consistent formatting**: Maintain visual consistency
- **White space**: Improve readability

### Icons Reference
- 👥 People/Users
- 🩺 Medical/Clinical
- 📱 Communication
- 💰 Finance
- ⚙️ Settings/Configuration
- 📊 Analytics/Reports
- 🔒 Security
- 🚀 Performance
- ✅ Success/Active
- ❌ Error/Inactive