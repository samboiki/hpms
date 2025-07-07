-- Simple approach: Create users in the users table (not auth.users)
-- First, get the practice ID
DO $$
DECLARE
    practice_uuid UUID;
BEGIN
    -- Get Dr. Polina practice ID
    SELECT id INTO practice_uuid FROM practices WHERE slug = 'dr-polina-aesthetics';
    
    IF practice_uuid IS NULL THEN
        RAISE EXCEPTION 'Dr. Polina practice not found. Please run the practice migration first.';
    END IF;

    -- Create users in the users table (for HPMS portal access)
    -- Dr. Polina (Main Doctor/Owner)
    INSERT INTO users (
        id,
        email,
        first_name,
        last_name,
        user_type,
        practice_id,
        user_metadata,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        'polina@drpolinaaesthetics.com',
        'Teopolina',
        'Tileinge',
        'doctor',
        practice_uuid,
        jsonb_build_object(
            'role', 'admin',
            'title', 'Medical Doctor & Aesthetic Specialist',
            'specialization', 'Medical Aesthetics',
            'phone', '+264 81 435 8844',
            'full_name', 'Dr. Teopolina N. Tileinge'
        ),
        NOW(),
        NOW()
    ) ON CONFLICT (email) DO UPDATE SET
        user_metadata = EXCLUDED.user_metadata,
        updated_at = NOW();

    -- Aesthetic Nurse
    INSERT INTO users (
        id,
        email,
        first_name,
        last_name,
        user_type,
        practice_id,
        user_metadata,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        'nurse.maria@drpolinaaesthetics.com',
        'Maria',
        'Shikongo',
        'nurse',
        practice_uuid,
        jsonb_build_object(
            'role', 'nurse',
            'title', 'Registered Aesthetic Nurse',
            'specialization', 'Aesthetic Procedures',
            'phone', '+264 81 435 8844',
            'full_name', 'Maria Shikongo, RN'
        ),
        NOW(),
        NOW()
    ) ON CONFLICT (email) DO UPDATE SET
        user_metadata = EXCLUDED.user_metadata,
        updated_at = NOW();

    -- Receptionist
    INSERT INTO users (
        id,
        email,
        first_name,
        last_name,
        user_type,
        practice_id,
        user_metadata,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        'reception@drpolinaaesthetics.com',
        'Sarah',
        'Ndilula',
        'receptionist',
        practice_uuid,
        jsonb_build_object(
            'role', 'receptionist',
            'title', 'Clinic Coordinator',
            'specialization', 'Patient Care',
            'phone', '+264 81 435 8844',
            'full_name', 'Sarah Ndilula'
        ),
        NOW(),
        NOW()
    ) ON CONFLICT (email) DO UPDATE SET
        user_metadata = EXCLUDED.user_metadata,
        updated_at = NOW();

    -- Aesthetic Consultant
    INSERT INTO users (
        id,
        email,
        first_name,
        last_name,
        user_type,
        practice_id,
        user_metadata,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        'consultant@drpolinaaesthetics.com',
        'Jennifer',
        'Mukuongwa',
        'doctor',
        practice_uuid,
        jsonb_build_object(
            'role', 'doctor',
            'title', 'Senior Aesthetic Consultant',
            'specialization', 'Skincare & Anti-Aging',
            'phone', '+264 81 435 8844',
            'full_name', 'Jennifer Mukuongwa'
        ),
        NOW(),
        NOW()
    ) ON CONFLICT (email) DO UPDATE SET
        user_metadata = EXCLUDED.user_metadata,
        updated_at = NOW();

    RAISE NOTICE '=================================';
    RAISE NOTICE 'Successfully created dummy users for Dr. Polina Aesthetics practice!';
    RAISE NOTICE 'Note: These users are created in the users table for appointment assignment.';
    RAISE NOTICE 'For HPMS portal login, you can use existing admin credentials or create via signup.';
    RAISE NOTICE '=================================';
END $$;