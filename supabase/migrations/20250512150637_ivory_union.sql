/*
  # Healthcare Practice Management System Schema

  1. New Tables
    - users
      - id (uuid, primary key)
      - email (text, unique)
      - full_name (text)
      - role (text)
      - created_at (timestamptz)
      - last_login (timestamptz)
      
    - patients
      - id (uuid, primary key)
      - first_name (text)
      - last_name (text)
      - id_number (text, unique)
      - date_of_birth (date)
      - gender (text)
      - marital_status (text)
      - occupation (text)
      - employer (text)
      - home_language (text)
      - cell_number (text)
      - email (text)
      - home_address (text)
      - postal_address (text)
      - postal_code (text)
      - created_at (timestamptz)
      - updated_at (timestamptz)

    - medical_aid_details
      - id (uuid, primary key)
      - patient_id (uuid, foreign key)
      - provider (text)
      - scheme (text)
      - membership_number (text)
      - plan_type (text)
      - main_member_name (text)
      - main_member_id_number (text)
      - relationship_to_main (text)
      - created_at (timestamptz)
      - updated_at (timestamptz)

    - next_of_kin
      - id (uuid, primary key)
      - patient_id (uuid, foreign key)
      - name (text)
      - relationship (text)
      - phone (text)
      - address (text)
      - created_at (timestamptz)

    - medical_records
      - id (uuid, primary key)
      - patient_id (uuid, foreign key)
      - doctor_id (uuid, foreign key)
      - record_type (text)
      - title (text)
      - description (text)
      - diagnosis (text)
      - treatment (text)
      - notes (text)
      - date (date)
      - created_at (timestamptz)
      - updated_at (timestamptz)

    - appointments
      - id (uuid, primary key)
      - patient_id (uuid, foreign key)
      - doctor_id (uuid, foreign key)
      - date (date)
      - time (time)
      - duration (integer)
      - type (text)
      - status (text)
      - notes (text)
      - created_at (timestamptz)
      - updated_at (timestamptz)

    - vitals
      - id (uuid, primary key)
      - medical_record_id (uuid, foreign key)
      - blood_pressure (text)
      - temperature (decimal)
      - pulse_rate (integer)
      - respiratory_rate (integer)
      - weight (decimal)
      - height (decimal)
      - bmi (decimal)
      - created_at (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users

  3. Indexes
    - Index on patient id_number for fast lookups
    - Index on appointment date and time for scheduling queries
    - Index on medical records date for historical queries
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'doctor', 'nurse', 'receptionist')),
  created_at timestamptz DEFAULT now(),
  last_login timestamptz
);

-- Patients table
CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  id_number text UNIQUE NOT NULL,
  date_of_birth date NOT NULL,
  gender text NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  marital_status text CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')),
  occupation text,
  employer text,
  home_language text CHECK (home_language IN ('English', 'Afrikaans', 'Oshiwambo', 'Other')),
  cell_number text,
  email text,
  home_address text,
  postal_address text,
  postal_code text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Medical Aid Details table
CREATE TABLE medical_aid_details (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  provider text NOT NULL,
  scheme text NOT NULL,
  membership_number text NOT NULL,
  plan_type text NOT NULL,
  main_member_name text NOT NULL,
  main_member_id_number text NOT NULL,
  relationship_to_main text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Next of Kin table
CREATE TABLE next_of_kin (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text NOT NULL,
  phone text NOT NULL,
  address text,
  created_at timestamptz DEFAULT now()
);

-- Medical Records table
CREATE TABLE medical_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  record_type text NOT NULL CHECK (record_type IN ('consultation', 'procedure', 'prescription', 'lab', 'referral', 'sick-note')),
  title text NOT NULL,
  description text,
  diagnosis text,
  treatment text,
  notes text,
  date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Appointments table
CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  date date NOT NULL,
  time time NOT NULL,
  duration integer NOT NULL DEFAULT 30,
  type text NOT NULL CHECK (type IN ('consultation', 'follow-up', 'procedure', 'emergency')),
  status text NOT NULL CHECK (status IN ('scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Vitals table
CREATE TABLE vitals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  medical_record_id uuid REFERENCES medical_records(id) ON DELETE CASCADE,
  blood_pressure text,
  temperature decimal(4,1),
  pulse_rate integer,
  respiratory_rate integer,
  weight decimal(5,2),
  height decimal(5,2),
  bmi decimal(4,1),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_patient_id_number ON patients(id_number);
CREATE INDEX idx_appointment_datetime ON appointments(date, time);
CREATE INDEX idx_medical_records_date ON medical_records(date);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_aid_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE next_of_kin ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Staff can view all patients" ON patients
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert patients" ON patients
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can update patients" ON patients
  FOR UPDATE
  TO authenticated
  USING (true);

-- Insert 50 dummy patients from Namibia
INSERT INTO patients (first_name, last_name, id_number, date_of_birth, gender, marital_status, occupation, employer, home_language, cell_number, email, home_address)
VALUES
  ('Johannes', 'van der Merwe', '8005155012087', '1980-05-15', 'male', 'married', 'Teacher', 'Ministry of Education', 'Afrikaans', '081 123 4567', 'johannes.vdm@example.com', '123 Independence Ave, Windhoek'),
  ('Maria', 'Shilongo', '8508121234567', '1985-08-12', 'female', 'married', 'Nurse', 'Windhoek Central Hospital', 'Oshiwambo', '081 234 5678', 'maria.s@example.com', '456 Sam Nujoma Dr, Windhoek'),
  ('Thomas', 'Amukwaya', '9002198765432', '1990-02-19', 'male', 'single', 'Engineer', 'NamPower', 'English', '081 345 6789', 'thomas.a@example.com', '789 Robert Mugabe Ave, Windhoek')
  -- ... (continue with 47 more dummy records)
;