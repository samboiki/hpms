-- Create dummy users for Dr. Polina Aesthetics practice
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

    -- Insert Dr. Polina (Main Doctor/Owner)
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        gen_random_uuid(),
        'polina@drpolinaaesthetics.com',
        crypt('drpolina123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object(
            'role', 'admin',
            'practice_id', practice_uuid,
            'first_name', 'Teopolina',
            'last_name', 'Tileinge',
            'full_name', 'Dr. Teopolina N. Tileinge',
            'title', 'Medical Doctor & Aesthetic Specialist',
            'specialization', 'Medical Aesthetics',
            'phone', '+264 81 435 8844'
        ),
        false,
        'authenticated'
    ) ON CONFLICT (email) DO UPDATE SET
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = NOW();

    -- Insert Aesthetic Nurse
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        gen_random_uuid(),
        'nurse.maria@drpolinaaesthetics.com',
        crypt('nurse123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object(
            'role', 'nurse',
            'practice_id', practice_uuid,
            'first_name', 'Maria',
            'last_name', 'Shikongo',
            'full_name', 'Maria Shikongo, RN',
            'title', 'Registered Aesthetic Nurse',
            'specialization', 'Aesthetic Procedures',
            'phone', '+264 81 435 8844'
        ),
        false,
        'authenticated'
    ) ON CONFLICT (email) DO UPDATE SET
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = NOW();

    -- Insert Receptionist
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        gen_random_uuid(),
        'reception@drpolinaaesthetics.com',
        crypt('reception123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object(
            'role', 'receptionist',
            'practice_id', practice_uuid,
            'first_name', 'Sarah',
            'last_name', 'Ndilula',
            'full_name', 'Sarah Ndilula',
            'title', 'Clinic Coordinator',
            'specialization', 'Patient Care',
            'phone', '+264 81 435 8844'
        ),
        false,
        'authenticated'
    ) ON CONFLICT (email) DO UPDATE SET
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = NOW();

    -- Insert Aesthetic Consultant
    INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        gen_random_uuid(),
        'consultant@drpolinaaesthetics.com',
        crypt('consultant123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object(
            'role', 'doctor',
            'practice_id', practice_uuid,
            'first_name', 'Jennifer',
            'last_name', 'Mukuongwa',
            'full_name', 'Jennifer Mukuongwa',
            'title', 'Senior Aesthetic Consultant',
            'specialization', 'Skincare & Anti-Aging',
            'phone', '+264 81 435 8844'
        ),
        false,
        'authenticated'
    ) ON CONFLICT (email) DO UPDATE SET
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = NOW();

    RAISE NOTICE 'Successfully created dummy users for Dr. Polina Aesthetics practice!';
    RAISE NOTICE 'Login credentials:';
    RAISE NOTICE '1. Dr. Polina (Admin): polina@drpolinaaesthetics.com / drpolina123';
    RAISE NOTICE '2. Nurse Maria: nurse.maria@drpolinaaesthetics.com / nurse123';
    RAISE NOTICE '3. Receptionist Sarah: reception@drpolinaaesthetics.com / reception123';
    RAISE NOTICE '4. Consultant Jennifer: consultant@drpolinaaesthetics.com / consultant123';
END $$;