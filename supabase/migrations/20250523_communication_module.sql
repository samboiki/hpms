-- Add communication fields to patients table
ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_sms_transactional BOOLEAN DEFAULT TRUE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_sms_promotional BOOLEAN DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_email_transactional BOOLEAN DEFAULT TRUE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_email_promotional BOOLEAN DEFAULT FALSE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS preferred_communication_channel VARCHAR(10) CHECK (preferred_communication_channel IN ('EMAIL', 'SMS', 'NONE'));
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_consent_update_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add communication fields to practices table (assuming it exists, otherwise we'll handle in the app)
-- ALTER TABLE practices ADD COLUMN IF NOT EXISTS sms_sender_id VARCHAR(50);
-- ALTER TABLE practices ADD COLUMN IF NOT EXISTS email_from_address VARCHAR(255);
-- ALTER TABLE practices ADD COLUMN IF NOT EXISTS email_from_name VARCHAR(100);
-- ALTER TABLE practices ADD COLUMN IF NOT EXISTS email_reply_to_address VARCHAR(255);

-- Create communication templates table
CREATE TABLE IF NOT EXISTS communication_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('EMAIL', 'SMS')),
  subject VARCHAR(255),
  body TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workflows table
CREATE TABLE IF NOT EXISTS workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_event_type VARCHAR(50) NOT NULL,
  trigger_condition_json JSONB,
  communication_type VARCHAR(10) NOT NULL CHECK (communication_type IN ('EMAIL', 'SMS')),
  template_id UUID REFERENCES communication_templates(id),
  offset_value INTEGER NOT NULL,
  offset_unit VARCHAR(10) NOT NULL CHECK (offset_unit IN ('HOURS', 'DAYS', 'MINUTES')),
  offset_direction VARCHAR(10) NOT NULL CHECK (offset_direction IN ('BEFORE', 'AFTER', 'IMMEDIATE')),
  send_time_of_day TIME,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create communications log table
CREATE TABLE IF NOT EXISTS communications_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  template_id UUID REFERENCES communication_templates(id) ON DELETE SET NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('OUTGOING', 'INCOMING')),
  type VARCHAR(10) NOT NULL CHECK (type IN ('EMAIL', 'SMS')),
  provider_message_id VARCHAR(255),
  sender_address VARCHAR(255),
  recipient_address VARCHAR(255),
  subject VARCHAR(255),
  body_preview TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  status_reason TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  last_status_update_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workflow execution log table
CREATE TABLE IF NOT EXISTS workflow_execution_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE NOT NULL,
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  triggering_event_id VARCHAR(255),
  scheduled_run_time TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_run_time TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  communication_log_id UUID REFERENCES communications_log(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ESP/SMS provider configuration table
CREATE TABLE IF NOT EXISTS provider_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name VARCHAR(50) NOT NULL,
  api_key TEXT, -- Should be encrypted in production
  api_secret TEXT, -- Should be encrypted in production
  api_endpoint VARCHAR(255),
  other_config_json JSONB,
  is_default_sms_provider BOOLEAN DEFAULT FALSE,
  is_default_email_provider BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_communications_log_practice_id ON communications_log(practice_id);
CREATE INDEX idx_communications_log_patient_id ON communications_log(patient_id);
CREATE INDEX idx_communications_log_created_at ON communications_log(created_at);
CREATE INDEX idx_communications_log_status ON communications_log(status);
CREATE INDEX idx_communications_log_provider_message_id ON communications_log(provider_message_id);

CREATE INDEX idx_workflows_practice_id ON workflows(practice_id);
CREATE INDEX idx_workflows_trigger_event_type ON workflows(trigger_event_type);
CREATE INDEX idx_workflows_is_active ON workflows(is_active);

CREATE INDEX idx_communication_templates_practice_id ON communication_templates(practice_id);
CREATE INDEX idx_communication_templates_type ON communication_templates(type);

-- Enable RLS
ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Communication templates: Practice users can only see their own templates
CREATE POLICY "communication_templates_practice_isolation" ON communication_templates
  FOR ALL USING (
    practice_id IN (
      SELECT practices.id FROM practices
      INNER JOIN users ON users.practice_id = practices.id
      WHERE users.id = auth.uid()
    )
    OR practice_id IS NULL -- Global templates
  );

-- Workflows: Practice users can only see their own workflows
CREATE POLICY "workflows_practice_isolation" ON workflows
  FOR ALL USING (
    practice_id IN (
      SELECT practices.id FROM practices
      INNER JOIN users ON users.practice_id = practices.id
      WHERE users.id = auth.uid()
    )
  );

-- Communications log: Practice users can only see their own communications
CREATE POLICY "communications_log_practice_isolation" ON communications_log
  FOR ALL USING (
    practice_id IN (
      SELECT practices.id FROM practices
      INNER JOIN users ON users.practice_id = practices.id
      WHERE users.id = auth.uid()
    )
  );

-- Workflow execution log: Practice users can only see their own logs
CREATE POLICY "workflow_execution_log_practice_isolation" ON workflow_execution_log
  FOR ALL USING (
    practice_id IN (
      SELECT practices.id FROM practices
      INNER JOIN users ON users.practice_id = practices.id
      WHERE users.id = auth.uid()
    )
  );

-- Provider config: Only super admins can access
CREATE POLICY "provider_config_super_admin_only" ON provider_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );