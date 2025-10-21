# INPATIENT MODULE STRUCTURE - COMPLETE ANALYSIS

**Generated:** 2025-09-30  
**Project:** Healthcare Practice Management System (HPMS)  
**Database:** Supabase (jjxlfunlbyayxwvlpgwt)

---

## EXECUTIVE SUMMARY

**CRITICAL FINDING:** The database has **TWO COMPETING BED MANAGEMENT STRUCTURES** that coexist:

1. **Original Structure (ward_beds)** - 65 beds, fully functional
2. **New Structure (rooms to beds)** - 40 rooms + 72 beds, incomplete setup

The bed_allocations table uses the **original structure**, but frontend code may be trying to use the **new structure**, causing query failures.

---

## VERIFIED TABLE INVENTORY

### Tables That Exist:

| Table | Records | Structure | Status |
|-------|---------|-----------|--------|
| hospital_wards | 5 | Original | Active |
| ward_beds | 65 | Original | Active, FK target for bed_allocations |
| rooms | 40 | New | Incomplete (NULL practice_id, NULL department_id) |
| beds | 72 | New | Incomplete (NULL practice_id, NULL department_id) |
| patient_admissions | 0 | Original | Active |
| bed_allocations | 0 | Original | Active, references ward_beds.id |

---

## COMPLETE SCHEMA DETAILS

### WARD_BEDS (Original Structure)

**Columns:** 16 total
- id (Primary key)
- ward_id (FK to hospital_wards.id)
- bed_number (e.g., "GWA01")
- bed_code (Unique code)
- bed_type (standard, icu, pediatric, etc.)
- room_number (TEXT field, not FK! e.g., "GWA-1")
- room_type (single, double, ward, etc.)
- status (available, occupied, maintenance, etc.)
- features (Array of features)
- daily_rate (Billing rate)
- last_cleaned_at (Maintenance tracking)
- next_maintenance_date (Maintenance tracking)
- notes (Admin notes)
- is_active (Active status)
- created_at (Timestamp)
- updated_at (Timestamp)

**Key Characteristics:**
- 65 beds properly linked to wards
- ALL have ward_id populated
- room_number is TEXT (not a foreign key)
- Used by bed_allocations FK
- Column name: status (not bed_status)

**Hierarchy:**
departments to hospital_wards to ward_beds
                                   |
                            bed_allocations (FK references ward_beds.id)

---

### ROOMS (New Structure)

**Columns:** 17 total
- id (Primary key)
- room_number (e.g., "EMG-R01")
- room_name (e.g., "Room 1")
- room_type (private, standard, vip, etc.)
- department_id (FK to departments.id - NULL)
- ward_id (FK to hospital_wards.id)
- floor_number (Floor location)
- building (Building identifier)
- bed_count (Number of beds in room)
- occupied_beds (Currently occupied count)
- room_status (Available, Occupied, etc.)
- amenities (Room features)
- daily_rate (Billing rate)
- is_active (Active status)
- practice_id (FK to practices.id - NULL)
- created_at (Timestamp)
- updated_at (Timestamp)

**Key Characteristics:**
- 40 rooms across 8 wards
- ALL have ward_id populated
- ALL have NULL practice_id (breaks multi-tenant queries)
- ALL have NULL department_id (breaks department filtering)

---

### BEDS (New Structure)

**Columns:** 16 total
- id (Primary key)
- bed_number (e.g., "EMG-R01-B1")
- bed_name (e.g., "Bed 1")
- room_id (FK to rooms.id)
- ward_id (FK to hospital_wards.id)
- department_id (FK to departments.id - NULL)
- bed_type (standard, icu, private, etc.)
- bed_status (Available, Occupied, Maintenance)
- patient_id (FK to patients.id for current occupant)
- patient_name (Denormalized patient name)
- admission_date (When patient was admitted)
- expected_discharge (Expected discharge date)
- is_active (Active status)
- practice_id (FK to practices.id - NULL)
- created_at (Timestamp)
- updated_at (Timestamp)

**Key Characteristics:**
- 72 beds across 8 wards
- ALL have room_id populated
- ALL have ward_id populated
- ALL have NULL practice_id (breaks multi-tenant queries)
- ALL have NULL department_id (breaks department filtering)
- Column name: bed_status (not status)
- NOT referenced by bed_allocations (uses ward_beds instead)

---

### BED_ALLOCATIONS (Uses Original Structure)

**Foreign Key:**
bed_id UUID to ward_beds(id) - CRITICAL: Points to ward_beds, NOT beds!

**Hierarchy:**
patient_admissions
       |
bed_allocations.bed_id to ward_beds.id (Original structure)
                           |
                    hospital_wards

---

## THE CORE PROBLEM

### Why Queries Are Failing:

**WRONG Query (New Structure):**
The dashboard is likely trying to query the beds table and filtering by practice_id,
but all practice_ids are NULL, so it returns 0 records.

**CORRECT Query (Original Structure):**
Should use ward_beds table and filter by practice through hospital_wards join.

---

## CORRECT HIERARCHY FOR BED_ALLOCATIONS

### Current Reality (What Works):

departments to hospital_wards to ward_beds (bed_allocations.bed_id references this)
                                              |
                                       bed_allocations

**Correct Query:**
```sql
SELECT
  hw.id as ward_id,
  hw.ward_name,
  COUNT(wb.id) as total_beds,
  COUNT(wb.id) FILTER (WHERE wb.status = 'available') as available_beds,
  COUNT(wb.id) FILTER (WHERE wb.status = 'occupied') as occupied_beds,
  COUNT(ba.id) FILTER (WHERE ba.is_current = true) as allocated_beds
FROM hospital_wards hw
LEFT JOIN ward_beds wb ON wb.ward_id = hw.id
LEFT JOIN bed_allocations ba ON ba.bed_id = wb.id
WHERE hw.practice_id = ? AND hw.is_active = true
GROUP BY hw.id, hw.ward_name;
```

---

## RECOMMENDED SOLUTIONS

### Option 1: USE ORIGINAL STRUCTURE (Fastest Fix)

**Pros:**
- Already works with bed_allocations
- No database migrations needed
- All relationships intact
- 65 beds ready to use

**Implementation:**
1. Update frontend queries to use ward_beds instead of beds
2. Use status column (not bed_status)
3. Join through hospital_wards for practice filtering

---

### Option 2: MIGRATE TO NEW STRUCTURE (Best Long-term)

**Required Steps:**

Step 1: Fix NULL Values
```sql
UPDATE rooms
SET practice_id = (
  SELECT practice_id FROM hospital_wards WHERE hospital_wards.id = rooms.ward_id
)
WHERE practice_id IS NULL;

UPDATE rooms
SET department_id = (
  SELECT department_id FROM hospital_wards WHERE hospital_wards.id = rooms.ward_id
)
WHERE department_id IS NULL;

UPDATE beds
SET practice_id = (
  SELECT practice_id FROM hospital_wards WHERE hospital_wards.id = beds.ward_id
)
WHERE practice_id IS NULL;

UPDATE beds
SET department_id = (
  SELECT department_id FROM hospital_wards WHERE hospital_wards.id = beds.ward_id
)
WHERE department_id IS NULL;
```

Step 2: Migrate bed_allocations FK
```sql
ALTER TABLE bed_allocations DROP CONSTRAINT bed_allocations_bed_id_fkey;
ALTER TABLE bed_allocations ADD CONSTRAINT bed_allocations_bed_id_fkey
FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE RESTRICT;
```

Step 3: Deprecate ward_beds
```sql
ALTER TABLE ward_beds RENAME TO ward_beds_deprecated;
```

---

## FINAL RECOMMENDATION

**The bed_allocations query must use:**
- Table: ward_beds (NOT beds)
- Status column: status (NOT bed_status)
- Hierarchy: hospital_wards to ward_beds to bed_allocations
- Practice filtering: Through hospital_wards.practice_id join

**The new rooms/beds structure exists but:**
- Is not referenced by bed_allocations
- Has NULL practice_id and department_id values
- Can be used for future migration with proper setup

---

Report Complete | Generated 2025-09-30
