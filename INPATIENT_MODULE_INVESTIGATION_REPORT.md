# INPATIENT MODULE DATABASE INVESTIGATION REPORT

**Date:** 2025-09-30
**Project:** Healthcare Practice Management System (HPMS)
**Supabase Project ID:** jjxlfunlbyayxwvlpgwt

---

## 🔍 EXECUTIVE SUMMARY

The inpatient module database structure is **INCOMPLETE**. Critical tables for rooms and beds management are missing, causing the dashboard statistics to show zero rooms and beds despite having 5 wards configured.

### Critical Issues Found:
1. ✅ **hospital_wards** table exists with 5 wards (65 total beds capacity)
2. ❌ **hospital_rooms** table is MISSING
3. ❌ **hospital_beds** table is MISSING
4. ⚠️ **patient_admissions** table exists but is EMPTY
5. ⚠️ Ward-to-Practice relationship is broken (practice not found)
6. ✅ Ward-to-Department relationship is WORKING

---

## 📊 DATABASE STRUCTURE ANALYSIS

### 1. HOSPITAL_WARDS TABLE ✅

**Status:** EXISTS and FUNCTIONAL
**Primary Key:** `id` (UUID)
**Total Records:** 5 wards

#### Table Schema:
```
Columns (19 total):
- id (UUID, Primary Key)
- practice_id (UUID, Foreign Key - BROKEN REFERENCE)
- branch_id (UUID, nullable)
- department_id (UUID, Foreign Key - WORKING)
- ward_name (text)
- ward_code (text)
- ward_type (text)
- floor_number (integer)
- total_beds (integer)
- occupied_beds (integer)
- nurse_station_ext (text)
- head_nurse_id (UUID)
- description (text)
- features (jsonb)
- visiting_hours_start (time)
- visiting_hours_end (time)
- max_visitors_per_patient (integer)
- is_active (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

#### Existing Wards:
| Ward Name | Code | Type | Floor | Total Beds | Occupied | Department | Active |
|-----------|------|------|-------|------------|----------|------------|--------|
| General Ward A | GWA | general | 1 | 20 | 2 | General Medicine | ✅ |
| Intensive Care Unit | ICU | icu | 2 | 10 | 2 | General Medicine | ✅ |
| Pediatric Ward | PED | pediatric | 1 | 15 | 2 | Pediatrics | ✅ |
| Maternity Ward | MAT | maternity | 3 | 12 | 2 | General Medicine | ✅ |
| Emergency Ward | ER | emergency | 0 | 8 | 2 | General Medicine | ✅ |

**Total Beds Capacity:** 65 beds
**Total Occupied (from ward counters):** 10 beds

---

### 2. HOSPITAL_ROOMS TABLE ❌

**Status:** DOES NOT EXIST
**Impact:** Cannot manage individual rooms within wards
**Dashboard Shows:** 0 rooms (because table doesn't exist)

#### Expected Schema:
```sql
CREATE TABLE hospital_rooms (
  room_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_id UUID NOT NULL REFERENCES practices(id),
  ward_id UUID NOT NULL REFERENCES hospital_wards(id),
  department_id UUID REFERENCES departments(id),
  room_number TEXT NOT NULL,
  room_type TEXT, -- 'single', 'double', 'triple', 'ward'
  floor_number INTEGER,
  bed_capacity INTEGER,
  status TEXT, -- 'available', 'occupied', 'maintenance', 'closed'
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 3. HOSPITAL_BEDS TABLE ❌

**Status:** DOES NOT EXIST
**Impact:** Cannot manage individual beds or track bed occupancy
**Dashboard Shows:** 0 beds (because table doesn't exist)

#### Expected Schema:
```sql
CREATE TABLE hospital_beds (
  bed_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_id UUID NOT NULL REFERENCES practices(id),
  ward_id UUID NOT NULL REFERENCES hospital_wards(id),
  room_id UUID NOT NULL REFERENCES hospital_rooms(room_id),
  department_id UUID REFERENCES departments(id),
  bed_number TEXT NOT NULL,
  bed_type TEXT, -- 'standard', 'icu', 'pediatric', 'maternity'
  status TEXT, -- 'available', 'occupied', 'maintenance', 'reserved'
  patient_id UUID REFERENCES patients(id),
  admission_id UUID REFERENCES patient_admissions(admission_id),
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 4. PATIENT_ADMISSIONS TABLE ⚠️

**Status:** EXISTS but EMPTY
**Total Records:** 0 active admissions

#### Table Structure:
The table exists but contains no records. This is expected if no patients have been admitted yet.

---

### 5. DEPARTMENTS TABLE ✅

**Status:** EXISTS and FUNCTIONAL
**Primary Key:** `id` (UUID)
**Total Records:** 15 departments across multiple practices

#### Schema:
```
Columns:
- id (UUID, Primary Key)
- practice_id (UUID)
- name (text)
- description (text)
- head_user_id (UUID)
- color (text)
- is_active (boolean)
- created_at (timestamp)
- updated_at (timestamp)
- code (text)
- contact_email (text)
- contact_phone (text)
```

#### Ward-Department Relationships (WORKING ✅):
| Ward | Department | Practice |
|------|------------|----------|
| General Ward A | General Medicine | 2a4e8072-bd22-4e5e-b683-e0bacb9b3836 |
| ICU | General Medicine | 2a4e8072-bd22-4e5e-b683-e0bacb9b3836 |
| Pediatric Ward | Pediatrics | 2a4e8072-bd22-4e5e-b683-e0bacb9b3836 |
| Maternity Ward | General Medicine | 2a4e8072-bd22-4e5e-b683-e0bacb9b3836 |
| Emergency Ward | General Medicine | 2a4e8072-bd22-4e5e-b683-e0bacb9b3836 |

---

## 🔧 IDENTIFIED ISSUES

### Critical Issues:
1. **Missing hospital_rooms table** - Cannot create or manage rooms
2. **Missing hospital_beds table** - Cannot create or manage individual beds
3. **Broken practice reference** - Wards reference practice `b64632c2-3a56-44cf-a2c9-0e42be03a2d3` which doesn't exist
4. **Dashboard shows 0/0/0** - Because rooms and beds tables don't exist

### Data Integrity Issues:
1. **Practice Mismatch:**
   - Wards are assigned to practice: `b64632c2-3a56-44cf-a2c9-0e42be03a2d3` (NOT FOUND)
   - Departments are from practice: `2a4e8072-bd22-4e5e-b683-e0bacb9b3836` (EXISTS)
   - This cross-practice reference needs resolution

2. **Bed Counting:**
   - Wards show `total_beds` and `occupied_beds` counts
   - But without hospital_beds table, these are just placeholder numbers
   - Need actual bed records for real-time occupancy tracking

---

## 🛠️ RECOMMENDED FIXES

### Phase 1: Create Missing Tables (URGENT)

1. **Create hospital_rooms table:**
   ```sql
   CREATE TABLE hospital_rooms (
     room_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     practice_id UUID NOT NULL REFERENCES practices(id),
     ward_id UUID NOT NULL REFERENCES hospital_wards(id),
     department_id UUID REFERENCES departments(id),
     room_number TEXT NOT NULL,
     room_type TEXT CHECK (room_type IN ('single', 'double', 'triple', 'ward')),
     floor_number INTEGER,
     bed_capacity INTEGER DEFAULT 1,
     status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'closed')),
     features JSONB,
     is_active BOOLEAN DEFAULT true,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Indexes
   CREATE INDEX idx_hospital_rooms_ward ON hospital_rooms(ward_id);
   CREATE INDEX idx_hospital_rooms_practice ON hospital_rooms(practice_id);
   CREATE INDEX idx_hospital_rooms_department ON hospital_rooms(department_id);
   CREATE INDEX idx_hospital_rooms_status ON hospital_rooms(status);
   ```

2. **Create hospital_beds table:**
   ```sql
   CREATE TABLE hospital_beds (
     bed_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     practice_id UUID NOT NULL REFERENCES practices(id),
     ward_id UUID NOT NULL REFERENCES hospital_wards(id),
     room_id UUID NOT NULL REFERENCES hospital_rooms(room_id) ON DELETE CASCADE,
     department_id UUID REFERENCES departments(id),
     bed_number TEXT NOT NULL,
     bed_type TEXT CHECK (bed_type IN ('standard', 'icu', 'pediatric', 'maternity', 'emergency')),
     status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
     patient_id UUID REFERENCES patients(id),
     admission_id UUID REFERENCES patient_admissions(admission_id),
     features JSONB,
     is_active BOOLEAN DEFAULT true,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Indexes
   CREATE INDEX idx_hospital_beds_room ON hospital_beds(room_id);
   CREATE INDEX idx_hospital_beds_ward ON hospital_beds(ward_id);
   CREATE INDEX idx_hospital_beds_practice ON hospital_beds(practice_id);
   CREATE INDEX idx_hospital_beds_department ON hospital_beds(department_id);
   CREATE INDEX idx_hospital_beds_status ON hospital_beds(status);
   CREATE INDEX idx_hospital_beds_patient ON hospital_beds(patient_id);
   ```

3. **Enable RLS policies:**
   ```sql
   ALTER TABLE hospital_rooms ENABLE ROW LEVEL SECURITY;
   ALTER TABLE hospital_beds ENABLE ROW LEVEL SECURITY;

   -- RLS policies for practice isolation
   CREATE POLICY "Users can view rooms in their practice"
     ON hospital_rooms FOR SELECT
     USING (practice_id = (SELECT practice_id FROM users WHERE id = auth.uid()));

   CREATE POLICY "Users can view beds in their practice"
     ON hospital_beds FOR SELECT
     USING (practice_id = (SELECT practice_id FROM users WHERE id = auth.uid()));
   ```

### Phase 2: Data Population

1. **Generate rooms for existing wards:**
   - General Ward A (20 beds) → Create 20 single rooms or mix of room types
   - ICU (10 beds) → Create 10 individual ICU rooms
   - Pediatric Ward (15 beds) → Create pediatric rooms
   - Maternity Ward (12 beds) → Create maternity rooms
   - Emergency Ward (8 beds) → Create emergency bay rooms

2. **Generate beds for each room:**
   - Link each bed to its room and ward
   - Set appropriate bed_type based on ward type
   - Initialize all beds with 'available' status

### Phase 3: Fix Practice References

1. **Option A: Update wards to use correct practice:**
   ```sql
   UPDATE hospital_wards
   SET practice_id = '2a4e8072-bd22-4e5e-b683-e0bacb9b3836'
   WHERE practice_id = 'b64632c2-3a56-44cf-a2c9-0e42be03a2d3';
   ```

2. **Option B: Create the missing practice:**
   - Check if practice should exist
   - Create practice record if needed
   - Update department references

---

## 📈 EXPECTED RESULTS AFTER FIX

Once tables are created and populated:

### Dashboard Statistics Should Show:
```
Total Wards: 5
Total Rooms: ~40-50 (depending on room configuration)
Total Beds: 65
Available Beds: 55 (assuming 10 occupied)
Occupied Beds: 10
Occupancy Rate: ~15%
```

### Data Flow Should Work:
```
hospital_wards (5)
    ↓
hospital_rooms (~40-50)
    ↓
hospital_beds (65)
    ↓
patient_admissions (when patients are admitted)
```

---

## 🎯 PRIORITY ACTIONS

1. **IMMEDIATE (P0):**
   - Create hospital_rooms table
   - Create hospital_beds table
   - Enable RLS policies

2. **HIGH (P1):**
   - Populate rooms for existing 5 wards
   - Populate beds for all rooms
   - Fix practice_id mismatch

3. **MEDIUM (P2):**
   - Add triggers to auto-update ward.occupied_beds count
   - Add triggers to auto-update room status based on beds
   - Create views for easy bed availability queries

4. **LOW (P3):**
   - Add audit logging for bed assignments
   - Create materialized views for statistics
   - Add validation constraints

---

## 📝 NOTES

- All ward-to-department relationships are working correctly
- The wards table structure is good and doesn't need changes
- Need to maintain consistency: practice_id should match across wards, departments, rooms, and beds
- Consider creating a function to automatically generate rooms/beds when a ward is created

---

**Report Generated:** 2025-09-30
**Investigation Tool:** Node.js + Supabase Client
**Database Access:** Service Role Key (Full Access)