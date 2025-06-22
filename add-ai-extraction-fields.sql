-- Add AI extraction fields to lab_requests table
ALTER TABLE lab_requests 
ADD COLUMN IF NOT EXISTS request_form_file_ids UUID[],
ADD COLUMN IF NOT EXISTS extracted_request_data JSONB,
ADD COLUMN IF NOT EXISTS extracted_results_data JSONB,
ADD COLUMN IF NOT EXISTS ai_processing_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;