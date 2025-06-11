-- Test the database function and check batch data
-- Run this in your Supabase SQL Editor

-- Step 1: Check if the batch exists
SELECT 
    id,
    batch_number,
    status,
    practice_number,
    medical_aid_reference,
    batch_date
FROM batch_headers 
WHERE id = '782752c0-cb09-4c11-b43a-0365c2a0d152';

-- Step 2: Check if the function exists by testing it
SELECT * FROM prepare_batch_for_sending('782752c0-cb09-4c11-b43a-0365c2a0d152');

-- Step 3: Check medical aid providers table
SELECT 
    medical_aid_reference,
    email,
    provider_name
FROM medical_aid_providers
LIMIT 10;

-- Step 4: Check batch management view
SELECT 
    batch_id,
    medical_aid_reference,
    medical_aid_email,
    dat_filename
FROM batch_management_view 
WHERE batch_id = '782752c0-cb09-4c11-b43a-0365c2a0d152';

-- Step 5: Check if batch details exist
SELECT COUNT(*) as detail_count
FROM batch_details 
WHERE batch_header_id = '782752c0-cb09-4c11-b43a-0365c2a0d152';

-- Step 6: Check if batch trailer exists
SELECT 
    trailer_identifier,
    total_detail_transactions,
    total_amount_detail_transactions
FROM batch_trailer 
WHERE batch_header_id = '782752c0-cb09-4c11-b43a-0365c2a0d152';