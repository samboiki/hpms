-- Migration: Add comprehensive appointment features
-- Features: Recurring appointments, reminders, waitlist, enhanced multi-practice support

-- 1. Add recurring appointment support to appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_rule jsonb;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES appointments(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_end_date date;

-- Add reminder tracking
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_settings jsonb DEFAULT '{"enabled": true, "timing": ["24h", "2h"]}'::jsonb;

-- Add waitlist support
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS waitlist_position integer;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS original_appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL;

-- Add check-in support
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS called_at timestamptz;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS waiting_room_status text 
  CHECK (waiting_room_status IN ('not_arrived', 'waiting', 'in_consultation', 'completed'));

-- 2. Create appointment reminders table
CREATE TABLE IF NOT EXISTS appointment_reminders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('24h', '2h', '1h', '30m', 'custom')),
  scheduled_for timestamptz NOT NULL,
  message_id uuid REFERENCES messages(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  attempts integer DEFAULT 0,
  last_attempt_at timestamptz,
  error_message text,
  practice_id uuid REFERENCES practices(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Create waitlist table
CREATE TABLE IF NOT EXISTS appointment_waitlist (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES users(id),
  practice_id uuid NOT NULL REFERENCES practices(id),
  preferred_dates jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of date ranges
  appointment_type text NOT NULL,
  duration integer NOT NULL DEFAULT 30,
  priority text DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  status text DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'scheduled', 'expired', 'cancelled')),
  notes text,
  notified_at timestamptz,
  scheduled_appointment_id uuid REFERENCES appointments(id),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Enhance practices table for notification settings
ALTER TABLE practices ADD COLUMN IF NOT EXISTS notification_settings jsonb DEFAULT '{
  "sms": {
    "enabled": false,
    "provider": "smsportal",
    "credentials": {}
  },
  "email": {
    "enabled": false,
    "provider": null,
    "credentials": {}
  },
  "reminders": {
    "enabled": true,
    "default_timing": ["24h", "2h"],
    "business_hours_only": true,
    "templates": {}
  }
}'::jsonb;

-- 5. Add patient notification preferences
ALTER TABLE patients ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
  "sms": true,
  "email": true,
  "reminders": true,
  "language": "en"
}'::jsonb;

-- 6. Create reminder templates
CREATE TABLE IF NOT EXISTS reminder_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  practice_id uuid NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('appointment_reminder', 'waitlist_notification', 'check_in')),
  channel text NOT NULL CHECK (channel IN ('sms', 'email', 'both')),
  timing text, -- e.g., '24h', '2h'
  subject text,
  content text NOT NULL,
  variables jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(practice_id, name)
);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_recurrence ON appointments(recurrence_parent_id) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_scheduled ON appointment_reminders(scheduled_for, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON appointment_waitlist(practice_id, status, priority) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_appointments_waiting_room ON appointments(practice_id, waiting_room_status, date) WHERE waiting_room_status IS NOT NULL;

-- 8. Create functions for recurring appointments
CREATE OR REPLACE FUNCTION generate_recurring_appointments(
  parent_appointment_id uuid,
  recurrence_rule jsonb,
  end_date date DEFAULT NULL
) RETURNS SETOF appointments AS $$
DECLARE
  parent_apt appointments%ROWTYPE;
  new_apt appointments%ROWTYPE;
  current_date date;
  occurrence_count integer := 0;
  max_occurrences integer;
  interval_type text;
  interval_value integer;
BEGIN
  -- Get parent appointment
  SELECT * INTO parent_apt FROM appointments WHERE id = parent_appointment_id;
  
  -- Parse recurrence rule
  interval_type := recurrence_rule->>'frequency'; -- 'daily', 'weekly', 'monthly'
  interval_value := COALESCE((recurrence_rule->>'interval')::integer, 1);
  max_occurrences := COALESCE((recurrence_rule->>'count')::integer, 52); -- Default 1 year for weekly
  
  -- Set end date if not provided
  IF end_date IS NULL THEN
    end_date := parent_apt.date + (interval_value || ' ' || interval_type)::interval * max_occurrences;
  END IF;
  
  -- Start from the next occurrence
  current_date := parent_apt.date + (interval_value || ' ' || interval_type)::interval;
  
  -- Generate appointments
  WHILE current_date <= end_date AND occurrence_count < max_occurrences LOOP
    new_apt := parent_apt;
    new_apt.id := uuid_generate_v4();
    new_apt.date := current_date;
    new_apt.recurrence_parent_id := parent_appointment_id;
    new_apt.created_at := now();
    new_apt.updated_at := now();
    
    -- Insert and return
    INSERT INTO appointments SELECT new_apt.*;
    RETURN NEXT new_apt;
    
    -- Next occurrence
    current_date := current_date + (interval_value || ' ' || interval_type)::interval;
    occurrence_count := occurrence_count + 1;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 9. Function to check and notify waitlist
CREATE OR REPLACE FUNCTION check_waitlist_for_slot(
  p_doctor_id uuid,
  p_date date,
  p_time time,
  p_duration integer
) RETURNS uuid AS $$
DECLARE
  waitlist_entry appointment_waitlist%ROWTYPE;
  notification_sent boolean := false;
BEGIN
  -- Find matching waitlist entries
  FOR waitlist_entry IN
    SELECT w.*
    FROM appointment_waitlist w
    WHERE w.doctor_id = p_doctor_id
      AND w.status = 'waiting'
      AND w.duration <= p_duration
      AND w.expires_at > now()
      AND (
        w.preferred_dates @> jsonb_build_array(jsonb_build_object(
          'start', p_date::text,
          'end', p_date::text
        ))
        OR jsonb_array_length(w.preferred_dates) = 0 -- No preference means any date
      )
    ORDER BY 
      CASE w.priority 
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
      END,
      w.created_at
    LIMIT 1
  LOOP
    -- Update waitlist entry
    UPDATE appointment_waitlist
    SET status = 'notified',
        notified_at = now(),
        updated_at = now()
    WHERE id = waitlist_entry.id;
    
    -- Return the patient ID for notification
    RETURN waitlist_entry.patient_id;
  END LOOP;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 10. Default reminder templates
INSERT INTO reminder_templates (practice_id, name, type, channel, timing, subject, content, variables) 
VALUES 
  (
    (SELECT id FROM practices LIMIT 1),
    'SMS 24h Reminder',
    'appointment_reminder',
    'sms',
    '24h',
    NULL,
    'Hi {{patient_name}}, this is a reminder of your appointment with Dr. {{doctor_name}} tomorrow at {{appointment_time}}. Reply CONFIRM to confirm or CANCEL to cancel.',
    '{"patient_name": "string", "doctor_name": "string", "appointment_time": "string"}'::jsonb
  ),
  (
    (SELECT id FROM practices LIMIT 1),
    'SMS 2h Reminder',
    'appointment_reminder',
    'sms',
    '2h',
    NULL,
    'Hi {{patient_name}}, your appointment with Dr. {{doctor_name}} is in 2 hours at {{appointment_time}}. Please arrive 10 minutes early. See you soon!',
    '{"patient_name": "string", "doctor_name": "string", "appointment_time": "string"}'::jsonb
  ),
  (
    (SELECT id FROM practices LIMIT 1),
    'Waitlist Notification',
    'waitlist_notification',
    'sms',
    NULL,
    NULL,
    'Hi {{patient_name}}, an appointment slot has become available with Dr. {{doctor_name}} on {{date}} at {{time}}. Reply YES within 2 hours to book this slot.',
    '{"patient_name": "string", "doctor_name": "string", "date": "string", "time": "string"}'::jsonb
  )
ON CONFLICT (practice_id, name) DO NOTHING;

-- 11. Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_appointment_reminders_updated_at BEFORE UPDATE ON appointment_reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointment_waitlist_updated_at BEFORE UPDATE ON appointment_waitlist
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reminder_templates_updated_at BEFORE UPDATE ON reminder_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 12. RLS Policies
ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_templates ENABLE ROW LEVEL SECURITY;

-- Appointment reminders policies
CREATE POLICY "Users can view reminders for their practice" ON appointment_reminders
  FOR SELECT USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage reminders for their practice" ON appointment_reminders
  FOR ALL USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid()
    )
  );

-- Waitlist policies  
CREATE POLICY "Users can view waitlist for their practice" ON appointment_waitlist
  FOR SELECT USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage waitlist for their practice" ON appointment_waitlist
  FOR ALL USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid()
    )
  );

-- Template policies
CREATE POLICY "Users can view templates for their practice" ON reminder_templates
  FOR SELECT USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage templates for their practice" ON reminder_templates
  FOR ALL USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );