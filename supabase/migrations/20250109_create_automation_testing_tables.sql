-- Create automation test logs table
CREATE TABLE IF NOT EXISTS public.automation_test_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_id UUID REFERENCES automation_queue(id),
  practice_id UUID REFERENCES practices(id),
  test_type TEXT NOT NULL, -- 'validation_failed', 'test_mode_execution', 'performance_test'
  errors JSONB DEFAULT '[]'::jsonb,
  warnings JSONB DEFAULT '[]'::jsonb,
  test_results JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create automation performance logs table
CREATE TABLE IF NOT EXISTS public.automation_performance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metrics JSONB NOT NULL,
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add test_mode flag to automation_queue
ALTER TABLE automation_queue 
ADD COLUMN IF NOT EXISTS test_mode BOOLEAN DEFAULT FALSE;

-- Create indexes
CREATE INDEX idx_automation_test_logs_queue_id ON automation_test_logs(queue_id);
CREATE INDEX idx_automation_test_logs_practice_id ON automation_test_logs(practice_id);
CREATE INDEX idx_automation_test_logs_test_type ON automation_test_logs(test_type);
CREATE INDEX idx_automation_test_logs_created_at ON automation_test_logs(created_at DESC);
CREATE INDEX idx_automation_performance_logs_timestamp ON automation_performance_logs(timestamp DESC);

-- RLS policies
ALTER TABLE automation_test_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_performance_logs ENABLE ROW LEVEL SECURITY;

-- Test logs policies
CREATE POLICY "Service role can manage test logs" ON automation_test_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view their practice test logs" ON automation_test_logs
  FOR SELECT TO authenticated
  USING (
    practice_id IN (
      SELECT practice_id FROM users WHERE id = auth.uid()
    )
  );

-- Performance logs policies  
CREATE POLICY "Service role can manage performance logs" ON automation_performance_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view performance logs" ON automation_performance_logs
  FOR SELECT TO authenticated USING (true);

-- Comments
COMMENT ON TABLE automation_test_logs IS 'Logs for automation testing and validation';
COMMENT ON TABLE automation_performance_logs IS 'Performance metrics for automation processing';
COMMENT ON COLUMN automation_test_logs.test_type IS 'Type of test: validation_failed, test_mode_execution, performance_test';
COMMENT ON COLUMN automation_queue.test_mode IS 'If true, automation will be simulated but not actually sent';