/*
  # Messages and Templates Schema

  1. New Tables
    - `message_templates`
      - `id` (uuid, primary key)
      - `name` (text)
      - `type` (text: email/sms/reminder)
      - `subject` (text, for emails)
      - `content` (text)
      - `variables` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `messages`
      - `id` (uuid, primary key)
      - `type` (text: email/sms/reminder)
      - `template_id` (uuid, references message_templates)
      - `recipient` (text)
      - `subject` (text)
      - `content` (text)
      - `status` (text: pending/sent/failed)
      - `scheduled_for` (timestamptz)
      - `sent_at` (timestamptz)
      - `error` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create message_templates table
CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  subject text,
  content text NOT NULL,
  variables jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT message_templates_type_check CHECK (type IN ('email', 'sms', 'reminder'))
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  template_id uuid REFERENCES message_templates(id),
  recipient text NOT NULL,
  subject text,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz,
  sent_at timestamptz,
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT messages_type_check CHECK (type IN ('email', 'sms', 'reminder')),
  CONSTRAINT messages_status_check CHECK (status IN ('pending', 'sent', 'failed'))
);

-- Enable RLS
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations for authenticated users on templates"
  ON message_templates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on messages"
  ON messages
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();