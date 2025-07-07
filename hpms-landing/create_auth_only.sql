-- Create Dr. Polina users in auth.users only (ignore users table for now)

DO $$
DECLARE
    practice_uuid UUID;
    new_user_id UUID;
BEGIN
    -- Get Dr. Polina practice ID
    SELECT id INTO practice_uuid FROM practices WHERE slug = 'dr-polina-aesthetics';
    
    IF practice_uuid IS NULL THEN
        RAISE EXCEPTION 'Dr. Polina practice not found. Please run the practice migration first.';
    END IF;

    -- Create Dr. Polina user
    new_user_id := gen_random_uuid();
    
    BEGIN
        INSERT INTO auth.users (
            id,
            email,
            encrypted_password,
            email_confirmed_at,
            email_change_confirm_status,
            created_at,
            updated_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            role
        ) VALUES (
            new_user_id,
            'polina@drpolinaaesthetics.com',
            crypt('drpolina123', gen_salt('bf')),
            NOW(),
            0,
            NOW(),
            NOW(),
            '{"provider": "email", "providers": ["email"]}',
            jsonb_build_object(
                'role', 'admin',
                'practice_id', practice_uuid::text,
                'first_name', 'Teopolina',
                'last_name', 'Tileinge',
                'full_name', 'Dr. Teopolina N. Tileinge',
                'title', 'Medical Doctor & Aesthetic Specialist',
                'specialization', 'Medical Aesthetics',
                'phone', '+264 81 435 8844'
            ),
            false,
            'authenticated'
        );
        
        RAISE NOTICE 'Successfully created Dr. Polina user: polina@drpolinaaesthetics.com / drpolina123';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Dr. Polina user creation failed or already exists: %', SQLERRM;
    END;

    -- Create Nurse user
    new_user_id := gen_random_uuid();
    
    BEGIN
        INSERT INTO auth.users (
            id,
            email,
            encrypted_password,
            email_confirmed_at,
            email_change_confirm_status,
            created_at,
            updated_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            role
        ) VALUES (
            new_user_id,
            'nurse.maria@drpolinaaesthetics.com',
            crypt('nurse123', gen_salt('bf')),
            NOW(),
            0,
            NOW(),
            NOW(),
            '{"provider": "email", "providers": ["email"]}',
            jsonb_build_object(
                'role', 'nurse',
                'practice_id', practice_uuid::text,
                'first_name', 'Maria',
                'last_name', 'Shikongo',
                'full_name', 'Maria Shikongo, RN',
                'title', 'Registered Aesthetic Nurse',
                'specialization', 'Aesthetic Procedures',
                'phone', '+264 81 435 8844'
            ),
            false,
            'authenticated'
        );
        
        RAISE NOTICE 'Successfully created Nurse Maria user: nurse.maria@drpolinaaesthetics.com / nurse123';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Nurse Maria user creation failed or already exists: %', SQLERRM;
    END;

    -- Create Receptionist user
    new_user_id := gen_random_uuid();
    
    BEGIN
        INSERT INTO auth.users (
            id,
            email,
            encrypted_password,
            email_confirmed_at,
            email_change_confirm_status,
            created_at,
            updated_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            role
        ) VALUES (
            new_user_id,
            'reception@drpolinaaesthetics.com',
            crypt('reception123', gen_salt('bf')),
            NOW(),
            0,
            NOW(),
            NOW(),
            '{"provider": "email", "providers": ["email"]}',
            jsonb_build_object(
                'role', 'receptionist',
                'practice_id', practice_uuid::text,
                'first_name', 'Sarah',
                'last_name', 'Ndilula',
                'full_name', 'Sarah Ndilula',
                'title', 'Clinic Coordinator',
                'specialization', 'Patient Care',
                'phone', '+264 81 435 8844'
            ),
            false,
            'authenticated'
        );
        
        RAISE NOTICE 'Successfully created Receptionist Sarah user: reception@drpolinaaesthetics.com / reception123';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Receptionist Sarah user creation failed or already exists: %', SQLERRM;
    END;

    -- Create Consultant user
    new_user_id := gen_random_uuid();
    
    BEGIN
        INSERT INTO auth.users (
            id,
            email,
            encrypted_password,
            email_confirmed_at,
            email_change_confirm_status,
            created_at,
            updated_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            role
        ) VALUES (
            new_user_id,
            'consultant@drpolinaaesthetics.com',
            crypt('consultant123', gen_salt('bf')),
            NOW(),
            0,
            NOW(),
            NOW(),
            '{"provider": "email", "providers": ["email"]}',
            jsonb_build_object(
                'role', 'doctor',
                'practice_id', practice_uuid::text,
                'first_name', 'Jennifer',
                'last_name', 'Mukuongwa',
                'full_name', 'Jennifer Mukuongwa',
                'title', 'Senior Aesthetic Consultant',
                'specialization', 'Skincare & Anti-Aging',
                'phone', '+264 81 435 8844'
            ),
            false,
            'authenticated'
        );
        
        RAISE NOTICE 'Successfully created Consultant Jennifer user: consultant@drpolinaaesthetics.com / consultant123';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Consultant Jennifer user creation failed or already exists: %', SQLERRM;
    END;

    RAISE NOTICE '=================================';
    RAISE NOTICE 'Auth user creation process completed!';
    RAISE NOTICE 'Login credentials for HPMS portal:';
    RAISE NOTICE '1. Dr. Polina (Admin): polina@drpolinaaesthetics.com / drpolina123';
    RAISE NOTICE '2. Nurse Maria: nurse.maria@drpolinaaesthetics.com / nurse123';
    RAISE NOTICE '3. Receptionist Sarah: reception@drpolinaaesthetics.com / reception123';
    RAISE NOTICE '4. Consultant Jennifer: consultant@drpolinaaesthetics.com / consultant123';
    RAISE NOTICE '=================================';
    
END $$;