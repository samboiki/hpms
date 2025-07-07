-- Simple test to create one Dr. Polina user
-- This version tries to work around Supabase auth restrictions

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

    -- Generate user ID
    new_user_id := gen_random_uuid();

    -- Try direct insert without ON CONFLICT
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
        
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'User already exists: polina@drpolinaaesthetics.com';
    END;

    -- Also create in users table for appointment assignment
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
        new_user_id,
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

    RAISE NOTICE 'User setup complete for Dr. Polina practice!';
    
END $$;