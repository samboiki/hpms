# Enhanced Practice Management Migration Guide

## Overview
This guide will help you safely execute the Enhanced Practice Management migration on your Supabase database.

## Migration File Location
📁 `/home/happy/projects/hpms/supabase/migrations/20250604000000_enhanced_practice_management.sql`

## 🚀 Execution Steps

### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt
   - Login to your account

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query" to create a new SQL script

3. **Execute the Migration**
   - Copy the entire content from the migration file
   - Paste it into the SQL Editor
   - Click "Run" to execute the migration
   - Monitor the output for any errors

### Option 2: Copy Migration Content to Clipboard

Here's the complete migration SQL for easy copying:

```sql
-- Enhanced Practice Management System
-- This migration adds comprehensive practice management capabilities

-- Add metadata and settings to practices table
ALTER TABLE practices ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending'));
ALTER TABLE practices ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'standard' CHECK (subscription_tier IN ('trial', 'standard', 'premium', 'enterprise'));
ALTER TABLE practices ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 10;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS max_patients INTEGER DEFAULT 1000;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Africa/Windhoek';
ALTER TABLE practices ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'NAD';
ALTER TABLE practices ADD COLUMN IF NOT EXISTS tax_number VARCHAR(50);
ALTER TABLE practices ADD COLUMN IF NOT EXISTS license_number VARCHAR(50);
ALTER TABLE practices ADD COLUMN IF NOT EXISTS admin_user_id UUID REFERENCES users(id);

-- Create tariff management tables
CREATE TABLE IF NOT EXISTS practice_tariffs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  service_name VARCHAR(255) NOT NULL,
  service_code VARCHAR(50),
  category VARCHAR(100),
  description TEXT,
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'NAD',
  is_active BOOLEAN DEFAULT true,
  medical_aid_pricing JSONB DEFAULT '{}'::jsonb, -- Different prices for different medical aids
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(practice_id, service_code)
);

-- Create practice settings table for flexible configuration
CREATE TABLE IF NOT EXISTS practice_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSONB,
  setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json', 'array')),
  description TEXT,
  is_public BOOLEAN DEFAULT false, -- Whether this setting can be shown on public pages
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(practice_id, setting_key)
);

-- Create audit logs for tracking admin actions
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50), -- 'practice', 'user', 'tariff', etc.
  resource_id UUID,
  target_practice_id UUID REFERENCES practices(id),
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create practice analytics summary table for performance tracking
CREATE TABLE IF NOT EXISTS practice_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_appointments INTEGER DEFAULT 0,
  completed_appointments INTEGER DEFAULT 0,
  cancelled_appointments INTEGER DEFAULT 0,
  new_patients INTEGER DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  total_visits INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  metrics JSONB DEFAULT '{}'::jsonb, -- Additional metrics as needed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(practice_id, period_type, period_start)
);

-- Enhance users table with admin capabilities
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_practices BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;

-- Create practice invitations table for user onboarding
CREATE TABLE IF NOT EXISTS practice_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id),
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  invitation_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification templates for practices
CREATE TABLE IF NOT EXISTS practice_notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  template_name VARCHAR(100) NOT NULL,
  template_type VARCHAR(50) NOT NULL, -- 'email', 'sms', 'app_notification'
  subject VARCHAR(255),
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb, -- Available template variables
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(practice_id, template_name, template_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_practice_tariffs_practice ON practice_tariffs(practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_tariffs_active ON practice_tariffs(practice_id, is_active);
CREATE INDEX IF NOT EXISTS idx_practice_settings_practice ON practice_settings(practice_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_practice ON admin_audit_logs(target_practice_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_practice_analytics_practice ON practice_analytics(practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_analytics_period ON practice_analytics(practice_id, period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_practice_invitations_token ON practice_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_practice_invitations_email ON practice_invitations(email);
CREATE INDEX IF NOT EXISTS idx_users_super_admin ON users(is_super_admin) WHERE is_super_admin = true;

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_practice_tariffs_updated_at BEFORE UPDATE ON practice_tariffs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_practice_settings_updated_at BEFORE UPDATE ON practice_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_practice_analytics_updated_at BEFORE UPDATE ON practice_analytics
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_practice_notification_templates_updated_at BEFORE UPDATE ON practice_notification_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default tariffs for existing practices
INSERT INTO practice_tariffs (practice_id, service_name, service_code, category, description, base_price) 
SELECT 
  p.id,
  'General Consultation',
  'CONS001',
  'Consultation',
  'Standard medical consultation',
  300.00
FROM practices p;

INSERT INTO practice_tariffs (practice_id, service_name, service_code, category, description, base_price) 
SELECT 
  p.id,
  'Follow-up Consultation',
  'CONS002',
  'Consultation',
  'Follow-up medical consultation',
  200.00
FROM practices p;

INSERT INTO practice_tariffs (practice_id, service_name, service_code, category, description, base_price) 
SELECT 
  p.id,
  'Blood Test',
  'LAB001',
  'Laboratory',
  'Basic blood work analysis',
  150.00
FROM practices p;

-- Insert default settings for existing practices
INSERT INTO practice_settings (practice_id, setting_key, setting_value, setting_type, description, is_public)
SELECT 
  p.id,
  'appointment_duration_default',
  '"30"',
  'number',
  'Default appointment duration in minutes',
  false
FROM practices p;

INSERT INTO practice_settings (practice_id, setting_key, setting_value, setting_type, description, is_public)
SELECT 
  p.id,
  'allow_online_booking',
  'true',
  'boolean',
  'Allow patients to book appointments online',
  true
FROM practices p;

INSERT INTO practice_settings (practice_id, setting_key, setting_value, setting_type, description, is_public)
SELECT 
  p.id,
  'booking_advance_days',
  '30',
  'number',
  'How many days in advance can patients book',
  false
FROM practices p;

-- Update existing practices with default values
UPDATE practices SET 
  status = 'active',
  subscription_tier = 'standard',
  max_users = 25,
  max_patients = 5000,
  timezone = 'Africa/Windhoek',
  currency = 'NAD'
WHERE status IS NULL;

-- Create RLS policies for new tables
ALTER TABLE practice_tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_notification_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for practice_tariffs
CREATE POLICY "Practice tariffs are viewable by practice members" ON practice_tariffs
  FOR SELECT USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Practice tariffs are editable by admins" ON practice_tariffs
  FOR ALL USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid() AND role IN ('admin')
    ) OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = true)
  );

-- RLS Policies for practice_settings
CREATE POLICY "Practice settings are viewable by practice members" ON practice_settings
  FOR SELECT USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Practice settings are editable by admins" ON practice_settings
  FOR ALL USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid() AND role IN ('admin')
    ) OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = true)
  );

-- RLS Policies for admin_audit_logs
CREATE POLICY "Admin audit logs are viewable by super admins" ON admin_audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Admin audit logs are insertable by all authenticated users" ON admin_audit_logs
  FOR INSERT WITH CHECK (
    admin_user_id = auth.uid()
  );

-- RLS Policies for practice_analytics
CREATE POLICY "Practice analytics are viewable by practice members" ON practice_analytics
  FOR SELECT USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = true)
  );

-- RLS Policies for practice_invitations
CREATE POLICY "Practice invitations are viewable by practice admins" ON practice_invitations
  FOR SELECT USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid() AND role IN ('admin')
    ) OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = true)
  );

CREATE POLICY "Practice invitations are manageable by practice admins" ON practice_invitations
  FOR ALL USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid() AND role IN ('admin')
    ) OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = true)
  );

-- RLS Policies for practice_notification_templates
CREATE POLICY "Practice notification templates are viewable by practice members" ON practice_notification_templates
  FOR SELECT USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Practice notification templates are editable by admins" ON practice_notification_templates
  FOR ALL USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid() AND role IN ('admin')
    ) OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Create utility functions for practice management

-- Function to get practice statistics
CREATE OR REPLACE FUNCTION get_practice_statistics(practice_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_patients', (SELECT COUNT(*) FROM patients WHERE practice_id = practice_uuid),
    'total_appointments', (SELECT COUNT(*) FROM appointments WHERE practice_id = practice_uuid),
    'appointments_today', (SELECT COUNT(*) FROM appointments WHERE practice_id = practice_uuid AND date = CURRENT_DATE),
    'active_users', (SELECT COUNT(*) FROM users WHERE practice_id = practice_uuid AND last_active_at > NOW() - INTERVAL '7 days'),
    'pending_appointments', (SELECT COUNT(*) FROM appointments WHERE practice_id = practice_uuid AND status = 'pending'),
    'completed_appointments_this_month', (
      SELECT COUNT(*) FROM appointments 
      WHERE practice_id = practice_uuid 
      AND status = 'completed' 
      AND date >= date_trunc('month', CURRENT_DATE)
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
  action_name VARCHAR(100),
  resource_type_name VARCHAR(50) DEFAULT NULL,
  resource_uuid UUID DEFAULT NULL,
  target_practice_uuid UUID DEFAULT NULL,
  old_data JSONB DEFAULT NULL,
  new_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO admin_audit_logs (
    admin_user_id,
    action,
    resource_type,
    resource_id,
    target_practice_id,
    old_values,
    new_values,
    ip_address,
    created_at
  ) VALUES (
    auth.uid(),
    action_name,
    resource_type_name,
    resource_uuid,
    target_practice_uuid,
    old_data,
    new_data,
    inet_client_addr(),
    NOW()
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for practice overview (for admin dashboard)
CREATE OR REPLACE VIEW admin_practice_overview AS
SELECT 
  p.*,
  u.full_name as admin_name,
  u.email as admin_email,
  (SELECT COUNT(*) FROM users WHERE practice_id = p.id) as total_users,
  (SELECT COUNT(*) FROM patients WHERE practice_id = p.id) as total_patients,
  (SELECT COUNT(*) FROM appointments WHERE practice_id = p.id AND date >= CURRENT_DATE - INTERVAL '30 days') as appointments_last_30_days,
  (SELECT COUNT(*) FROM appointments WHERE practice_id = p.id AND status = 'completed' AND date >= date_trunc('month', CURRENT_DATE)) as appointments_this_month
FROM practices p
LEFT JOIN users u ON u.id = p.admin_user_id;

-- Grant permissions
GRANT SELECT ON admin_practice_overview TO authenticated;

-- Insert Dr. Polina practice if it doesn't exist
INSERT INTO practices (
  slug, 
  name, 
  domain, 
  contact_email, 
  contact_phone, 
  address, 
  city, 
  hero_title, 
  hero_subtitle, 
  about_text,
  status,
  subscription_tier,
  services
) VALUES (
  'dr-polina',
  'Dr. Polina Aesthetic Clinic',
  'drpolina.com',
  'info@drpolina.com',
  '+264 61 555 0123',
  '123 Aesthetic Avenue',
  'Windhoek',
  'Transform Your Beauty with Expert Care',
  'Leading aesthetic treatments in Namibia',
  'Dr. Polina brings years of experience in aesthetic medicine to help you achieve your beauty goals with safe, effective treatments.',
  'active',
  'premium',
  '[
    {"id": "1", "name": "Botox", "description": "Anti-aging wrinkle treatments", "icon": "sparkles"},
    {"id": "2", "name": "Dermal Fillers", "description": "Facial volume restoration", "icon": "heart"},
    {"id": "3", "name": "Chemical Peels", "description": "Skin renewal treatments", "icon": "refresh"},
    {"id": "4", "name": "Skin Rejuvenation", "description": "Advanced skin therapy", "icon": "sun"}
  ]'::jsonb
) ON CONFLICT (slug) DO NOTHING;
```

## ✅ After Execution

1. **Verify the migration was successful** by checking:
   - All new tables were created
   - Existing practices table has new columns
   - RLS policies are active
   - Sample data was inserted

2. **Test the new functionality** by:
   - Viewing practice tariffs
   - Checking practice settings
   - Ensuring analytics tables are ready

## 🔍 Verification Script

Run this query to verify the migration:

```sql
-- Check if all new tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'practice_tariffs',
  'practice_settings', 
  'admin_audit_logs',
  'practice_analytics',
  'practice_invitations',
  'practice_notification_templates'
);

-- Check new columns in practices table
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'practices' 
AND column_name IN ('status', 'subscription_tier', 'timezone', 'currency');

-- Count default data
SELECT 
  (SELECT COUNT(*) FROM practice_tariffs) as tariffs_count,
  (SELECT COUNT(*) FROM practice_settings) as settings_count;
```

## 🎉 Success!

If all tables are created and contain data, the migration was successful!