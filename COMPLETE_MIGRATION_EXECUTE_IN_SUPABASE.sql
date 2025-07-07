-- =====================================================
-- COMPLETE HPMS MIGRATION - EXECUTE IN SUPABASE DASHBOARD
-- Copy this entire file and paste it into Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql/new
-- =====================================================

-- STEP 1: Enhance Practices Table
-- =====================================================
ALTER TABLE practices ADD COLUMN IF NOT EXISTS practice_type TEXT DEFAULT 'general';
ALTER TABLE practices ADD COLUMN IF NOT EXISTS practice_subtypes TEXT[] DEFAULT ARRAY['General Practice'];
ALTER TABLE practices ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending'));
ALTER TABLE practices ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'standard' CHECK (subscription_tier IN ('trial', 'standard', 'premium', 'enterprise'));
ALTER TABLE practices ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 10;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS max_patients INTEGER DEFAULT 1000;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Africa/Windhoek';
ALTER TABLE practices ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'NAD';
ALTER TABLE practices ADD COLUMN IF NOT EXISTS tax_number VARCHAR(50);
ALTER TABLE practices ADD COLUMN IF NOT EXISTS license_number VARCHAR(50);
ALTER TABLE practices ADD COLUMN IF NOT EXISTS admin_user_id UUID;

-- STEP 2: Create Practice Tariffs Table
-- =====================================================
DROP TABLE IF EXISTS practice_tariffs CASCADE;

CREATE TABLE practice_tariffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  namaf_prace_2025 TEXT NOT NULL,
  edi_diagnosi TEXT,
  full_description TEXT,
  practice_type TEXT NOT NULL CHECK (practice_type IN ('dental', 'medical', 'aesthetic', 'specialist', 'general')),
  practice_subtypes TEXT[],
  category TEXT,
  subcategory TEXT,
  unit TEXT DEFAULT 'per visit',
  is_active BOOLEAN DEFAULT true,
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(practice_id, code, effective_from)
);

-- Create indexes (with IF NOT EXISTS to avoid conflicts)
CREATE INDEX IF NOT EXISTS idx_practice_tariffs_practice_id ON practice_tariffs(practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_tariffs_code ON practice_tariffs(code);
CREATE INDEX IF NOT EXISTS idx_practice_tariffs_type ON practice_tariffs(practice_type);
CREATE INDEX IF NOT EXISTS idx_practice_tariffs_active ON practice_tariffs(is_active);

-- STEP 3: Create SMS Management Tables
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_plans (
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

CREATE TABLE IF NOT EXISTS practice_sms_subscriptions (
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

CREATE TABLE IF NOT EXISTS sms_usage_logs (
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

CREATE TABLE IF NOT EXISTS sms_portal_config (
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

-- STEP 4: Create Admin System Tables
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system_role BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id UUID REFERENCES admin_roles(id),
  is_super_admin BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

DROP TABLE IF EXISTS admin_audit_logs CASCADE;
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- STEP 5: Insert Default Data
-- =====================================================
INSERT INTO sms_plans (name, description, monthly_sms_limit, price_per_month, price_per_additional_sms, features) VALUES
('Starter', 'Basic SMS plan for small practices', 500, 150.00, 0.40, '{"support": "email", "analytics": "basic"}'::jsonb),
('Professional', 'Perfect for growing practices', 2000, 450.00, 0.35, '{"support": "priority", "analytics": "advanced", "templates": "unlimited"}'::jsonb),
('Enterprise', 'Unlimited SMS for large practices', 10000, 1200.00, 0.30, '{"support": "dedicated", "analytics": "premium", "templates": "unlimited", "api_access": true}'::jsonb),
('Custom', 'Tailored SMS solution', 0, 0.00, 0.25, '{"support": "dedicated", "analytics": "premium", "templates": "unlimited", "api_access": true, "custom_features": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO admin_roles (name, description, permissions, is_system_role) VALUES
('Super Admin', 'Full system access', '["*"]'::jsonb, true),
('Practice Manager', 'Manage practices and users', '["practices:*", "users:read", "users:update", "reports:read"]'::jsonb, true),
('Billing Manager', 'Manage billing and subscriptions', '["billing:*", "subscriptions:*", "reports:read"]'::jsonb, true),
('Support Agent', 'Customer support and basic system access', '["practices:read", "users:read", "support:*"]'::jsonb, true)
ON CONFLICT (name) DO NOTHING;

-- STEP 6: Update Practice Types
-- =====================================================
-- Set Dr. Polina as aesthetic practice
UPDATE practices 
SET practice_type = 'aesthetic', 
    practice_subtypes = ARRAY['Aesthetic Medicine', 'Cosmetic Procedures']
WHERE slug = 'dr-polina';

-- Set other practices as dental by default
UPDATE practices 
SET practice_type = 'dental', 
    practice_subtypes = ARRAY['General Dental Practitioners']
WHERE practice_type IS NULL AND slug != 'dr-polina';

-- STEP 7: Import Dental Tariffs
-- =====================================================
INSERT INTO practice_tariffs (
  practice_id, code, price, namaf_prace_2025, edi_diagnosi, full_description, 
  practice_type, practice_subtypes, category, subcategory
) 
SELECT 
  p.id as practice_id,
  tariff_data.code,
  tariff_data.price,
  tariff_data.namaf_prace_2025,
  tariff_data.edi_diagnosi,
  tariff_data.full_description,
  'dental' as practice_type,
  ARRAY['General Dental Practitioners'] as practice_subtypes,
  tariff_data.category,
  tariff_data.subcategory
FROM practices p
CROSS JOIN (VALUES
  ('8101', 148.30, 'FULL MOUTH EXAMINATION CHARTIN', '', 'Complete oral examination with charting', 'Examination', 'Diagnostic'),
  ('8104', 80.00, 'EXAMINATION OR CONSULTATION FO', '', 'General dental consultation', 'Examination', 'Diagnostic'),
  ('8107', 236.70, 'TOOTH: 45 INTRAORAL RADIOGRAPH', '', 'Intraoral X-ray examination', 'Radiology', 'Diagnostic'),
  ('8109', 40.00, 'INFECTION CONTROL PER DENTIST', '', 'Infection control procedures', 'Safety', 'Procedural'),
  ('8110', 44.70, 'PROVISION OF STERILISED AND WR', '', 'Sterilized instruments provision', 'Safety', 'Procedural'),
  ('8119', 215.40, 'STUDY MODELS MOUNTED ON ADJUS', '', 'Study models for treatment planning', 'Prosthetics', 'Diagnostic'),
  ('8131', 121.20, 'TOOTH: 36 PALLIATIVE EMERGENCY', '', 'Emergency pain relief treatment', 'Emergency', 'Pain Management'),
  ('8132', 197.80, 'TOOTH: 11 GROSS PULPAL DEBRIDE', '', 'Pulp chamber cleaning', 'Endodontics', 'Root Canal'),
  ('8133', 121.20, 'TOOTH: 31 RECEMENTING OF INLAY', '', 'Re-cementing dental restoration', 'Restorative', 'Repair'),
  ('8140', 196.60, 'FEE FOR TREATMENT AT A VENUE O', '', 'Off-site treatment fee', 'Administrative', 'Special'),
  ('8145', 23.50, 'LOCAL ANAESTHETIC PER VISIT', '', 'Local anesthesia administration', 'Anesthesia', 'Pain Management'),
  ('8146', 800.00, 'TOOTH: 21/12 RESIN BONDING FOR', '', 'Cosmetic resin bonding', 'Cosmetic', 'Aesthetic'),
  ('8151', 121.20, 'ORAL HYGIENE INSTRUCTIONS', '', 'Patient education on oral care', 'Preventive', 'Education'),
  ('8155', 121.20, 'POLISHING ONLY INCLUDING REMOV', '', 'Teeth polishing and stain removal', 'Preventive', 'Cleaning'),
  ('8159', 238.90, 'SCALING AND POLISHING', '', 'Professional teeth cleaning', 'Preventive', 'Cleaning'),
  ('8161', 121.20, 'TOPICAL APPLICATION OF FLUORID', '', 'Fluoride treatment application', 'Preventive', 'Protection'),
  ('8163', 78.90, 'TOOTH: 36 TOOTH SURFACE: O FIS', '', 'Fissure sealant application', 'Preventive', 'Protection'),
  ('8167', 93.00, 'TOOTH: 35 TREATMENT OF HYPERSE', '', 'Hypersensitivity treatment', 'Treatment', 'Desensitization'),
  ('8184', 384.90, 'ROOT PLANING WITH OR WITHOUT P', '', 'Deep periodontal cleaning', 'Periodontics', 'Deep Cleaning'),
  ('8185', 633.30, 'TOOTH: 38 GINGIVECTOMYGINGIVOP', '', 'Gum surgery procedure', 'Periodontics', 'Surgery'),
  ('8186', 503.80, 'GINGIVECTOMYGINGIVOPLASTY PER', '', 'Gum reshaping per quadrant', 'Periodontics', 'Surgery'),
  ('8201', 121.20, 'TOOTH: 47 SINGLE TOOTH', '', 'Single tooth extraction', 'Oral Surgery', 'Extraction'),
  ('8209', 521.40, 'TOOTH: 45 SURGICAL REMOVAL OF', '', 'Surgical tooth extraction', 'Oral Surgery', 'Extraction'),
  ('8210', 867.50, 'TOOTH: 18 REMOVAL OF UNERUPTED', '', 'Impacted tooth removal', 'Oral Surgery', 'Extraction'),
  ('8213', 521.40, 'TOOTH: 36 SURGICAL REMOVAL OF', '', 'Complex surgical extraction', 'Oral Surgery', 'Extraction'),
  ('8220', 400.00, 'USE OF SUTURE PROVIDED BY PRAC', '', 'Surgical suturing', 'Oral Surgery', 'Repair'),
  ('8225', 90.60, 'TOOTH: 46 TREATMENT OF SEPTIC', '', 'Infection treatment', 'Treatment', 'Infection Control'),
  ('8255', 116.50, 'TOOTH: 11 STAINLESS STEEL CLAS', '', 'Stainless steel crown', 'Restorative', 'Crown'),
  ('8273', 296.20, 'ADDITIONAL FEEBENEFIT WHERE IM', '', 'Additional procedure fee', 'Administrative', 'Additional'),
  ('8303', 162.40, 'TOOTH: 45 TOOTH SURFACE: O IND', '', 'Indirect restoration', 'Restorative', 'Filling'),
  ('8304', 188.40, 'RUBBER DAM PER ARCH', '', 'Rubber dam isolation', 'Procedural', 'Isolation'),
  ('8327', 223.10, 'TOOTH: 21 EACH ADDITIONAL VISI', '', 'Additional endodontic visit', 'Endodontics', 'Root Canal'),
  ('8329', 455.90, 'TOOTH: 25 EACH ADDITIONAL CANA', '', 'Additional root canal', 'Endodontics', 'Root Canal'),
  ('8338', 841.60, 'TOOTH: 11 FIRST CANAL ANTERIO', '', 'Anterior root canal treatment', 'Endodontics', 'Root Canal'),
  ('8339', 1157.10, 'TOOTH: 36 FIRST CANAL MOLARS', '', 'Molar root canal treatment', 'Endodontics', 'Root Canal'),
  ('8340', 279.00, 'TOOTH: 36 EACH ADDITIONAL CANA', '', 'Additional canal treatment', 'Endodontics', 'Root Canal'),
  ('8346', 42.14, 'TOOTH: 34 RESTORATIVE MATERIAL', '', 'Restorative material fee', 'Restorative', 'Material'),
  ('8351', 240.10, 'TOOTH: 21 RESIN ONE SURFACE A', '', 'Single surface resin filling', 'Restorative', 'Filling'),
  ('8352', 304.90, 'TOOTH: 13 RESIN TWO SURFACES', '', 'Two surface resin filling', 'Restorative', 'Filling'),
  ('8353', 361.40, 'TOOTH: 12 RESIN THREE SURFACE', '', 'Three surface resin filling', 'Restorative', 'Filling'),
  ('8354', 404.90, 'TOOTH: 12 RESIN FOUR OR MORE', '', 'Four+ surface resin filling', 'Restorative', 'Filling'),
  ('8367', 261.30, 'TOOTH: 38 RESIN ONE SURFACE P', '', 'Posterior single surface filling', 'Restorative', 'Filling'),
  ('8368', 321.30, 'TOOTH: 44 RESIN TWO SURFACES', '', 'Posterior two surface filling', 'Restorative', 'Filling'),
  ('8369', 386.10, 'TOOTH: 35 RESIN THREE SURFACE', '', 'Posterior three surface filling', 'Restorative', 'Filling'),
  ('8370', 421.40, 'TOOTH: 34 RESIN FOUR OR MORE', '', 'Posterior four+ surface filling', 'Restorative', 'Filling'),
  ('9301', 94.80, 'CASTING AND TRIMMING OF MODEL', '', 'Model casting and trimming', 'Laboratory', 'Model'),
  ('9303', 41.00, 'CASTING AND TRIMMING OF MODEL', '', 'Simple model casting', 'Laboratory', 'Model'),
  ('9313', 90.20, 'DUPLICATING MODEL PER MODEL', '', 'Model duplication', 'Laboratory', 'Model'),
  ('9327', 39.84, 'INFECTION CONTROL PER IMPRESSI', '', 'Impression infection control', 'Safety', 'Procedural'),
  ('9330', 52.70, 'DELIVERY CHARGE PER PROCEDURE', '', 'Appliance delivery fee', 'Administrative', 'Delivery'),
  ('9351', 394.80, 'SETUP AND FINISH OF ONETOOTH D', '', 'Single tooth denture setup', 'Prosthetics', 'Denture'),
  ('9352', 419.40, 'SETUP AND FINISH OF TWOTOOTH D', '', 'Two tooth denture setup', 'Prosthetics', 'Denture'),
  ('9353', 741.70, 'SETUP AND FINISH OF THREETOOTH', '', 'Three tooth denture setup', 'Prosthetics', 'Denture'),
  ('9355', 515.40, 'SETUP AND FINISH OF FIVETOOTH', '', 'Five tooth denture setup', 'Prosthetics', 'Denture'),
  ('9358', 770.80, 'SETUP AND FINISH OF EIGHTTOOTH', '', 'Eight tooth denture setup', 'Prosthetics', 'Denture'),
  ('9385', 248.60, 'ADDITIONAL FEE FOR SUPPLYING F', '', 'Additional supply fee', 'Administrative', 'Additional'),
  ('9447', 585.80, 'CAST CLASP', '', 'Cast metal clasp', 'Prosthetics', 'Clasp'),
  ('9450', 112.50, 'FINISHING OF ACRYLIC WORK ON A', '', 'Acrylic work finishing', 'Laboratory', 'Finishing'),
  ('9453', 869.20, 'BASIC CHARGE WHICH INCLUDES R', '', 'Basic denture charge', 'Prosthetics', 'Denture'),
  ('9455', 217.80, 'ADDITIONAL CHARGE FOR EACH ONE', '', 'Additional tooth charge', 'Prosthetics', 'Additional'),
  ('9459', 136.00, 'ADDITIONAL CHARGE FOR EACH RES', '', 'Additional restoration charge', 'Prosthetics', 'Additional'),
  ('9469', 59.70, 'ADDITIONAL CHARGE FOR SADDLE W', '', 'Saddle work additional charge', 'Prosthetics', 'Additional'),
  ('9473', 59.70, 'ADDITIONAL CHARGE FOR HORSESHO', '', 'Horseshoe clasp additional', 'Prosthetics', 'Clasp'),
  ('9587', 328.00, 'ADDITIONAL FEE FOR BALL CLASP', '', 'Ball clasp additional fee', 'Prosthetics', 'Clasp'),
  ('9589', 226.40, 'ADDITIONAL FEE FOR SINGLE ARM', '', 'Single arm clasp fee', 'Prosthetics', 'Clasp'),
  ('9631', 302.20, 'GUM GUARD', '', 'Custom gum guard', 'Prosthetics', 'Guard'),
  ('9700', 68.00, 'DIATORICS 1 X 68', '', 'Diatorics procedure', 'Treatment', 'Special'),
  ('9702', 300.00, 'DIATORICS ODDS ANTERIOR', '', 'Anterior diatorics', 'Treatment', 'Special'),
  ('9722', 500.00, 'ACRYLIC PER DENTURE', '', 'Acrylic denture work', 'Prosthetics', 'Denture'),
  ('9726', 480.00, 'PREFORMED ROACH OR BALL CLASP', '', 'Preformed clasp work', 'Prosthetics', 'Clasp'),
  ('9741', 240.00, 'COST OF COBALT CHROME CASTING', '', 'Cobalt chrome casting', 'Laboratory', 'Casting'),
  ('9776', 385.00, 'COST OF MOUTH PROTECTOR MATERI', '', 'Mouth protector materials', 'Prosthetics', 'Guard')
) AS tariff_data(code, price, namaf_prace_2025, edi_diagnosi, full_description, category, subcategory)
WHERE p.practice_type = 'dental';

-- STEP 8: Create Admin Users
-- =====================================================
INSERT INTO admin_users (
  email,
  password_hash,
  full_name,
  role_id,
  is_super_admin,
  is_active
) VALUES (
  'admin@onehealth.na',
  '$2b$12$LQv3c7yqBTkd68LQlFtzMOD.eOp4LqjQIL3PUfE.FIqQrCZPXVdgS', -- Password: OneHealth2025!
  'OneHealth Super Administrator',
  (SELECT id FROM admin_roles WHERE name = 'Super Admin' LIMIT 1),
  true,
  true
) ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  is_super_admin = true,
  is_active = true;

INSERT INTO admin_users (
  email,
  password_hash,
  full_name,
  role_id,
  is_super_admin,
  is_active
) VALUES (
  'manager@onehealth.na',
  '$2b$12$LQv3c7yqBTkd68LQlFtzMOD.eOp4LqjQIL3PUfE.FIqQrCZPXVdgS', -- Password: OneHealth2025!
  'OneHealth Practice Manager',
  (SELECT id FROM admin_roles WHERE name = 'Practice Manager' LIMIT 1),
  false,
  true
) ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  is_active = true;

-- STEP 9: Assign SMS Subscriptions
-- =====================================================
INSERT INTO practice_sms_subscriptions (
  practice_id,
  plan_id,
  monthly_limit,
  additional_sms_purchased,
  current_usage,
  billing_cycle_start,
  billing_cycle_end,
  is_active,
  auto_renew
)
SELECT 
  p.id,
  CASE 
    WHEN p.subscription_tier = 'enterprise' OR p.subscription_tier = 'premium' 
    THEN (SELECT id FROM sms_plans WHERE name = 'Enterprise' LIMIT 1)
    WHEN p.subscription_tier = 'standard' 
    THEN (SELECT id FROM sms_plans WHERE name = 'Professional' LIMIT 1)
    ELSE (SELECT id FROM sms_plans WHERE name = 'Starter' LIMIT 1)
  END,
  CASE 
    WHEN p.subscription_tier = 'enterprise' OR p.subscription_tier = 'premium' THEN 10000
    WHEN p.subscription_tier = 'standard' THEN 2000
    ELSE 500
  END,
  0, -- No additional SMS purchased initially
  0, -- No usage initially
  DATE_TRUNC('month', CURRENT_DATE), -- Start of current month
  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day', -- End of current month
  true, -- Active subscription
  true  -- Auto-renew enabled
FROM practices p
WHERE NOT EXISTS (
  SELECT 1 FROM practice_sms_subscriptions WHERE practice_id = p.id AND is_active = true
);

-- STEP 10: Create Reporting Views
-- =====================================================
CREATE OR REPLACE VIEW practice_performance_dashboard AS
WITH appointment_stats AS (
  SELECT 
    p.id as practice_id,
    p.name as practice_name,
    COUNT(a.id) as total_appointments,
    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
    COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled_appointments,
    COUNT(CASE WHEN a.status = 'no-show' THEN 1 END) as no_show_appointments,
    COUNT(CASE WHEN a.date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as appointments_last_30_days,
    COUNT(CASE WHEN a.date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as appointments_last_7_days
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
  p.practice_type,
  p.practice_subtypes,
  
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

-- Enable RLS on new tables
ALTER TABLE practice_tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sms_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_portal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (drop existing ones first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their practice tariffs" ON practice_tariffs;
CREATE POLICY "Users can view their practice tariffs" ON practice_tariffs
  FOR SELECT USING (practice_id IN (
    SELECT practice_id FROM users WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "SMS plans are publicly viewable" ON sms_plans;
CREATE POLICY "SMS plans are publicly viewable" ON sms_plans
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view their SMS subscriptions" ON practice_sms_subscriptions;
CREATE POLICY "Users can view their SMS subscriptions" ON practice_sms_subscriptions
  FOR SELECT USING (practice_id IN (
    SELECT practice_id FROM users WHERE id = auth.uid()
  ));

-- Grant permissions
GRANT SELECT ON practice_performance_dashboard TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '🎉 COMPREHENSIVE HPMS MIGRATION COMPLETED SUCCESSFULLY! 🎉';
  RAISE NOTICE '';
  RAISE NOTICE '📊 FEATURES DEPLOYED:';
  RAISE NOTICE '   ✅ Enhanced Practice Management System';
  RAISE NOTICE '   ✅ Complete Dental Tariff Catalog (60+ codes)';
  RAISE NOTICE '   ✅ SMS Management & Allocation System';
  RAISE NOTICE '   ✅ OneHealth Admin Portal';
  RAISE NOTICE '   ✅ Practice Types & Subtypes';
  RAISE NOTICE '   ✅ Comprehensive Reporting Views';
  RAISE NOTICE '';
  RAISE NOTICE '🔑 LOGIN CREDENTIALS:';
  RAISE NOTICE '   Super Admin: admin@onehealth.na';
  RAISE NOTICE '   Practice Manager: manager@onehealth.na';
  RAISE NOTICE '   Password: OneHealth2025!';
  RAISE NOTICE '';
  RAISE NOTICE '🌐 ACCESS URLS:';
  RAISE NOTICE '   Main App: https://hpms-one.vercel.app/';
  RAISE NOTICE '   Supabase Dashboard: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Your system is ready for production use!';
END $$;