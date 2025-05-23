/*
  # Add next of kin data

  1. Data Changes
    - Add next of kin records for existing patients
    - Each record includes:
      - Name
      - Relationship
      - Phone number
      - Address (where applicable)

  2. Notes
    - All records are linked to existing patient IDs
    - Phone numbers follow Namibian format
    - Addresses are provided for local contacts
*/

INSERT INTO public.next_of_kin (patient_id, name, relationship, phone, address)
VALUES
  (
    '03dd4f09-67a8-4796-8e72-9f6356160178',
    'Maria van der Merwe',
    'Spouse',
    '081 765 4321',
    '123 Independence Ave, Windhoek'
  ),
  (
    '2a2136ad-7af7-47d0-b431-7dcef3411859',
    'Thomas Namupala',
    'Father',
    '081 876 5432',
    '456 Robert Mugabe Ave, Windhoek'
  ),
  (
    '327925ed-6d7d-4464-8581-5a6fae75931e',
    'Elizabeth Brown',
    'Mother',
    '081 234 5678',
    '789 Sam Nujoma Drive, Windhoek'
  ),
  (
    'd09ad54c-b7df-4c1f-b11b-994048aa730b',
    'David van der Merwe',
    'Brother',
    '081 987 6543',
    '321 Mandume Ndemufayo Street, Windhoek'
  );