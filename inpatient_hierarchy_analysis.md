# Inpatient Module Hierarchy Analysis

## 🔍 INVESTIGATION SUMMARY

Based on comprehensive database analysis reports, here's what exists:

### ✅ CONFIRMED TABLE STRUCTURE

#### Original Migration (20250127_create_inpatient_module.sql):
1. **hospital_wards** - Main wards table
2. **ward_beds** - Beds linked to wards (with room_number column)
3. **patient_admissions** - Admission records
4. **bed_allocations** - Links admissions to beds
5. Plus 7 other supporting tables

#### Later Creation (separate scripts):
1. **rooms** - Separate rooms table with ward_id, department_id
2. **beds** - Separate beds table with room_id, ward_id, department_id

### 🚨 CRITICAL FINDING: TWO COMPETING STRUCTURES

**Structure A (Original):**
```
departments → hospital_wards → ward_beds (with room_number as TEXT)
```

**Structure B (Later Added):**
```
departments → hospital_wards → rooms → beds
```

### 📊 ACTUAL DATA (from reports):

#### Structure A Data:
- **hospital_wards**: 5 wards (GWA, ICU, PED, MAT, ER)
- **ward_beds**: 65 beds (with room_number field populated)
- All ward_beds have ward_id populated ✅

#### Structure B Data:
- **rooms**: 40 rooms across 8 wards
- **beds**: 72 beds across 8 wards
- All rooms have ward_id populated ✅
- All beds have room_id and ward_id populated ✅
- BUT: rooms and beds have NULL practice_id ❌
- BUT: rooms and beds have NULL department_id ❌

### ❌ THE PROBLEM:

The `bed_allocations` table references `ward_beds`, NOT the new `beds` table!

```sql
-- bed_allocations FK constraints (from migration):
bed_id UUID NOT NULL REFERENCES ward_beds(id)  -- ← Points to ward_beds!
ward_id UUID NOT NULL REFERENCES hospital_wards(id)
```

But the dashboard query is trying to use the new hierarchical structure:
```sql
-- Dashboard likely trying:
hospital_wards → rooms → beds
```

### 🎯 CORRECT HIERARCHY FOR bed_allocations:

**Option 1: Use Original Structure (ward_beds)**
```
departments → hospital_wards → ward_beds
                                   ↓
                            bed_allocations
```

Query should be:
```sql
SELECT
  hw.id,
  hw.ward_name,
  COUNT(wb.id) FILTER (WHERE wb.status = 'available') as available_beds,
  COUNT(wb.id) FILTER (WHERE wb.status = 'occupied') as occupied_beds
FROM hospital_wards hw
LEFT JOIN ward_beds wb ON wb.ward_id = hw.id
WHERE hw.practice_id = ?
GROUP BY hw.id;
```

**Option 2: Use New Structure (rooms + beds) [REQUIRES MIGRATION]**
```
departments → hospital_wards → rooms → beds
                                         ↓
                                  bed_allocations (needs FK change)
```

This requires:
1. Alter bed_allocations.bed_id to reference beds(id) instead of ward_beds(id)
2. Migrate data from ward_beds to rooms/beds structure
3. Populate practice_id and department_id in rooms/beds

### 📝 RECOMMENDED SOLUTION:

**DECISION NEEDED:** Which structure should be the single source of truth?

#### Recommendation: **Use Structure B (rooms + beds)**
Reasons:
1. More normalized (rooms are entities, not just text fields)
2. Better for room-level management (amenities, rates, etc.)
3. Already has 72 beds created with proper relationships
4. Supports multi-bed rooms properly

#### Required Actions:
1. **Fix NULL values in rooms/beds:**
```sql
UPDATE rooms SET practice_id = (
  SELECT practice_id FROM hospital_wards WHERE id = rooms.ward_id
) WHERE practice_id IS NULL;

UPDATE rooms SET department_id = (
  SELECT department_id FROM hospital_wards WHERE id = rooms.ward_id
) WHERE department_id IS NULL;

UPDATE beds SET practice_id = (
  SELECT practice_id FROM hospital_wards WHERE id = beds.ward_id
) WHERE practice_id IS NULL;

UPDATE beds SET department_id = (
  SELECT department_id FROM hospital_wards WHERE id = beds.ward_id
) WHERE department_id IS NULL;
```

2. **Migrate bed_allocations FK:**
```sql
-- This is complex - requires mapping ward_beds.id to beds.id
-- May need to deprecate old bed_allocations and create new ones
```

3. **Deprecate ward_beds table:**
```sql
-- After data migration, rename for safety:
ALTER TABLE ward_beds RENAME TO ward_beds_deprecated;
```

### 🔧 IMMEDIATE FIX FOR DASHBOARD:

If dashboard needs to work NOW, use this query with ward_beds:
```typescript
const { data: bedStats } = await supabase
  .from('ward_beds')
  .select('ward_id, status')
  .eq('is_active', true);

const statsByWard = bedStats.reduce((acc, bed) => {
  if (!acc[bed.ward_id]) {
    acc[bed.ward_id] = { available: 0, occupied: 0, total: 0 };
  }
  acc[bed.ward_id].total++;
  if (bed.status === 'available') acc[bed.ward_id].available++;
  if (bed.status === 'occupied') acc[bed.ward_id].occupied++;
  return acc;
}, {});
```

