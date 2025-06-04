-- OneHealth Practice Management System - Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_practice_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariff_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN (
        SELECT role 
        FROM user_profiles 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's practices
CREATE OR REPLACE FUNCTION get_user_practices()
RETURNS UUID[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT practice_id 
        FROM user_practice_assignments 
        WHERE user_id = auth.uid() 
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has practice access
CREATE OR REPLACE FUNCTION has_practice_access(practice_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        practice_id = ANY(get_user_practices()) OR
        get_user_role() = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is practice manager or admin
CREATE OR REPLACE FUNCTION is_practice_manager_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role() IN ('admin', 'practice_manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PRACTICES TABLE POLICIES
CREATE POLICY "Admins can manage all practices" ON practices
    FOR ALL USING (is_admin());

CREATE POLICY "Users can view their assigned practices" ON practices
    FOR SELECT USING (has_practice_access(id));

CREATE POLICY "Practice managers can update their practices" ON practices
    FOR UPDATE USING (
        has_practice_access(id) AND 
        is_practice_manager_or_admin()
    );

-- USER_PROFILES TABLE POLICIES
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins can manage all user profiles" ON user_profiles
    FOR ALL USING (is_admin());

CREATE POLICY "Practice managers can view users in their practices" ON user_profiles
    FOR SELECT USING (
        is_practice_manager_or_admin() AND
        id IN (
            SELECT user_id 
            FROM user_practice_assignments 
            WHERE practice_id = ANY(get_user_practices())
            AND is_active = true
        )
    );

-- USER_PRACTICE_ASSIGNMENTS TABLE POLICIES
CREATE POLICY "Users can view their own assignments" ON user_practice_assignments
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all assignments" ON user_practice_assignments
    FOR ALL USING (is_admin());

CREATE POLICY "Practice managers can manage assignments for their practices" ON user_practice_assignments
    FOR ALL USING (
        is_practice_manager_or_admin() AND
        has_practice_access(practice_id)
    );

-- TARIFFS TABLE POLICIES
CREATE POLICY "Users can view tariffs for their practices" ON tariffs
    FOR SELECT USING (has_practice_access(practice_id));

CREATE POLICY "Practice managers and admins can manage tariffs" ON tariffs
    FOR ALL USING (
        is_practice_manager_or_admin() AND
        has_practice_access(practice_id)
    );

-- TARIFF_HISTORY TABLE POLICIES
CREATE POLICY "Users can view tariff history for their practices" ON tariff_history
    FOR SELECT USING (
        tariff_id IN (
            SELECT id FROM tariffs 
            WHERE has_practice_access(practice_id)
        )
    );

CREATE POLICY "Practice managers and admins can manage tariff history" ON tariff_history
    FOR ALL USING (
        is_practice_manager_or_admin() AND
        tariff_id IN (
            SELECT id FROM tariffs 
            WHERE has_practice_access(practice_id)
        )
    );

-- PRACTICE_SETTINGS TABLE POLICIES
CREATE POLICY "Users can view settings for their practices" ON practice_settings
    FOR SELECT USING (has_practice_access(practice_id));

CREATE POLICY "Practice managers and admins can manage settings" ON practice_settings
    FOR ALL USING (
        is_practice_manager_or_admin() AND
        has_practice_access(practice_id)
    );

-- PATIENTS TABLE POLICIES
CREATE POLICY "Users can view patients from their practices" ON patients
    FOR SELECT USING (has_practice_access(practice_id));

CREATE POLICY "Users can create patients in their practices" ON patients
    FOR INSERT WITH CHECK (has_practice_access(practice_id));

CREATE POLICY "Users can update patients in their practices" ON patients
    FOR UPDATE USING (has_practice_access(practice_id));

CREATE POLICY "Only admins and practice managers can delete patients" ON patients
    FOR DELETE USING (
        is_practice_manager_or_admin() AND
        has_practice_access(practice_id)
    );

-- APPOINTMENTS TABLE POLICIES
CREATE POLICY "Users can view appointments from their practices" ON appointments
    FOR SELECT USING (has_practice_access(practice_id));

CREATE POLICY "Users can create appointments in their practices" ON appointments
    FOR INSERT WITH CHECK (has_practice_access(practice_id));

CREATE POLICY "Users can update appointments in their practices" ON appointments
    FOR UPDATE USING (has_practice_access(practice_id));

CREATE POLICY "Doctors can only see their own appointments" ON appointments
    FOR SELECT USING (
        CASE 
            WHEN get_user_role() = 'doctor' THEN doctor_id = auth.uid()
            ELSE has_practice_access(practice_id)
        END
    );

-- BILLING_RECORDS TABLE POLICIES
CREATE POLICY "Users can view billing records from their practices" ON billing_records
    FOR SELECT USING (has_practice_access(practice_id));

CREATE POLICY "Authorized users can manage billing records" ON billing_records
    FOR ALL USING (
        has_practice_access(practice_id) AND
        get_user_role() IN ('admin', 'practice_manager', 'receptionist')
    );

-- AUDIT_LOGS TABLE POLICIES
CREATE POLICY "Admins can view all audit logs" ON audit_logs
    FOR SELECT USING (is_admin());

CREATE POLICY "Practice managers can view logs for their practices" ON audit_logs
    FOR SELECT USING (
        is_practice_manager_or_admin() AND
        (practice_id IS NULL OR has_practice_access(practice_id))
    );

CREATE POLICY "System can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- Create function to log changes
CREATE OR REPLACE FUNCTION log_audit_event(
    p_entity_type VARCHAR,
    p_entity_id UUID,
    p_action VARCHAR,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_practice_id UUID;
    v_changes JSONB;
BEGIN
    -- Try to extract practice_id from the record
    IF p_new_values ? 'practice_id' THEN
        v_practice_id := (p_new_values->>'practice_id')::UUID;
    ELSIF p_old_values ? 'practice_id' THEN
        v_practice_id := (p_old_values->>'practice_id')::UUID;
    END IF;

    -- Calculate changes if both old and new values exist
    IF p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
        v_changes := jsonb_build_object(
            'changed_fields', (
                SELECT jsonb_object_agg(key, jsonb_build_object(
                    'old', p_old_values->key,
                    'new', p_new_values->key
                ))
                FROM jsonb_object_keys(p_new_values) AS key
                WHERE p_old_values->key IS DISTINCT FROM p_new_values->key
            )
        );
    END IF;

    INSERT INTO audit_logs (
        practice_id,
        entity_type,
        entity_id,
        action,
        old_values,
        new_values,
        changes,
        user_id,
        description
    ) VALUES (
        v_practice_id,
        p_entity_type,
        p_entity_id,
        p_action,
        p_old_values,
        p_new_values,
        v_changes,
        auth.uid(),
        p_description
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for key tables
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM log_audit_event(
            TG_TABLE_NAME,
            OLD.id,
            'DELETE',
            to_jsonb(OLD),
            NULL,
            'Record deleted'
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM log_audit_event(
            TG_TABLE_NAME,
            NEW.id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW),
            'Record updated'
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        PERFORM log_audit_event(
            TG_TABLE_NAME,
            NEW.id,
            'CREATE',
            NULL,
            to_jsonb(NEW),
            'Record created'
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to key tables
CREATE TRIGGER audit_practices_trigger
    AFTER INSERT OR UPDATE OR DELETE ON practices
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_patients_trigger
    AFTER INSERT OR UPDATE OR DELETE ON patients
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_appointments_trigger
    AFTER INSERT OR UPDATE OR DELETE ON appointments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_billing_records_trigger
    AFTER INSERT OR UPDATE OR DELETE ON billing_records
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_tariffs_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tariffs
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();