-- Create practice_email_subscriptions table if it doesn't exist
-- This table tracks email subscription limits and usage for each practice

CREATE TABLE IF NOT EXISTS public.practice_email_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  practice_id uuid NULL,
  plan_id uuid NULL,
  monthly_limit integer NOT NULL,
  additional_emails_purchased integer NULL DEFAULT 0,
  current_usage integer NULL DEFAULT 0,
  billing_cycle_start date NOT NULL,
  billing_cycle_end date NOT NULL,
  is_active boolean NULL DEFAULT true,
  auto_renew boolean NULL DEFAULT true,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT practice_email_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT practice_email_subscriptions_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES practices (id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_practice_email_subscriptions_practice_id ON public.practice_email_subscriptions USING btree (practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_email_subscriptions_is_active ON public.practice_email_subscriptions USING btree (is_active);

-- Create email_usage_logs table for tracking email usage
CREATE TABLE IF NOT EXISTS public.email_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL,
  email_type varchar(50) NOT NULL DEFAULT 'notification',
  recipient_email varchar(255) NOT NULL,
  subject varchar(255),
  status varchar(20) NOT NULL DEFAULT 'sent',
  sent_at timestamp with time zone NULL DEFAULT now(),
  cost_per_email numeric(10,4) NULL DEFAULT 0.05,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT email_usage_logs_pkey PRIMARY KEY (id),
  CONSTRAINT email_usage_logs_practice_id_fkey FOREIGN KEY (practice_id) REFERENCES practices (id) ON DELETE CASCADE
);

-- Create index for email usage logs
CREATE INDEX IF NOT EXISTS idx_email_usage_logs_practice_id ON public.email_usage_logs USING btree (practice_id);
CREATE INDEX IF NOT EXISTS idx_email_usage_logs_sent_at ON public.email_usage_logs USING btree (sent_at);

-- Insert a comment to explain the tables
COMMENT ON TABLE public.practice_email_subscriptions IS 'Tracks email subscription limits and usage for each practice';
COMMENT ON TABLE public.email_usage_logs IS 'Logs all email communications sent by each practice for billing and usage tracking';