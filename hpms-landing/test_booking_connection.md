# Testing Booking System Connection

## Database Setup Required

**Run these SQL scripts in Supabase Dashboard:**

### 1. First, run the MedCenter practice migration:
```sql
-- From: supabase/migrations/20250526_add_dr_polina_practice.sql
-- (This creates the MedCenter practice record)
```

### 2. Fix the domain:
```sql
-- From: fix_dr_polina_domain.sql
UPDATE practices 
SET domain = 'medcenter.vercel.app'
WHERE slug = 'medcenter-aesthetics';
```

### 3. Create dummy users:
```sql
-- From: create_dr_polina_users.sql
-- (This creates 4 dummy users for MedCenter practice)
```

## Testing the Connection

### Step 1: Test Booking on Landing Page
1. Go to: https://medcenter-landing.vercel.app
2. Click "Book Now" on any service
3. Fill out the booking form
4. Submit the appointment

### Step 2: Verify in HPMS Portal
1. Go to: https://healthsys-indol.vercel.app
2. Login with MedCenter credentials:
   - Email: `doctor@medcenter.com`
   - Password: `medcenter123`
3. Navigate to Appointments page
4. Look for the appointment you just created

### Expected Result
- ✅ Appointment appears in HPMS portal
- ✅ Shows patient name, service, date/time
- ✅ Assigned to MedCenter doctor or available doctor
- ✅ Status shows as "scheduled"

## Dummy User Credentials

**Main Doctor (Admin/Doctor):**
- Email: doctor@medcenter.com
- Password: medcenter123

**Aesthetic Nurse:**
- Email: nurse.maria@medcenter.com  
- Password: nurse123

**Receptionist:**
- Email: reception@medcenter.com
- Password: reception123

**Aesthetic Consultant:**
- Email: consultant@medcenter.com
- Password: consultant123

## Database Schema Updates

The booking system now:
1. ✅ Creates patient record in `patients` table
2. ✅ Creates appointment in `appointments` table  
3. ✅ Links appointment to practice via `practice_id`
4. ✅ Assigns doctor via `doctor_id`
5. ✅ Includes service details in notes field

## Next Steps

After testing, if appointments don't appear in HPMS portal, we may need to:
1. Add practice filtering to HPMS appointments store
2. Update authentication to include practice_id context
3. Ensure RLS (Row Level Security) policies are correct