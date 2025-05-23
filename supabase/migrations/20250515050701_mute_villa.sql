/*
  # Add Lab Results and Media Tables

  1. New Tables
    - `lab_results`
      - `id` (uuid, primary key)
      - `visit_id` (uuid, foreign key to visits)
      - `name` (text)
      - `value` (text)
      - `unit` (text)
      - `reference_range` (text)
      - `status` (text)
      - `date` (date)
      - `created_at` (timestamptz)

    - `visit_media`
      - `id` (uuid, primary key)
      - `visit_id` (uuid, foreign key to visits)
      - `type` (text)
      - `url` (text)
      - `description` (text)
      - `date` (date)
      - `created_at` (timestamptz)

  2. Constraints
    - Foreign key constraints to visits table
    - Status check constraint for lab results
    - Media type check constraint
*/

-- Create lab_results table
CREATE TABLE IF NOT EXISTS lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid REFERENCES visits(id) ON DELETE CASCADE,
  name text NOT NULL,
  value text NOT NULL,
  unit text,
  reference_range text,
  status text NOT NULL CHECK (status IN ('normal', 'high', 'low', 'critical')),
  date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create visit_media table
CREATE TABLE IF NOT EXISTS visit_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid REFERENCES visits(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('xray', 'ct', 'mri', 'ultrasound', 'photo')),
  url text NOT NULL,
  description text,
  date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_lab_results_visit ON lab_results(visit_id);
CREATE INDEX idx_visit_media_visit ON visit_media(visit_id);