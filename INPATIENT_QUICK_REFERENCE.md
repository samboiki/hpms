# INPATIENT MODULE QUICK REFERENCE

## TWO STRUCTURES EXIST

### STRUCTURE A (ORIGINAL - WORKING)
```
departments
    |
hospital_wards (5 wards)
    |
ward_beds (65 beds)
    |
bed_allocations <-- Uses ward_beds.id as FK
```

**Tables:**
- ward_beds: 65 beds, room_number as TEXT field
- Status column: `status`
- Practice filtering: via hospital_wards.practice_id

### STRUCTURE B (NEW - INCOMPLETE)
```
departments
    |
hospital_wards (5 wards)
    |
rooms (40 rooms) <-- NULL practice_id, NULL department_id
    |
beds (72 beds) <-- NULL practice_id, NULL department_id
```

**Tables:**
- rooms: 40 rooms with ward_id
- beds: 72 beds with room_id and ward_id
- Status column: `bed_status`
- NOT used by bed_allocations

---

## THE PROBLEM

bed_allocations.bed_id --> ward_beds.id (Structure A)

But frontend queries are using beds table (Structure B) which has:
- NULL practice_id (filters return 0 results)
- NULL department_id (filters return 0 results)

---

## CORRECT QUERY FOR BED_ALLOCATIONS

```sql
SELECT
  hw.ward_name,
  COUNT(wb.id) as total_beds,
  COUNT(CASE WHEN wb.status = 'available' THEN 1 END) as available,
  COUNT(CASE WHEN wb.status = 'occupied' THEN 1 END) as occupied
FROM hospital_wards hw
LEFT JOIN ward_beds wb ON wb.ward_id = hw.id
WHERE hw.practice_id = ?
GROUP BY hw.id, hw.ward_name;
```

**Key Points:**
- Use `ward_beds` table (NOT `beds`)
- Use `status` column (NOT `bed_status`)
- Filter practice via `hospital_wards.practice_id`

---

## SOLUTION OPTIONS

### Quick Fix (Recommended for Now)
1. Change all frontend queries to use `ward_beds`
2. Use `status` column
3. Join through `hospital_wards` for practice filter

### Long-term Migration
1. Fix NULL values in rooms/beds:
   ```sql
   UPDATE rooms SET practice_id = (SELECT practice_id FROM hospital_wards WHERE id = rooms.ward_id);
   UPDATE beds SET practice_id = (SELECT practice_id FROM hospital_wards WHERE id = beds.ward_id);
   ```
2. Change bed_allocations FK to reference beds.id
3. Deprecate ward_beds table

---

## FILE LOCATIONS

- Original migration: `supabase/migrations/20250127_create_inpatient_module.sql`
- Analysis reports:
  - `INPATIENT_DATA_VERIFICATION_REPORT.md`
  - `INPATIENT_SCHEMA_ANALYSIS.md`
  - `ROOMS_BEDS_DEBUG_REPORT.md`
  - `INPATIENT_STRUCTURE_COMPLETE_ANALYSIS.md`

---

## VERIFIED DATA COUNTS

| Table | Count | Structure | FK Target |
|-------|-------|-----------|-----------|
| hospital_wards | 5 | Both | N/A |
| ward_beds | 65 | A (Original) | bed_allocations |
| rooms | 40 | B (New) | NOT USED |
| beds | 72 | B (New) | NOT USED |
| patient_admissions | 0 | Both | N/A |
| bed_allocations | 0 | A (Original) | ward_beds.id |

---

Generated: 2025-09-30
