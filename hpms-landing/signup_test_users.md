# Create Test Users for Dr. Polina Practice

Since direct auth.users insertion is restricted, here are two approaches:

## Option 1: Use the Simple SQL Script

Run this in Supabase SQL Editor:
```sql
-- Copy content from: create_dr_polina_users_simple.sql
-- This creates users in the users table for appointment assignment
```

## Option 2: Manual Signup (Recommended)

### Step 1: Go to HPMS Portal
Visit: https://onehealth-indol.vercel.app

### Step 2: Sign Up New Users
Create these accounts manually using the signup form:

**Dr. Polina (Main Doctor):**
- Email: polina@drpolinaaesthetics.com
- Password: drpolina123
- First Name: Teopolina
- Last Name: Tileinge
- Role: Doctor

**Aesthetic Nurse:**
- Email: nurse.maria@drpolinaaesthetics.com
- Password: nurse123
- First Name: Maria
- Last Name: Shikongo
- Role: Nurse

**Receptionist:**
- Email: reception@drpolinaaesthetics.com
- Password: reception123
- First Name: Sarah
- Last Name: Ndilula
- Role: Receptionist

### Step 3: Update Users with Practice ID

After creating the accounts, run this SQL to link them to Dr. Polina practice:

```sql
DO $$
DECLARE
    practice_uuid UUID;
BEGIN
    -- Get Dr. Polina practice ID
    SELECT id INTO practice_uuid FROM practices WHERE slug = 'dr-polina-aesthetics';
    
    -- Update users with practice ID
    UPDATE users 
    SET practice_id = practice_uuid
    WHERE email IN (
        'polina@drpolinaaesthetics.com',
        'nurse.maria@drpolinaaesthetics.com',
        'reception@drpolinaaesthetics.com'
    );
    
    RAISE NOTICE 'Updated users with Dr. Polina practice ID';
END $$;
```

## Option 3: Quick Test

For immediate testing, you can use any existing HPMS user account to see if bookings appear in the appointments list.

## Testing the Booking System

1. **Make a booking**: https://dr-polina-landing.vercel.app
2. **Check appointments**: https://onehealth-indol.vercel.app
3. **Login with any admin account** to see if the appointment appears

The booking system should work regardless of the specific user accounts, as long as there are users in the Dr. Polina practice.