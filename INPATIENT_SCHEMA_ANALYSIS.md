# Inpatient Dashboard Schema Analysis Report

## Executive Summary

**STATUS: ⚠️ CRITICAL ISSUES FOUND**

The inpatient dashboard is failing to load data due to:
1. **ALL wards have NULL department_id** (5 out of 5 wards)
2. **The practice "One health test" has NO departments** in the departments table
3. **Schema column naming inconsistency**: `hospital_wards` uses `ward_name` instead of `name`

---

## 1. Table Schema Analysis

### ✅ hospital_wards Table

**Status**: Table exists with all required columns

**Schema**:
```typescript
{
  id: uuid (primary key)
  practice_id: uuid (foreign key → practices)
  branch_id: uuid (nullable)
  ward_name: string          // ⚠️ Note: Uses "ward_name" not "name"
  ward_code: string
  ward_type: string
  floor_number: integer
  total_beds: integer
  occupied_beds: integer
  nurse_station_ext: string
  head_nurse_id: uuid (nullable)
  description: text
  features: string[]
  visiting_hours_start: time
  visiting_hours_end: time
  max_visitors_per_patient: integer
  is_active: boolean
  department_id: uuid (nullable)  // ⚠️ ALL VALUES ARE NULL!
  created_at: timestamp
  updated_at: timestamp
}
```

**Sample Data**:
```json
{
  "id": "4b6c4665-881c-4dbe-bf8c-f4f3d19a156b",
  "practice_id": "b64632c2-3a56-44cf-a2c9-0e42be03a2d3",
  "ward_name": "General Ward A",
  "ward_code": "GWA",
  "ward_type": "general",
  "floor_number": 1,
  "total_beds": 20,
  "occupied_beds": 2,
  "department_id": null  // ⚠️ NULL!
}
```

**Current Wards**:
1. General Ward A (GWA) - department_id: NULL
2. Intensive Care Unit (ICU) - department_id: NULL
3. Pediatric Ward (PED) - department_id: NULL
4. Maternity Ward (MAT) - department_id: NULL
5. Emergency Ward (ER) - department_id: NULL

---

### ✅ ward_beds Table

**Status**: Table exists with all required columns

**Schema**:
```typescript
{
  id: uuid (primary key)
  ward_id: uuid (foreign key → hospital_wards)  // ✅ Present
  bed_number: string
  bed_code: string
  bed_type: string
  room_number: string  // ✅ Present
  room_type: string
  status: string
  features: string[]
  daily_rate: numeric
  last_cleaned_at: timestamp
  next_maintenance_date: date (nullable)
  notes: text (nullable)
  is_active: boolean
  created_at: timestamp
  updated_at: timestamp
}
```

**Sample Data**:
```json
{
  "id": "16afaa7d-056a-46f2-bff0-e04363afe3f0",
  "ward_id": "4b6c4665-881c-4dbe-bf8c-f4f3d19a156b",
  "bed_number": "GWA01",
  "room_number": "GWA-1",  // ✅ Present
  "room_type": "double",
  "status": "occupied"
}
```

**Statistics**:
- Total beds: 65
- Beds linked to wards: ✅ All beds have valid ward_id
- Room numbers populated: ✅ All beds have room_number

---

### ❌ departments Table

**Status**: Table exists but NO departments for practice with wards

**Schema**:
```typescript
{
  id: uuid (primary key)
  practice_id: uuid (foreign key → practices)
  name: string
  description: text
  head_user_id: uuid (nullable)
  code: string
  color: string
  is_active: boolean
  contact_email: string (nullable)
  contact_phone: string (nullable)
  created_at: timestamp
  updated_at: timestamp
}
```

**Critical Issue**:
```
Practice: "One health test" (b64632c2-3a56-44cf-a2c9-0e42be03a2d3)
- Has 5 wards ✅
- Has 65 beds ✅
- Has 0 departments ❌
```

---

## 2. Relationship Verification

### Ward → Department Relationship

**Status**: ❌ BROKEN

**Test Query**:
```sql
SELECT
  hw.id,
  hw.ward_name,
  hw.department_id,
  d.name as department_name
FROM hospital_wards hw
LEFT JOIN departments d ON hw.department_id = d.id;
```

**Result**: All wards return NULL for department_id and department_name

**Issue**: The foreign key relationship exists in the schema but:
1. All ward records have `department_id = NULL`
2. No departments exist for the practice that owns these wards

---

### Bed → Ward Relationship

**Status**: ✅ WORKING

**Test Query**:
```sql
SELECT
  wb.id,
  wb.bed_number,
  wb.room_number,
  wb.ward_id,
  hw.ward_name
FROM ward_beds wb
LEFT JOIN hospital_wards hw ON wb.ward_id = hw.id;
```

**Result**: All 65 beds successfully link to their wards

**Example**:
```json
{
  "bed_number": "GWA01",
  "room_number": "GWA-1",
  "ward_id": "4b6c4665-881c-4dbe-bf8c-f4f3d19a156b",
  "ward_name": "General Ward A"
}
```

---

## 3. Critical Issues Preventing Dashboard Load

### Issue #1: NULL department_id Values
**Severity**: 🔴 CRITICAL

**Description**: All 5 wards have `department_id = NULL`

**Impact**:
- Any query filtering by department will return no wards
- Department-based navigation will fail
- Department statistics will be empty

**Example Failed Query**:
```typescript
// This will return 0 wards
const { data } = await supabase
  .from('hospital_wards')
  .select('*')
  .eq('department_id', someDepartmentId);
```

---

### Issue #2: Missing Departments for Practice
**Severity**: 🔴 CRITICAL

**Description**: Practice "One health test" (b64632c2-3a56-44cf-a2c9-0e42be03a2d3) has:
- 5 wards ✅
- 65 beds ✅
- 0 departments ❌

**Impact**:
- No departments to assign to wards
- Department dropdown will be empty
- Cannot filter wards by department
- Inpatient dashboard expects departments to exist

**Root Cause**: Departments table is empty for this practice

---

### Issue #3: Column Naming Inconsistency
**Severity**: ⚠️ MEDIUM

**Description**: The `hospital_wards` table uses `ward_name` instead of `name`

**Impact**:
- Frontend code expecting `name` property will fail
- Queries selecting `name` will error
- TypeScript interfaces may mismatch

**Error Example**:
```
Error: column hospital_wards.name does not exist
```

**Affected Code**:
```typescript
// This will fail:
.select('id, name, department_id')

// Should be:
.select('id, ward_name, department_id')
```

---

## 4. Recommendations

### Immediate Actions Required

1. **Create Departments for Practice**
   ```sql
   -- Create essential clinical departments
   INSERT INTO departments (practice_id, name, code, color, is_active)
   VALUES
     ('b64632c2-3a56-44cf-a2c9-0e42be03a2d3', 'General Medicine', 'GEN', '#3B82F6', true),
     ('b64632c2-3a56-44cf-a2c9-0e42be03a2d3', 'Intensive Care', 'ICU', '#EF4444', true),
     ('b64632c2-3a56-44cf-a2c9-0e42be03a2d3', 'Pediatrics', 'PED', '#10B981', true),
     ('b64632c2-3a56-44cf-a2c9-0e42be03a2d3', 'Maternity', 'MAT', '#F59E0B', true),
     ('b64632c2-3a56-44cf-a2c9-0e42be03a2d3', 'Emergency', 'ER', '#DC2626', true);
   ```

2. **Link Wards to Departments**
   ```sql
   -- Update each ward with appropriate department_id
   UPDATE hospital_wards
   SET department_id = (SELECT id FROM departments WHERE code = 'GEN' AND practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3')
   WHERE ward_code = 'GWA';

   UPDATE hospital_wards
   SET department_id = (SELECT id FROM departments WHERE code = 'ICU' AND practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3')
   WHERE ward_code = 'ICU';

   -- Repeat for PED, MAT, ER...
   ```

3. **Update Frontend Code**
   - Find all references to `hospital_wards.name`
   - Replace with `hospital_wards.ward_name`
   - Update TypeScript interfaces to match actual schema

---

## 5. Data Statistics

```
Total Practices: 7
Total Wards: 5
Total Beds: 65
Total Departments (all practices): 5
Total Departments (practice with wards): 0 ❌

Wards without department: 5 / 5 (100%) ❌
Beds without ward: 0 / 65 (0%) ✅
```

---

## 6. Affected Queries

The following types of queries will fail or return empty results:

```typescript
// ❌ Will return empty - no wards linked to departments
supabase
  .from('hospital_wards')
  .select('*, departments(*)')
  .not('department_id', 'is', null)

// ❌ Will fail - wrong column name
supabase
  .from('hospital_wards')
  .select('id, name, department_id')

// ✅ Will work - correct column name
supabase
  .from('hospital_wards')
  .select('id, ward_name, department_id')

// ❌ Will return empty - departments don't exist
supabase
  .from('departments')
  .select('*, hospital_wards(*)')
  .eq('practice_id', 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3')
```

---

## Conclusion

The inpatient dashboard cannot load data because:
1. **No departments exist** for the practice
2. **All ward records have NULL department_id**
3. **Frontend code may be using wrong column name** (`name` vs `ward_name`)

**Priority**: 🔴 CRITICAL - Blocking feature

**Next Steps**:
1. Create departments for practice "One health test"
2. Update all wards with correct department_id values
3. Verify frontend code uses `ward_name` not `name`
4. Test inpatient dashboard loading

---

Generated: 2025-09-30
Practice ID: b64632c2-3a56-44cf-a2c9-0e42be03a2d3
Practice Name: One health test