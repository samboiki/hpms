export interface LabRequest {
  id: string;
  patient_id: string;
  visit_id?: string | null;
  practice_id?: string | null;
  request_date: string;
  status: 'pending' | 'completed' | 'cancelled';
  test_name: string;
  test_value?: string | null;
  test_unit?: string | null;
  reference_range?: string | null;
  lab_facility?: string | null;
  preferred_date?: string | null;
  notes?: string | null;
  completed_date?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  ai_extraction_data?: any | null;
  ai_extraction_error?: string | null;
}

export interface LabRequestInsert {
  patient_id: string;
  visit_id?: string | null;
  practice_id?: string | null;
  request_date?: string;
  status?: 'pending' | 'completed' | 'cancelled';
  test_name: string;
  test_value?: string | null;
  test_unit?: string | null;
  reference_range?: string | null;
  lab_facility?: string | null;
  preferred_date?: string | null;
  notes?: string | null;
  completed_date?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  ai_extraction_data?: any | null;
  ai_extraction_error?: string | null;
}

export interface LabRequestUpdate {
  test_name?: string;
  test_value?: string | null;
  test_unit?: string | null;
  reference_range?: string | null;
  status?: 'pending' | 'completed' | 'cancelled';
  lab_facility?: string | null;
  preferred_date?: string | null;
  notes?: string | null;
  completed_date?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  ai_extraction_data?: any | null;
  ai_extraction_error?: string | null;
}

export interface AIExtractionResult {
  testName: string;
  testValue: string;
  testUnit: string;
  referenceRange: string;
}