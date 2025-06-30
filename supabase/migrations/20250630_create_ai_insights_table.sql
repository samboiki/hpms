-- Create AI insights table
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  insights JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_ai_insights_practice_id ON ai_insights(practice_id);
CREATE INDEX idx_ai_insights_generated_at ON ai_insights(generated_at DESC);

-- Enable RLS
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their practice insights" ON ai_insights
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.practice_id = ai_insights.practice_id
      AND u.id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage insights" ON ai_insights
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Create function to get latest insights
CREATE OR REPLACE FUNCTION get_latest_ai_insights(p_practice_id UUID)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT insights
    FROM ai_insights
    WHERE practice_id = p_practice_id
    ORDER BY generated_at DESC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_latest_ai_insights(UUID) TO authenticated;