-- Create audit logs table for tracking system changes
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT')),
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    user_role TEXT,
    ip_address INET,
    user_agent TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Create RLS policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read audit logs
CREATE POLICY "Users can view audit logs" ON audit_logs
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role to insert audit logs
CREATE POLICY "Service role can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Create function to log changes automatically
CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        old_values,
        new_values,
        user_id,
        user_email,
        description,
        created_at
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
        auth.uid(),
        auth.email(),
        CASE 
            WHEN TG_OP = 'INSERT' THEN 'Record created'
            WHEN TG_OP = 'UPDATE' THEN 'Record updated'
            WHEN TG_OP = 'DELETE' THEN 'Record deleted'
        END,
        now()
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for key tables
DROP TRIGGER IF EXISTS audit_patients_trigger ON patients;
CREATE TRIGGER audit_patients_trigger
    AFTER INSERT OR UPDATE OR DELETE ON patients
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

DROP TRIGGER IF EXISTS audit_visits_trigger ON visits;
CREATE TRIGGER audit_visits_trigger
    AFTER INSERT OR UPDATE OR DELETE ON visits
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

DROP TRIGGER IF EXISTS audit_vitals_trigger ON vitals;
CREATE TRIGGER audit_vitals_trigger
    AFTER INSERT OR UPDATE OR DELETE ON vitals
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

DROP TRIGGER IF EXISTS audit_medical_aid_trigger ON medical_aid_details;
CREATE TRIGGER audit_medical_aid_trigger
    AFTER INSERT OR UPDATE OR DELETE ON medical_aid_details
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

-- Insert some sample audit data for demonstration
INSERT INTO audit_logs (
    table_name, record_id, action, description, user_id, user_email, user_role,
    ip_address, user_agent, created_at
) VALUES 
-- Sample patient creation
('patients', uuid_generate_v4(), 'INSERT', 'New patient registered', 
 (SELECT id FROM auth.users LIMIT 1), 'dr.sarah@clinic.com', 'doctor',
 '192.168.1.45', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', now() - interval '2 hours'),

-- Sample visit creation  
('visits', uuid_generate_v4(), 'INSERT', 'New consultation visit created',
 (SELECT id FROM auth.users LIMIT 1), 'dr.sarah@clinic.com', 'doctor', 
 '192.168.1.45', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', now() - interval '1 hour'),

-- Sample vitals recording
('vitals', uuid_generate_v4(), 'INSERT', 'Patient vital signs recorded',
 (SELECT id FROM auth.users LIMIT 1), 'nurse.mary@clinic.com', 'nurse',
 '192.168.1.22', 'Mozilla/5.0 (iPad; CPU OS 15_6)', now() - interval '30 minutes'),

-- Sample patient update
('patients', uuid_generate_v4(), 'UPDATE', 'Patient contact information updated',
 (SELECT id FROM auth.users LIMIT 1), 'admin.john@clinic.com', 'admin',
 '192.168.1.10', 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', now() - interval '15 minutes'),

-- Sample login
('auth_sessions', uuid_generate_v4(), 'LOGIN', 'User logged into system',
 (SELECT id FROM auth.users LIMIT 1), 'dr.sarah@clinic.com', 'doctor',
 '192.168.1.45', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', now() - interval '3 hours');

-- Create view for easier querying
CREATE OR REPLACE VIEW patient_audit_logs AS
SELECT 
    al.*,
    u.full_name as user_full_name,
    CASE 
        WHEN al.table_name = 'patients' THEN 'Patient Record'
        WHEN al.table_name = 'visits' THEN 'Medical Visit'
        WHEN al.table_name = 'vitals' THEN 'Vital Signs'
        WHEN al.table_name = 'medical_aid_details' THEN 'Medical Aid'
        WHEN al.table_name = 'auth_sessions' THEN 'System Access'
        ELSE al.table_name
    END as category
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC;