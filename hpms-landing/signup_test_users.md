# Create Test Users for MedCenter Practice

Since direct auth.users insertion is restricted, here are two approaches:

## Option 1: Use the Simple SQL Script

Run this in Supabase SQL Editor:
```sql
-- Copy content from: create_dr_polina_users_simple.sql
-- This creates users in the users table for appointment assignment
```

## Option 2: Manual Signup (Recommended)

### Step 1: Go to HPMS Portal
Visit: https://healthsys-indol.vercel.app

### Step 2: Sign Up New Users
Create these accounts manually using the signup form:

**Main Doctor:**
- Email: doctor@medcenter.com
- Password: medcenter123
- First Name: Dr.
- Last Name: Smith
- Role: Doctor

**Aesthetic Nurse:**
- Email: nurse.maria@medcenter.com
- Password: nurse123
- First Name: Maria
- Last Name: Johnson
- Role: Nurse

**Receptionist:**
- Email: reception@medcenter.com
- Password: reception123
- First Name: Sarah
- Last Name: Williams
- Role: Receptionist

### Step 3: Update Users with Practice ID

After creating the accounts, run this SQL to link them to MedCenter practice:

```sql
DO $$
DECLARE
    practice_uuid UUID;
BEGIN
    -- Get MedCenter practice ID
    SELECT id INTO practice_uuid FROM practices WHERE slug = 'medcenter-aesthetics';
    
    -- Update users with practice ID
    UPDATE users 
    SET practice_id = practice_uuid
    WHERE email IN (
        'doctor@medcenter.com',
        'nurse.maria@medcenter.com',
        'reception@medcenter.com'
    );
    
    RAISE NOTICE 'Updated users with MedCenter practice ID';
END $$;
```

## Option 3: Quick Test

For immediate testing, you can use any existing HPMS user account to see if bookings appear in the appointments list.

## Testing the Booking System

1. **Make a booking**: https://medcenter-landing.vercel.app
2. **Check appointments**: https://healthsys-indol.vercel.app
3. **Login with any admin account** to see if the appointment appears

The booking system should work regardless of the specific user accounts, as long as there are users in the MedCenter practice.