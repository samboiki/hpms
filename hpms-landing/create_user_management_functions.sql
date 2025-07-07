-- Create functions for user management that admins can use

-- Function to create a new user in a practice
CREATE OR REPLACE FUNCTION create_practice_user(
    user_email TEXT,
    user_password TEXT,
    user_first_name TEXT,
    user_last_name TEXT,
    user_role TEXT,
    user_title TEXT DEFAULT '',
    user_specialization TEXT DEFAULT '',
    user_phone TEXT DEFAULT '',
    practice_slug TEXT DEFAULT NULL,
    practice_uuid UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_practice_id UUID;
    new_user_id UUID;
    result JSON;
BEGIN
    -- Get practice ID
    IF practice_uuid IS NOT NULL THEN
        target_practice_id := practice_uuid;
    ELSIF practice_slug IS NOT NULL THEN
        SELECT id INTO target_practice_id FROM practices WHERE slug = practice_slug;
    ELSE
        RETURN json_build_object('success', false, 'error', 'Practice ID or slug required');
    END IF;

    IF target_practice_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Practice not found');
    END IF;

    -- Check if user already exists
    SELECT id INTO new_user_id FROM auth.users WHERE email = user_email;
    
    IF new_user_id IS NOT NULL THEN
        RETURN json_build_object('success', false, 'error', 'User with this email already exists');
    END IF;

    -- Generate new user ID
    new_user_id := gen_random_uuid();

    -- Create user in auth.users
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role,
        aud,
        confirmation_token,
        email_change_token,
        recovery_token
    ) VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        user_email,
        crypt(user_password, gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object(
            'role', user_role,
            'practice_id', target_practice_id::text,
            'first_name', user_first_name,
            'last_name', user_last_name,
            'full_name', user_first_name || ' ' || user_last_name,
            'title', COALESCE(user_title, ''),
            'specialization', COALESCE(user_specialization, ''),
            'phone', COALESCE(user_phone, '')
        ),
        false,
        'authenticated',
        'authenticated',
        '',
        '',
        ''
    );

    -- Also create in users table for easier querying
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
        user_email,
        user_first_name,
        user_last_name,
        user_role,
        target_practice_id,
        jsonb_build_object(
            'title', COALESCE(user_title, ''),
            'specialization', COALESCE(user_specialization, ''),
            'phone', COALESCE(user_phone, ''),
            'full_name', user_first_name || ' ' || user_last_name
        ),
        NOW(),
        NOW()
    ) ON CONFLICT (email) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        user_type = EXCLUDED.user_type,
        practice_id = EXCLUDED.practice_id,
        user_metadata = EXCLUDED.user_metadata,
        updated_at = NOW();

    result := json_build_object(
        'success', true,
        'user_id', new_user_id,
        'email', user_email,
        'message', 'User created successfully'
    );

    RETURN result;

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false, 
        'error', SQLERRM,
        'detail', SQLSTATE
    );
END;
$$;

-- Function to get users for a practice
CREATE OR REPLACE FUNCTION get_practice_users(practice_uuid UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    role TEXT,
    title TEXT,
    specialization TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        au.id,
        au.email,
        (au.raw_user_meta_data->>'first_name')::TEXT as first_name,
        (au.raw_user_meta_data->>'last_name')::TEXT as last_name,
        (au.raw_user_meta_data->>'full_name')::TEXT as full_name,
        (au.raw_user_meta_data->>'role')::TEXT as role,
        (au.raw_user_meta_data->>'title')::TEXT as title,
        (au.raw_user_meta_data->>'specialization')::TEXT as specialization,
        (au.raw_user_meta_data->>'phone')::TEXT as phone,
        au.created_at
    FROM auth.users au
    WHERE (au.raw_user_meta_data->>'practice_id')::UUID = practice_uuid
    ORDER BY au.created_at DESC;
END;
$$;

-- Function to update user in practice
CREATE OR REPLACE FUNCTION update_practice_user(
    user_id UUID,
    user_first_name TEXT DEFAULT NULL,
    user_last_name TEXT DEFAULT NULL,
    user_role TEXT DEFAULT NULL,
    user_title TEXT DEFAULT NULL,
    user_specialization TEXT DEFAULT NULL,
    user_phone TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_metadata JSONB;
    updated_metadata JSONB;
BEGIN
    -- Get current metadata
    SELECT raw_user_meta_data INTO current_metadata 
    FROM auth.users 
    WHERE id = user_id;

    IF current_metadata IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Build updated metadata
    updated_metadata := current_metadata;
    
    IF user_first_name IS NOT NULL THEN
        updated_metadata := jsonb_set(updated_metadata, '{first_name}', to_jsonb(user_first_name));
    END IF;
    
    IF user_last_name IS NOT NULL THEN
        updated_metadata := jsonb_set(updated_metadata, '{last_name}', to_jsonb(user_last_name));
    END IF;
    
    IF user_role IS NOT NULL THEN
        updated_metadata := jsonb_set(updated_metadata, '{role}', to_jsonb(user_role));
    END IF;
    
    IF user_title IS NOT NULL THEN
        updated_metadata := jsonb_set(updated_metadata, '{title}', to_jsonb(user_title));
    END IF;
    
    IF user_specialization IS NOT NULL THEN
        updated_metadata := jsonb_set(updated_metadata, '{specialization}', to_jsonb(user_specialization));
    END IF;
    
    IF user_phone IS NOT NULL THEN
        updated_metadata := jsonb_set(updated_metadata, '{phone}', to_jsonb(user_phone));
    END IF;

    -- Update full_name if first or last name changed
    IF user_first_name IS NOT NULL OR user_last_name IS NOT NULL THEN
        updated_metadata := jsonb_set(
            updated_metadata, 
            '{full_name}', 
            to_jsonb(
                COALESCE(user_first_name, updated_metadata->>'first_name') || ' ' || 
                COALESCE(user_last_name, updated_metadata->>'last_name')
            )
        );
    END IF;

    -- Update auth.users
    UPDATE auth.users 
    SET 
        raw_user_meta_data = updated_metadata,
        updated_at = NOW()
    WHERE id = user_id;

    -- Also update users table if it exists
    UPDATE users 
    SET 
        first_name = COALESCE(user_first_name, first_name),
        last_name = COALESCE(user_last_name, last_name),
        user_type = COALESCE(user_role, user_type),
        user_metadata = updated_metadata,
        updated_at = NOW()
    WHERE id = user_id;

    RETURN json_build_object('success', true, 'message', 'User updated successfully');

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permissions (adjust as needed for your RLS setup)
-- These functions should only be callable by practice admins
GRANT EXECUTE ON FUNCTION create_practice_user TO authenticated;
GRANT EXECUTE ON FUNCTION get_practice_users TO authenticated;
GRANT EXECUTE ON FUNCTION update_practice_user TO authenticated;