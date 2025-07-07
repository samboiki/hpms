# Complete HPMS Invoice Services → Batch Processing Flow

## 🔄 Process Flow Overview

```
STEP 1: Patient Visit & Service Selection
    ↓
STEP 2: Invoice Services Creation  
    ↓
STEP 3: Enhanced Invoice Generation
    ↓
STEP 4: Automatic Batch Assignment
    ↓
STEP 5: Batch Details Population
    ↓
STEP 6: Batch File Generation & Submission
    ↓
STEP 7: Financial Overview Display
```

## 📊 Detailed Process Flow

### **STEP 1: Patient Visit & Service Selection**
```
📍 Location: Visit Forms (PremiumAddVisitForm, EditVisitForm)
📊 Tables: patients, visits, invoice_services
🔗 Key Fields: 
  - patients.first_name ✅
  - patients.last_name ✅
  - patients.id_number ✅
```

**Sample Data Flow:**
```javascript
// Patient selected from patients table
patient = {
  id: 'uuid',
  first_name: 'Elisabeth Martha',  // ✅ CORRECT SOURCE
  last_name: 'Shilongo',          // ✅ CORRECT SOURCE
  id_number: '931014229901'
}

// Services selected for invoice
services = [
  { code: '8101', description: 'Full mouth examination', quantity: 1 }
]
```

### **STEP 2: Invoice Services Creation**
```
📍 Location: invoiceService.ts → createInvoiceWithServices()
📊 Table: invoice_services
🔗 Triggered by: Visit form submission
```

**Database Insert:**
```sql
INSERT INTO invoice_services (
  invoice_id,
  tariff_id,
  code,
  description,
  quantity,
  unit_price,
  total_price,
  medical_aid_covered,
  patient_portion,
  system_transaction_number  -- Auto-assigned by trigger
)
```

**Triggers Activated:**
1. `assign_system_transaction_number_trigger` - Assigns unique transaction number
2. `auto_fix_medical_aid_values_trigger` - Sets medical aid coverage
3. `update_invoice_totals_safe_trigger` - Updates invoice totals

### **STEP 3: Enhanced Invoice Generation**
```
📍 Location: invoiceService.ts → createInvoiceWithServices()
📊 Table: invoices_enhanced
🔗 Key Fields:
  - patient_id → patients.id ✅
  - practitioner_id → users.id ✅
```

**Database Insert:**
```sql
INSERT INTO invoices_enhanced (
  invoice_number,
  patient_id,        -- ✅ Links to patients table
  practitioner_id,   -- ✅ Links to users table  
  visit_id,
  practice_id,
  subtotal,
  medical_aid_total,
  patient_total
)
```

**Triggers Activated:**
1. `update_invoice_totals_safe` - Recalculates totals from services
2. `batch_parent_invoice` - Auto-assigns to batch if patient has medical aid

### **STEP 4: Automatic Batch Assignment**
```
📍 Location: auto_assign_invoice_to_batch() trigger
📊 Tables: invoices_enhanced → batch_headers → batch_details
🔗 Decision Logic: If patient has medical aid → assign to batch
```

**Process:**
```sql
-- 1. Check if patient has medical aid
SELECT medical_aid_provider_id FROM medical_aid_details 
WHERE patient_id = NEW.patient_id;

-- 2. Get medical aid reference
SELECT map.medical_aid_reference FROM medical_aid_providers map
JOIN medical_aid_details mad ON mad.medical_aid_provider_id = map.id;

-- 3. Get or create active batch
batch_id := get_or_create_active_batch_id(practice_id, medical_aid_ref);

-- 4. Add invoice to batch
PERFORM add_invoice_to_batch(batch_id, invoice_id);
```

### **STEP 5: Batch Details Population** ⚠️ **CRITICAL SECTION**
```
📍 Location: add_invoice_to_batch() function
📊 Tables: patients, invoices_enhanced, invoice_services → batch_details
🔗 THIS IS WHERE PATIENT NAMES ARE CORRECTLY EXTRACTED
```

**✅ CORRECT Implementation in Database:**
```sql
-- Get patient details FROM PATIENTS TABLE (CORRECT!)
SELECT * INTO v_patient FROM patients WHERE id = v_invoice.patient_id;

-- Calculate member initials FROM PATIENTS TABLE (CORRECT!)
SELECT string_agg(UPPER(SUBSTRING(name_part FROM 1 FOR 1)), '')
INTO v_member_initials
FROM unnest(string_to_array(TRIM(v_patient.first_name), ' ')) AS name_part;

-- Insert into batch_details WITH CORRECT PATIENT DATA
INSERT INTO batch_details (
  batch_header_id,
  invoice_id,
  system_patient_reference_number,
  medical_aid_membership_number,
  member_surname,           -- UPPER(v_patient.last_name) ✅
  member_initials,          -- Calculated from first_name ✅  
  patient_name,             -- UPPER(v_patient.first_name) ✅
  patient_date_of_birth,    -- v_patient.date_of_birth ✅
  patient_id_number,        -- v_patient.id_number ✅
  -- ... other fields
);
```

### **STEP 6: Batch File Generation**
```
📍 Location: prepare_batch_for_sending() function
📊 Tables: batch_details → .dat file
🔗 Uses ALREADY CORRECT patient data from batch_details
```

**✅ CORRECT Implementation:**
```sql
-- Build detail lines + CORRECT patient data from batch_details
SELECT STRING_AGG(
  CONCAT_WS(',',
    bd.member_surname,      -- Already correct from patients.last_name
    bd.member_initials,     -- Already correct from patients.first_name
    bd.patient_name,        -- Already correct from patients.first_name
    bd.patient_date_of_birth, -- Already correct from patients.date_of_birth
    bd.patient_id_number    -- Already correct from patients.id_number
    -- ... other fields
  ), E'\\n'
) FROM batch_details bd;
```

### **STEP 7: Financial Overview Display** ❌ **PROBLEM AREA**
```
📍 Location: EnhancedFinancialModal.tsx
📊 Issue: Frontend trying to query users.first_name instead of patients.first_name
🔗 THIS IS WHERE THE ERROR OCCURS
```

**❌ PROBLEM - Incorrect Frontend Query:**
```typescript
// Somewhere in the frontend code, there might be:
const { data: userData } = await supabase
  .from('users')
  .select('id, role, first_name, last_name, email')  // ❌ ERROR: users table has no first_name
  .eq('id', user.id);
```

**✅ CORRECT - Should be:**
```typescript
// For patient data:
const { data: patientData } = await supabase
  .from('patients')
  .select('id, first_name, last_name, email')  // ✅ CORRECT: patients table has first_name
  .eq('id', patient.id);

// For user/practitioner data:
const { data: userData } = await supabase
  .from('users')
  .select('id, role, full_name, email')  // ✅ CORRECT: users table has full_name
  .eq('id', user.id);
```

## 🔍 ROOT CAUSE ANALYSIS

### **Where the Confusion Happens:**

1. **✅ Database Layer (CORRECT):**
   - `patients` table has `first_name`, `last_name` ✅
   - `users` table has `full_name` ✅  
   - Batch processing correctly uses `patients` table ✅

2. **❌ Frontend Layer (INCORRECT):**
   - Some frontend component is querying `users.first_name` ❌
   - Should be querying `patients.first_name` for patient data ✅
   - Should be querying `users.full_name` for practitioner data ✅

### **Specific Error Location:**

The error `"column users.first_name does not exist"` is coming from:

```typescript
// ❌ WRONG: This query is causing the error
const { data, error: userError } = await supabase
  .from('users')
  .select('id, role, first_name, last_name, email')  // ❌ users has no first_name
  .eq('id', user.id);
```

This suggests that somewhere in the Financial Overview or related component, the code is trying to get practitioner/user names but incorrectly expecting `first_name`/`last_name` fields in the `users` table.

## 🎯 Data Source Mapping

| Data Type | Correct Table | Correct Fields | Usage |
|-----------|---------------|----------------|--------|
| **Patient Names** | `patients` | `first_name`, `last_name` | Batch details, invoices |
| **Practitioner Names** | `users` | `full_name` | Invoice practitioner_id |
| **Patient Medical Info** | `patients` | `id_number`, `date_of_birth` | Batch file generation |
| **User Account Info** | `users` | `email`, `role`, `practice_id` | Authentication, permissions |

## 🛠️ Fix Strategy

### **1. Find the Problematic Frontend Query**
Search for any code that queries `users` table with `first_name`/`last_name`:
```bash
grep -r "first_name.*last_name" src/
grep -r "users.*first_name" src/
```

### **2. Correct the Table Usage**
```typescript
// ❌ WRONG
.from('users').select('first_name, last_name')

// ✅ CORRECT for patients
.from('patients').select('first_name, last_name')

// ✅ CORRECT for users  
.from('users').select('full_name')
```

### **3. Update Financial Overview Queries**
Ensure all patient-related queries use `patients` table and all user-related queries use `users.full_name`.

## 📋 Summary

- **✅ Backend/Database**: Correctly uses `patients.first_name` and `patients.last_name`
- **✅ Batch System**: Correctly populates batch details from patients table
- **❌ Frontend**: Some component incorrectly queries `users.first_name`
- **🎯 Fix**: Update frontend queries to use correct tables and fields

The batch processing system is working correctly. The issue is purely in the frontend display/query logic that's confusing patient names (from `patients` table) with user names (from `users` table).