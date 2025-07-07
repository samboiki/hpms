-- =====================================================
-- COMPREHENSIVE PRACTICE MANAGEMENT SYSTEM MIGRATION
-- Version: 2.0
-- Date: 2025-06-05
-- Features: Enhanced Tariffs, SMS Management, Comprehensive Reporting, OneHealth Admin
-- =====================================================

-- 1. ENHANCED TARIFF STRUCTURE
-- =====================================================

-- Drop existing practice_tariffs if it exists and recreate with enhanced structure
DROP TABLE IF EXISTS practice_tariffs CASCADE;

CREATE TABLE practice_tariffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
  code TEXT NOT NULL, -- e.g., 8101, 8104, etc.
  price DECIMAL(10,2) NOT NULL,
  namaf_prace_2025 TEXT NOT NULL, -- service name
  edi_diagnosi TEXT, -- diagnosis code
  full_description TEXT,
  practice_type TEXT NOT NULL CHECK (practice_type IN ('dental', 'medical', 'aesthetic', 'specialist', 'general')),
  practice_subtypes TEXT[], -- array for multiple subtypes like ['General Dental Practitioners', 'Specialists']
  category TEXT, -- grouping category
  subcategory TEXT, -- subcategory for better organization
  unit TEXT DEFAULT 'per visit', -- unit of measurement
  is_active BOOLEAN DEFAULT true,
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(practice_id, code, effective_from)
);

-- Create indexes for performance
CREATE INDEX idx_practice_tariffs_practice_id ON practice_tariffs(practice_id);
CREATE INDEX idx_practice_tariffs_code ON practice_tariffs(code);
CREATE INDEX idx_practice_tariffs_type ON practice_tariffs(practice_type);
CREATE INDEX idx_practice_tariffs_active ON practice_tariffs(is_active);
CREATE INDEX idx_practice_tariffs_effective ON practice_tariffs(effective_from, effective_to);

-- 2. SMS MANAGEMENT SYSTEM
-- =====================================================

-- SMS Plans and Pricing
CREATE TABLE sms_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  monthly_sms_limit INTEGER NOT NULL,
  price_per_month DECIMAL(10,2) NOT NULL,
  price_per_additional_sms DECIMAL(5,4) NOT NULL,
  features JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Practice SMS subscriptions
CREATE TABLE practice_sms_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES sms_plans(id),
  monthly_limit INTEGER NOT NULL,
  additional_sms_purchased INTEGER DEFAULT 0,
  current_usage INTEGER DEFAULT 0,
  billing_cycle_start DATE NOT NULL,
  billing_cycle_end DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- SMS Usage Tracking
CREATE TABLE sms_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES practice_sms_subscriptions(id),
  recipient_phone TEXT NOT NULL,
  message_content TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('appointment_reminder', 'appointment_confirmation', 'marketing', 'emergency', 'follow_up', 'custom')),
  status TEXT CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')) DEFAULT 'pending',
  cost DECIMAL(5,4) NOT NULL DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  portal_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- SMS Templates
CREATE TABLE sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_type TEXT CHECK (template_type IN ('appointment_reminder', 'appointment_confirmation', 'marketing', 'follow_up', 'custom')),
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb, -- array of available variables like ["patient_name", "appointment_date"]
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- SMS Portal Configuration
CREATE TABLE sms_portal_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
  portal_name TEXT NOT NULL,
  api_endpoint TEXT NOT NULL,
  api_key TEXT NOT NULL,
  username TEXT,
  password TEXT,
  sender_id TEXT NOT NULL,
  webhook_url TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(practice_id)
);

-- Insert default SMS plans
INSERT INTO sms_plans (name, description, monthly_sms_limit, price_per_month, price_per_additional_sms, features) VALUES
('Starter', 'Basic SMS plan for small practices', 500, 150.00, 0.40, '{"support": "email", "analytics": "basic"}'::jsonb),
('Professional', 'Perfect for growing practices', 2000, 450.00, 0.35, '{"support": "priority", "analytics": "advanced", "templates": "unlimited"}'::jsonb),
('Enterprise', 'Unlimited SMS for large practices', 10000, 1200.00, 0.30, '{"support": "dedicated", "analytics": "premium", "templates": "unlimited", "api_access": true}'::jsonb),
('Custom', 'Tailored SMS solution', 0, 0.00, 0.25, '{"support": "dedicated", "analytics": "premium", "templates": "unlimited", "api_access": true, "custom_features": true}'::jsonb);

-- Insert default SMS templates
INSERT INTO sms_templates (practice_id, name, template_type, content, variables, is_default) 
SELECT p.id, 'Appointment Reminder', 'appointment_reminder', 
'Hi {{patient_name}}, this is a reminder for your appointment on {{appointment_date}} at {{appointment_time}} with Dr. {{doctor_name}}. Please reply CONFIRM or call us at {{practice_phone}}.', 
'["patient_name", "appointment_date", "appointment_time", "doctor_name", "practice_phone"]'::jsonb, true
FROM practices p;

INSERT INTO sms_templates (practice_id, name, template_type, content, variables, is_default) 
SELECT p.id, 'Appointment Confirmation', 'appointment_confirmation', 
'Dear {{patient_name}}, your appointment has been confirmed for {{appointment_date}} at {{appointment_time}}. Please arrive 15 minutes early. Address: {{practice_address}}', 
'["patient_name", "appointment_date", "appointment_time", "practice_address"]'::jsonb, true
FROM practices p;

-- 3. COMPREHENSIVE REPORTING VIEWS
-- =====================================================

-- Practice Performance Dashboard View
CREATE OR REPLACE VIEW practice_performance_dashboard AS
WITH appointment_stats AS (
  SELECT 
    p.id as practice_id,
    p.name as practice_name,
    COUNT(a.id) as total_appointments,
    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
    COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled_appointments,
    COUNT(CASE WHEN a.status = 'no_show' THEN 1 END) as no_show_appointments,
    COUNT(CASE WHEN a.appointment_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as appointments_last_30_days,
    COUNT(CASE WHEN a.appointment_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as appointments_last_7_days
  FROM practices p
  LEFT JOIN appointments a ON a.practice_id = p.id
  GROUP BY p.id, p.name
),
patient_stats AS (
  SELECT 
    p.id as practice_id,
    COUNT(pt.id) as total_patients,
    COUNT(CASE WHEN pt.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_patients_30_days,
    COUNT(CASE WHEN pt.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_patients_7_days
  FROM practices p
  LEFT JOIN patients pt ON pt.practice_id = p.id
  GROUP BY p.id
),
revenue_stats AS (
  SELECT 
    p.id as practice_id,
    COALESCE(SUM(pt.price), 0) as total_potential_revenue,
    COUNT(DISTINCT pt.code) as active_services
  FROM practices p
  LEFT JOIN practice_tariffs pt ON pt.practice_id = p.id AND pt.is_active = true
  GROUP BY p.id
),
sms_stats AS (
  SELECT 
    p.id as practice_id,
    COALESCE(sms.monthly_limit, 0) as sms_monthly_limit,
    COALESCE(sms.current_usage, 0) as sms_current_usage,
    COALESCE(COUNT(sms_logs.id), 0) as sms_sent_last_30_days
  FROM practices p
  LEFT JOIN practice_sms_subscriptions sms ON sms.practice_id = p.id AND sms.is_active = true
  LEFT JOIN sms_usage_logs sms_logs ON sms_logs.practice_id = p.id 
    AND sms_logs.created_at >= CURRENT_DATE - INTERVAL '30 days'
    AND sms_logs.status = 'delivered'
  GROUP BY p.id, sms.monthly_limit, sms.current_usage
)
SELECT 
  p.id as practice_id,
  p.name as practice_name,
  p.slug,
  p.city,
  p.contact_email,
  p.contact_phone,
  
  -- Appointment metrics
  COALESCE(a.total_appointments, 0) as total_appointments,
  COALESCE(a.completed_appointments, 0) as completed_appointments,
  COALESCE(a.cancelled_appointments, 0) as cancelled_appointments,
  COALESCE(a.no_show_appointments, 0) as no_show_appointments,
  COALESCE(a.appointments_last_30_days, 0) as appointments_last_30_days,
  COALESCE(a.appointments_last_7_days, 0) as appointments_last_7_days,
  
  -- Patient metrics  
  COALESCE(pt.total_patients, 0) as total_patients,
  COALESCE(pt.new_patients_30_days, 0) as new_patients_30_days,
  COALESCE(pt.new_patients_7_days, 0) as new_patients_7_days,
  
  -- Revenue metrics
  COALESCE(r.total_potential_revenue, 0) as total_potential_revenue,
  COALESCE(r.active_services, 0) as active_services,
  
  -- SMS metrics
  COALESCE(s.sms_monthly_limit, 0) as sms_monthly_limit,
  COALESCE(s.sms_current_usage, 0) as sms_current_usage,
  COALESCE(s.sms_sent_last_30_days, 0) as sms_sent_last_30_days,
  
  -- Calculated metrics
  CASE 
    WHEN COALESCE(a.total_appointments, 0) > 0 
    THEN ROUND((COALESCE(a.completed_appointments, 0) * 100.0 / a.total_appointments), 2)
    ELSE 0
  END as completion_rate_percentage,
  
  CASE 
    WHEN COALESCE(s.sms_monthly_limit, 0) > 0 
    THEN ROUND((COALESCE(s.sms_current_usage, 0) * 100.0 / s.sms_monthly_limit), 2)
    ELSE 0
  END as sms_usage_percentage,
  
  p.created_at as practice_created_at
FROM practices p
LEFT JOIN appointment_stats a ON a.practice_id = p.id
LEFT JOIN patient_stats pt ON pt.practice_id = p.id
LEFT JOIN revenue_stats r ON r.practice_id = p.id
LEFT JOIN sms_stats s ON s.practice_id = p.id
ORDER BY p.name;

-- Financial Summary View
CREATE OR REPLACE VIEW financial_summary_by_practice AS
WITH monthly_appointments AS (
  SELECT 
    practice_id,
    DATE_TRUNC('month', appointment_date) as month,
    COUNT(*) as appointment_count,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
  FROM appointments 
  WHERE appointment_date >= CURRENT_DATE - INTERVAL '12 months'
  GROUP BY practice_id, DATE_TRUNC('month', appointment_date)
),
tariff_revenue AS (
  SELECT 
    practice_id,
    SUM(price) as total_tariff_value,
    AVG(price) as average_tariff_price,
    COUNT(*) as total_services
  FROM practice_tariffs 
  WHERE is_active = true
  GROUP BY practice_id
)
SELECT 
  p.id as practice_id,
  p.name as practice_name,
  
  -- Revenue estimates (based on completed appointments and average tariff)
  COALESCE(tr.total_tariff_value, 0) as total_potential_monthly_revenue,
  COALESCE(tr.average_tariff_price, 0) as average_service_price,
  COALESCE(tr.total_services, 0) as total_active_services,
  
  -- Monthly appointment trends
  COALESCE(SUM(ma.appointment_count), 0) as total_appointments_12_months,
  COALESCE(SUM(ma.completed_count), 0) as total_completed_12_months,
  COALESCE(AVG(ma.appointment_count), 0) as avg_monthly_appointments,
  COALESCE(AVG(ma.completed_count), 0) as avg_monthly_completed,
  
  -- Estimated revenue based on completed appointments
  COALESCE(SUM(ma.completed_count) * tr.average_tariff_price, 0) as estimated_revenue_12_months,
  COALESCE(AVG(ma.completed_count) * tr.average_tariff_price, 0) as estimated_monthly_revenue
  
FROM practices p
LEFT JOIN monthly_appointments ma ON ma.practice_id = p.id
LEFT JOIN tariff_revenue tr ON tr.practice_id = p.id
GROUP BY p.id, p.name, tr.total_tariff_value, tr.average_tariff_price, tr.total_services
ORDER BY estimated_revenue_12_months DESC;

-- User Activity Analytics View
CREATE OR REPLACE VIEW user_activity_analytics AS
WITH user_stats AS (
  SELECT 
    u.id as user_id,
    u.practice_id,
    u.email,
    u.full_name,
    u.role,
    u.last_login,
    u.created_at as user_created_at,
    
    -- Count appointments they're associated with
    COUNT(a.id) as total_appointments,
    COUNT(CASE WHEN a.appointment_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as appointments_last_30_days,
    
    -- Count visits they've conducted
    COUNT(v.id) as total_visits,
    COUNT(CASE WHEN v.visit_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as visits_last_30_days,
    
    -- Last activity dates
    MAX(a.appointment_date) as last_appointment_date,
    MAX(v.visit_date) as last_visit_date
    
  FROM users u
  LEFT JOIN appointments a ON a.doctor_id = u.id
  LEFT JOIN visits v ON v.doctor_id = u.id
  GROUP BY u.id, u.practice_id, u.email, u.full_name, u.role, u.last_login, u.user_created_at
)
SELECT 
  us.*,
  p.name as practice_name,
  
  -- Activity scoring
  CASE 
    WHEN us.last_login >= CURRENT_DATE - INTERVAL '7 days' THEN 'Very Active'
    WHEN us.last_login >= CURRENT_DATE - INTERVAL '30 days' THEN 'Active'  
    WHEN us.last_login >= CURRENT_DATE - INTERVAL '90 days' THEN 'Moderately Active'
    ELSE 'Inactive'
  END as activity_level,
  
  -- Days since last login
  CASE 
    WHEN us.last_login IS NOT NULL 
    THEN EXTRACT(DAYS FROM (CURRENT_DATE - us.last_login::date))
    ELSE NULL
  END as days_since_last_login
  
FROM user_stats us
LEFT JOIN practices p ON p.id = us.practice_id
ORDER BY us.last_login DESC NULLS LAST;

-- Cross-Practice Comparison View
CREATE OR REPLACE VIEW cross_practice_comparison AS
WITH practice_metrics AS (
  SELECT 
    id as practice_id,
    name as practice_name,
    created_at as practice_created_at,
    EXTRACT(DAYS FROM (CURRENT_DATE - created_at::date)) as days_active
  FROM practices
),
comparative_stats AS (
  SELECT 
    pm.*,
    
    -- Patient metrics
    (SELECT COUNT(*) FROM patients WHERE practice_id = pm.practice_id) as total_patients,
    (SELECT COUNT(*) FROM patients WHERE practice_id = pm.practice_id 
     AND created_at >= CURRENT_DATE - INTERVAL '30 days') as new_patients_30_days,
    
    -- Appointment metrics
    (SELECT COUNT(*) FROM appointments WHERE practice_id = pm.practice_id) as total_appointments,
    (SELECT COUNT(*) FROM appointments WHERE practice_id = pm.practice_id 
     AND status = 'completed') as completed_appointments,
    
    -- User metrics
    (SELECT COUNT(*) FROM users WHERE practice_id = pm.practice_id) as total_staff,
    
    -- Service metrics
    (SELECT COUNT(*) FROM practice_tariffs WHERE practice_id = pm.practice_id 
     AND is_active = true) as active_services,
    (SELECT AVG(price) FROM practice_tariffs WHERE practice_id = pm.practice_id 
     AND is_active = true) as avg_service_price,
     
    -- SMS metrics
    (SELECT monthly_limit FROM practice_sms_subscriptions 
     WHERE practice_id = pm.practice_id AND is_active = true LIMIT 1) as sms_monthly_limit,
    (SELECT current_usage FROM practice_sms_subscriptions 
     WHERE practice_id = pm.practice_id AND is_active = true LIMIT 1) as sms_current_usage
     
  FROM practice_metrics pm
)
SELECT 
  *,
  
  -- Efficiency metrics
  CASE 
    WHEN total_appointments > 0 
    THEN ROUND((completed_appointments * 100.0 / total_appointments), 2)
    ELSE 0
  END as completion_rate,
  
  CASE 
    WHEN days_active > 0 
    THEN ROUND((total_patients * 1.0 / days_active * 30), 2)
    ELSE 0
  END as avg_new_patients_per_month,
  
  CASE 
    WHEN total_staff > 0 
    THEN ROUND((total_patients * 1.0 / total_staff), 2)
    ELSE 0
  END as patients_per_staff_member,
  
  -- Ranking
  RANK() OVER (ORDER BY total_patients DESC) as patients_rank,
  RANK() OVER (ORDER BY completed_appointments DESC) as appointments_rank,
  RANK() OVER (ORDER BY avg_service_price DESC NULLS LAST) as pricing_rank
  
FROM comparative_stats
ORDER BY total_patients DESC;

-- SMS Analytics View
CREATE OR REPLACE VIEW sms_analytics_dashboard AS
WITH monthly_sms_usage AS (
  SELECT 
    practice_id,
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as messages_sent,
    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as messages_delivered,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as messages_failed,
    SUM(cost) as total_cost,
    message_type
  FROM sms_usage_logs
  WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
  GROUP BY practice_id, DATE_TRUNC('month', created_at), message_type
)
SELECT 
  p.id as practice_id,
  p.name as practice_name,
  
  -- Current subscription info
  sms.monthly_limit,
  sms.current_usage,
  sms.additional_sms_purchased,
  sp.name as plan_name,
  sp.price_per_month as plan_monthly_cost,
  
  -- Usage statistics
  COALESCE(SUM(msu.messages_sent), 0) as total_messages_12_months,
  COALESCE(SUM(msu.messages_delivered), 0) as total_delivered_12_months,
  COALESCE(SUM(msu.messages_failed), 0) as total_failed_12_months,
  COALESCE(SUM(msu.total_cost), 0) as total_cost_12_months,
  
  -- Delivery rate
  CASE 
    WHEN SUM(msu.messages_sent) > 0 
    THEN ROUND((SUM(msu.messages_delivered) * 100.0 / SUM(msu.messages_sent)), 2)
    ELSE 0
  END as delivery_rate_percentage,
  
  -- Monthly averages
  COALESCE(AVG(msu.messages_sent), 0) as avg_monthly_messages,
  COALESCE(AVG(msu.total_cost), 0) as avg_monthly_cost,
  
  -- Usage efficiency
  CASE 
    WHEN sms.monthly_limit > 0 
    THEN ROUND((sms.current_usage * 100.0 / sms.monthly_limit), 2)
    ELSE 0
  END as current_usage_percentage

FROM practices p
LEFT JOIN practice_sms_subscriptions sms ON sms.practice_id = p.id AND sms.is_active = true
LEFT JOIN sms_plans sp ON sp.id = sms.plan_id
LEFT JOIN monthly_sms_usage msu ON msu.practice_id = p.id
GROUP BY p.id, p.name, sms.monthly_limit, sms.current_usage, sms.additional_sms_purchased, 
         sp.name, sp.price_per_month
ORDER BY total_messages_12_months DESC;

-- 4. ONEHEALTH ADMINISTRATION SETUP
-- =====================================================

-- Super Admin Roles and Permissions
CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB DEFAULT '{}'::jsonb,
  is_super_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- OneHealth Admin Users
CREATE TABLE IF NOT EXISTS onehealth_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id UUID REFERENCES admin_roles(id),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Admin Activity Logs
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES onehealth_admins(id),
  action TEXT NOT NULL,
  resource TEXT,
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert admin roles
INSERT INTO admin_roles (name, description, permissions, is_super_admin) VALUES
('Super Administrator', 'Full system access', '{
  "practices": {"read": true, "write": true, "delete": true},
  "users": {"read": true, "write": true, "delete": true},
  "billing": {"read": true, "write": true},
  "sms": {"read": true, "write": true, "manage_plans": true},
  "reports": {"read": true, "export": true},
  "system": {"read": true, "write": true, "manage_admins": true}
}'::jsonb, true),

('Practice Manager', 'Manage practices and users', '{
  "practices": {"read": true, "write": true, "delete": false},
  "users": {"read": true, "write": true, "delete": false},
  "billing": {"read": true, "write": false},
  "sms": {"read": true, "write": true, "manage_plans": false},
  "reports": {"read": true, "export": true}
}'::jsonb, false),

('Billing Administrator', 'Manage billing and payments', '{
  "practices": {"read": true, "write": false, "delete": false},
  "billing": {"read": true, "write": true},
  "sms": {"read": true, "write": true, "manage_plans": true},
  "reports": {"read": true, "export": true}
}'::jsonb, false),

('Support Agent', 'Read-only access for support', '{
  "practices": {"read": true, "write": false, "delete": false},
  "users": {"read": true, "write": false, "delete": false},
  "reports": {"read": true, "export": false}
}'::jsonb, false);

-- 5. DENTAL TARIFF DATA IMPORT
-- =====================================================

-- Insert comprehensive dental tariff data
INSERT INTO practice_tariffs (practice_id, code, price, namaf_prace_2025, edi_diagnosi, full_description, practice_type, practice_subtypes, category, subcategory) VALUES
-- Dental Consultation and Examination Codes
(NULL, '8101', 450.00, 'Oral Health Assessment', 'Z01.20', 'Comprehensive oral health assessment including medical history, clinical examination, and treatment planning', 'dental', ARRAY['General Dental Practitioners', 'Specialists'], 'Consultation', 'Examination'),
(NULL, '8102', 350.00, 'Limited Oral Examination', 'Z01.20', 'Problem-focused oral examination for specific complaint', 'dental', ARRAY['General Dental Practitioners', 'Specialists'], 'Consultation', 'Examination'),
(NULL, '8103', 280.00, 'Emergency Oral Examination', 'Z01.20', 'Emergency examination for acute dental problems', 'dental', ARRAY['General Dental Practitioners', 'Emergency Services'], 'Consultation', 'Emergency'),
(NULL, '8104', 200.00, 'Follow-up Examination', 'Z01.20', 'Routine follow-up examination post-treatment', 'dental', ARRAY['General Dental Practitioners', 'Specialists'], 'Consultation', 'Follow-up'),

-- Diagnostic and Imaging
(NULL, '8201', 180.00, 'Intraoral Radiograph (Single)', 'Z87.891', 'Single periapical or bitewing radiograph', 'dental', ARRAY['General Dental Practitioners', 'Specialists'], 'Diagnostic', 'Radiography'),
(NULL, '8202', 320.00, 'Bitewing Radiographs (Set)', 'Z87.891', 'Full mouth bitewing radiographic series', 'dental', ARRAY['General Dental Practitioners', 'Specialists'], 'Diagnostic', 'Radiography'),
(NULL, '8203', 850.00, 'Panoramic Radiograph', 'Z87.891', 'Panoramic radiographic examination', 'dental', ARRAY['General Dental Practitioners', 'Specialists'], 'Diagnostic', 'Radiography'),
(NULL, '8204', 2500.00, 'CBCT Scan (Limited)', 'Z87.891', 'Cone beam computed tomography - limited area', 'dental', ARRAY['Specialists', 'Oral Surgeons'], 'Diagnostic', 'Advanced Imaging'),

-- Preventive Services
(NULL, '8301', 650.00, 'Professional Dental Cleaning', 'Z29.3', 'Prophylaxis including scaling and polishing', 'dental', ARRAY['General Dental Practitioners', 'Dental Hygienists'], 'Preventive', 'Cleaning'),
(NULL, '8302', 380.00, 'Fluoride Treatment (Professional)', 'Z29.3', 'Professional fluoride application', 'dental', ARRAY['General Dental Practitioners', 'Dental Hygienists'], 'Preventive', 'Fluoride'),
(NULL, '8303', 450.00, 'Dental Sealant (Per Tooth)', 'Z29.3', 'Pit and fissure sealant application', 'dental', ARRAY['General Dental Practitioners'], 'Preventive', 'Sealants'),
(NULL, '8304', 1200.00, 'Deep Cleaning (Per Quadrant)', 'K05.00', 'Scaling and root planing per quadrant', 'dental', ARRAY['General Dental Practitioners', 'Periodontists'], 'Preventive', 'Deep Cleaning'),

-- Restorative Dentistry
(NULL, '8401', 850.00, 'Amalgam Filling (1 Surface)', 'K02.9', 'Amalgam restoration - single surface', 'dental', ARRAY['General Dental Practitioners'], 'Restorative', 'Fillings'),
(NULL, '8402', 1200.00, 'Amalgam Filling (2 Surfaces)', 'K02.9', 'Amalgam restoration - two surfaces', 'dental', ARRAY['General Dental Practitioners'], 'Restorative', 'Fillings'),
(NULL, '8403', 1500.00, 'Amalgam Filling (3+ Surfaces)', 'K02.9', 'Amalgam restoration - three or more surfaces', 'dental', ARRAY['General Dental Practitioners'], 'Restorative', 'Fillings'),
(NULL, '8404', 1200.00, 'Composite Filling (1 Surface)', 'K02.9', 'Composite resin restoration - single surface', 'dental', ARRAY['General Dental Practitioners'], 'Restorative', 'Fillings'),
(NULL, '8405', 1600.00, 'Composite Filling (2 Surfaces)', 'K02.9', 'Composite resin restoration - two surfaces', 'dental', ARRAY['General Dental Practitioners'], 'Restorative', 'Fillings'),
(NULL, '8406', 2000.00, 'Composite Filling (3+ Surfaces)', 'K02.9', 'Composite resin restoration - three or more surfaces', 'dental', ARRAY['General Dental Practitioners'], 'Restorative', 'Fillings'),

-- Endodontic Treatment
(NULL, '8501', 2800.00, 'Root Canal Treatment (Anterior)', 'K04.9', 'Endodontic treatment - anterior tooth', 'dental', ARRAY['General Dental Practitioners', 'Endodontists'], 'Endodontic', 'Root Canal'),
(NULL, '8502', 3500.00, 'Root Canal Treatment (Premolar)', 'K04.9', 'Endodontic treatment - premolar tooth', 'dental', ARRAY['General Dental Practitioners', 'Endodontists'], 'Endodontic', 'Root Canal'),
(NULL, '8503', 4200.00, 'Root Canal Treatment (Molar)', 'K04.9', 'Endodontic treatment - molar tooth', 'dental', ARRAY['General Dental Practitioners', 'Endodontists'], 'Endodontic', 'Root Canal'),
(NULL, '8504', 1800.00, 'Pulpotomy', 'K04.1', 'Partial pulp removal - vital pulpotomy', 'dental', ARRAY['General Dental Practitioners', 'Pediatric Dentists'], 'Endodontic', 'Pulp Treatment'),

-- Prosthodontic Services
(NULL, '8601', 8500.00, 'Crown (Porcelain Fused to Metal)', 'K08.1', 'Single crown - porcelain fused to metal', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Crowns'),
(NULL, '8602', 12000.00, 'Crown (All Ceramic)', 'K08.1', 'Single crown - all ceramic/porcelain', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Crowns'),
(NULL, '8603', 15000.00, 'Crown (Zirconia)', 'K08.1', 'Single crown - zirconia', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Crowns'),
(NULL, '8604', 6500.00, 'Bridge (Per Unit)', 'K08.1', 'Fixed bridge - per unit', 'dental', ARRAY['General Dental Practitioners', 'Prosthodontists'], 'Prosthodontic', 'Bridges'),

-- Oral Surgery
(NULL, '8701', 1200.00, 'Simple Extraction', 'K08.1', 'Simple tooth extraction', 'dental', ARRAY['General Dental Practitioners', 'Oral Surgeons'], 'Oral Surgery', 'Extractions'),
(NULL, '8702', 2200.00, 'Surgical Extraction', 'K08.1', 'Surgical tooth extraction', 'dental', ARRAY['General Dental Practitioners', 'Oral Surgeons'], 'Oral Surgery', 'Extractions'),
(NULL, '8703', 3500.00, 'Impacted Wisdom Tooth Extraction', 'K01.1', 'Surgical removal of impacted third molar', 'dental', ARRAY['Oral Surgeons'], 'Oral Surgery', 'Extractions'),
(NULL, '8704', 25000.00, 'Dental Implant (Single)', 'K08.3', 'Single dental implant placement', 'dental', ARRAY['Oral Surgeons', 'Prosthodontists'], 'Oral Surgery', 'Implants'),

-- Periodontal Treatment
(NULL, '8801', 1800.00, 'Gingivectomy (Per Quadrant)', 'K05.1', 'Surgical removal of gingival tissue', 'dental', ARRAY['Periodontists', 'General Dental Practitioners'], 'Periodontal', 'Surgery'),
(NULL, '8802', 4500.00, 'Gum Graft (Per Site)', 'K06.2', 'Soft tissue graft procedure', 'dental', ARRAY['Periodontists'], 'Periodontal', 'Surgery'),
(NULL, '8803', 3200.00, 'Bone Graft (Small)', 'K08.2', 'Bone grafting procedure - small area', 'dental', ARRAY['Periodontists', 'Oral Surgeons'], 'Periodontal', 'Surgery'),

-- Orthodontic Treatment
(NULL, '8901', 85000.00, 'Complete Orthodontic Treatment', 'K07.9', 'Comprehensive orthodontic treatment', 'dental', ARRAY['Orthodontists'], 'Orthodontic', 'Treatment'),
(NULL, '8902', 25000.00, 'Orthodontic Consultation and Records', 'K07.9', 'Initial orthodontic consultation and diagnostic records', 'dental', ARRAY['Orthodontists'], 'Orthodontic', 'Consultation'),
(NULL, '8903', 2500.00, 'Orthodontic Adjustment', 'K07.9', 'Orthodontic appliance adjustment', 'dental', ARRAY['Orthodontists'], 'Orthodontic', 'Adjustment'),

-- Pediatric Dentistry
(NULL, '9001', 380.00, 'Pediatric Oral Health Assessment', 'Z01.20', 'Oral health assessment for children', 'dental', ARRAY['Pediatric Dentists', 'General Dental Practitioners'], 'Pediatric', 'Examination'),
(NULL, '9002', 750.00, 'Pediatric Cleaning', 'Z29.3', 'Professional cleaning for children', 'dental', ARRAY['Pediatric Dentists', 'General Dental Practitioners'], 'Pediatric', 'Preventive'),
(NULL, '9003', 2200.00, 'Stainless Steel Crown', 'K02.9', 'Pediatric stainless steel crown', 'dental', ARRAY['Pediatric Dentists'], 'Pediatric', 'Restorative'),

-- Emergency Services
(NULL, '9101', 680.00, 'Emergency Pain Relief', 'K08.8', 'Emergency treatment for dental pain', 'dental', ARRAY['General Dental Practitioners', 'Emergency Services'], 'Emergency', 'Pain Management'),
(NULL, '9102', 450.00, 'Temporary Filling', 'K02.9', 'Temporary restoration', 'dental', ARRAY['General Dental Practitioners'], 'Emergency', 'Temporary Treatment'),
(NULL, '9103', 850.00, 'Trauma Assessment', 'S02.5', 'Assessment and initial treatment of dental trauma', 'dental', ARRAY['General Dental Practitioners', 'Oral Surgeons'], 'Emergency', 'Trauma');

-- Update existing practices to assign some tariffs
UPDATE practice_tariffs SET practice_id = (SELECT id FROM practices WHERE slug = 'cityclinic' LIMIT 1) 
WHERE code IN ('8101', '8102', '8301', '8401', '8501', '8701');

UPDATE practice_tariffs SET practice_id = (SELECT id FROM practices WHERE slug = 'coastalmed' LIMIT 1) 
WHERE code IN ('8103', '8104', '8302', '8402', '8502', '8702');

-- 6. CREATE INDEXES AND CONSTRAINTS
-- =====================================================

-- SMS Management Indexes
CREATE INDEX idx_practice_sms_subscriptions_practice ON practice_sms_subscriptions(practice_id);
CREATE INDEX idx_practice_sms_subscriptions_active ON practice_sms_subscriptions(is_active);
CREATE INDEX idx_sms_usage_logs_practice ON sms_usage_logs(practice_id);
CREATE INDEX idx_sms_usage_logs_status ON sms_usage_logs(status);
CREATE INDEX idx_sms_usage_logs_created ON sms_usage_logs(created_at);
CREATE INDEX idx_sms_templates_practice ON sms_templates(practice_id);
CREATE INDEX idx_sms_templates_type ON sms_templates(template_type);

-- Admin Management Indexes
CREATE INDEX idx_onehealth_admins_email ON onehealth_admins(email);
CREATE INDEX idx_onehealth_admins_active ON onehealth_admins(is_active);
CREATE INDEX idx_admin_activity_logs_admin ON admin_activity_logs(admin_id);
CREATE INDEX idx_admin_activity_logs_created ON admin_activity_logs(created_at);

-- 7. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE practice_tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sms_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_portal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE onehealth_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Practice Tariffs RLS
CREATE POLICY "practice_tariffs_select" ON practice_tariffs FOR SELECT USING (
  practice_id IS NULL OR 
  practice_id IN (SELECT practice_id FROM users WHERE users.id = auth.uid())
);

CREATE POLICY "practice_tariffs_insert" ON practice_tariffs FOR INSERT WITH CHECK (
  practice_id IN (SELECT practice_id FROM users WHERE users.id = auth.uid() AND role IN ('admin', 'doctor'))
);

-- SMS Management RLS
CREATE POLICY "sms_plans_select" ON sms_plans FOR SELECT USING (true);

CREATE POLICY "practice_sms_select" ON practice_sms_subscriptions FOR SELECT USING (
  practice_id IN (SELECT practice_id FROM users WHERE users.id = auth.uid())
);

CREATE POLICY "sms_usage_select" ON sms_usage_logs FOR SELECT USING (
  practice_id IN (SELECT practice_id FROM users WHERE users.id = auth.uid())
);

CREATE POLICY "sms_templates_select" ON sms_templates FOR SELECT USING (
  practice_id IN (SELECT practice_id FROM users WHERE users.id = auth.uid())
);

-- 8. UTILITY FUNCTIONS
-- =====================================================

-- Function to calculate SMS usage for a practice
CREATE OR REPLACE FUNCTION calculate_sms_usage(practice_uuid UUID, billing_start DATE, billing_end DATE)
RETURNS TABLE (
  total_sent INTEGER,
  total_delivered INTEGER,
  total_failed INTEGER,
  total_cost DECIMAL(10,2),
  usage_by_type JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH usage_stats AS (
    SELECT 
      COUNT(*) as sent,
      COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
      SUM(cost) as cost,
      jsonb_object_agg(message_type, COUNT(*)) as by_type
    FROM sms_usage_logs 
    WHERE practice_id = practice_uuid 
      AND created_at >= billing_start 
      AND created_at <= billing_end
  )
  SELECT 
    sent::INTEGER,
    delivered::INTEGER, 
    failed::INTEGER,
    cost::DECIMAL(10,2),
    by_type::JSONB
  FROM usage_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get practice performance metrics
CREATE OR REPLACE FUNCTION get_practice_metrics(practice_uuid UUID, days_back INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  WITH metrics AS (
    SELECT 
      -- Patient metrics
      (SELECT COUNT(*) FROM patients WHERE practice_id = practice_uuid) as total_patients,
      (SELECT COUNT(*) FROM patients WHERE practice_id = practice_uuid 
       AND created_at >= CURRENT_DATE - INTERVAL '1 day' * days_back) as new_patients,
      
      -- Appointment metrics  
      (SELECT COUNT(*) FROM appointments WHERE practice_id = practice_uuid) as total_appointments,
      (SELECT COUNT(*) FROM appointments WHERE practice_id = practice_uuid 
       AND appointment_date >= CURRENT_DATE - INTERVAL '1 day' * days_back) as recent_appointments,
      (SELECT COUNT(*) FROM appointments WHERE practice_id = practice_uuid 
       AND status = 'completed' AND appointment_date >= CURRENT_DATE - INTERVAL '1 day' * days_back) as completed_appointments,
       
      -- SMS metrics
      (SELECT monthly_limit FROM practice_sms_subscriptions 
       WHERE practice_id = practice_uuid AND is_active = true LIMIT 1) as sms_limit,
      (SELECT current_usage FROM practice_sms_subscriptions 
       WHERE practice_id = practice_uuid AND is_active = true LIMIT 1) as sms_usage,
       
      -- Revenue metrics
      (SELECT COUNT(*) FROM practice_tariffs WHERE practice_id = practice_uuid AND is_active = true) as active_services,
      (SELECT AVG(price) FROM practice_tariffs WHERE practice_id = practice_uuid AND is_active = true) as avg_service_price
  )
  SELECT jsonb_build_object(
    'patients', jsonb_build_object(
      'total', total_patients,
      'new_in_period', new_patients
    ),
    'appointments', jsonb_build_object(
      'total', total_appointments,
      'recent', recent_appointments,
      'completed', completed_appointments,
      'completion_rate', CASE WHEN recent_appointments > 0 THEN ROUND((completed_appointments * 100.0 / recent_appointments), 2) ELSE 0 END
    ),
    'sms', jsonb_build_object(
      'monthly_limit', COALESCE(sms_limit, 0),
      'current_usage', COALESCE(sms_usage, 0),
      'usage_percentage', CASE WHEN sms_limit > 0 THEN ROUND((sms_usage * 100.0 / sms_limit), 2) ELSE 0 END
    ),
    'services', jsonb_build_object(
      'active_count', COALESCE(active_services, 0),
      'average_price', COALESCE(avg_service_price, 0)
    )
  ) INTO result
  FROM metrics;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. TRIGGERS FOR AUTOMATED UPDATES
-- =====================================================

-- Trigger to update SMS usage when new messages are logged
CREATE OR REPLACE FUNCTION update_sms_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Update current usage in subscription
  UPDATE practice_sms_subscriptions 
  SET current_usage = current_usage + 1,
      updated_at = NOW()
  WHERE practice_id = NEW.practice_id 
    AND is_active = true
    AND billing_cycle_start <= NEW.created_at::date 
    AND billing_cycle_end >= NEW.created_at::date;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sms_usage_update_trigger
  AFTER INSERT ON sms_usage_logs
  FOR EACH ROW EXECUTE FUNCTION update_sms_usage();

-- Trigger to update tariff updated_at timestamp
CREATE TRIGGER update_tariffs_updated_at 
  BEFORE UPDATE ON practice_tariffs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update SMS subscription updated_at timestamp  
CREATE TRIGGER update_sms_subscription_updated_at 
  BEFORE UPDATE ON practice_sms_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update SMS template updated_at timestamp
CREATE TRIGGER update_sms_template_updated_at 
  BEFORE UPDATE ON sms_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update admin updated_at timestamp
CREATE TRIGGER update_admin_updated_at 
  BEFORE UPDATE ON onehealth_admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. SAMPLE DATA FOR TESTING
-- =====================================================

-- Assign SMS subscriptions to existing practices
INSERT INTO practice_sms_subscriptions (practice_id, plan_id, monthly_limit, billing_cycle_start, billing_cycle_end)
SELECT 
  p.id,
  (SELECT id FROM sms_plans WHERE name = 'Professional' LIMIT 1),
  2000,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '1 month'
FROM practices p
WHERE p.slug IN ('cityclinic', 'coastalmed');

-- Insert some sample SMS usage data
INSERT INTO sms_usage_logs (practice_id, subscription_id, recipient_phone, message_content, message_type, status, cost, sent_at, delivered_at)
SELECT 
  p.id,
  ps.id,
  '+264 81 123 4567',
  'Hi John, this is a reminder for your appointment tomorrow at 2 PM with Dr. Smith.',
  'appointment_reminder',
  'delivered',
  0.35,
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '1 hour'
FROM practices p
JOIN practice_sms_subscriptions ps ON ps.practice_id = p.id
WHERE p.slug = 'cityclinic';

-- Update SMS subscription usage
UPDATE practice_sms_subscriptions 
SET current_usage = 45
WHERE practice_id = (SELECT id FROM practices WHERE slug = 'cityclinic');

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Add helpful comments
COMMENT ON TABLE practice_tariffs IS 'Enhanced tariff structure supporting multiple practice types with detailed service codes and pricing';
COMMENT ON TABLE sms_plans IS 'SMS subscription plans with monthly limits and pricing tiers';
COMMENT ON TABLE practice_sms_subscriptions IS 'Practice SMS subscriptions with usage tracking and billing cycles';
COMMENT ON TABLE sms_usage_logs IS 'Detailed SMS usage logging with delivery status and cost tracking';
COMMENT ON TABLE onehealth_admins IS 'OneHealth super admin users with role-based permissions';

COMMENT ON VIEW practice_performance_dashboard IS 'Comprehensive practice performance metrics dashboard';
COMMENT ON VIEW financial_summary_by_practice IS 'Financial analysis and revenue estimates by practice';
COMMENT ON VIEW user_activity_analytics IS 'User engagement and activity analysis';
COMMENT ON VIEW cross_practice_comparison IS 'Comparative analysis across all practices';
COMMENT ON VIEW sms_analytics_dashboard IS 'SMS usage analytics and delivery metrics';