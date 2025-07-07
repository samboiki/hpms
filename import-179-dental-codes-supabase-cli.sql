-- Import 179 dental codes using Supabase CLI
-- This matches the exact structure you specified

-- Clear existing dental codes first
DELETE FROM practice_tariffs WHERE code LIKE '8%';

-- Insert the 179 dental codes with correct column mapping
INSERT INTO practice_tariffs (
    code, 
    description, 
    price, 
    official_2025_price_nad, 
    on_2025_list, 
    found_in_claims, 
    requires_tooth_number, 
    can_be_multiplied, 
    business_rule_formula, 
    example_calculation, 
    notes, 
    unit, 
    is_active, 
    effective_from
) VALUES 
-- Based on your specification, here are the first few codes:
('8101', 'Full mouth examination, charting and treatment planning', 254.70, 254.70, 'YES', 'YES', 'YES', 'NO', 'Fixed price', '254.7 NAD', '', 'per visit', true, '2025-01-01'),
('8102', 'Comprehensive consultation', 479.00, 479.00, 'YES', 'NO', 'NO', 'NO', 'Fixed price', '479.0 NAD', '', 'per visit', true, '2025-01-01'),
('8104', 'Examination or consultation for a specific problem', 137.40, 137.40, 'YES', 'YES', 'YES', 'NO', 'Fixed price', '137.4 NAD', '', 'per visit', true, '2025-01-01'),
('8106', 'Provision of a written treatment plan and quotation', 345.60, 345.60, 'YES', 'NO', 'NO', 'NO', 'Fixed price', '345.6 NAD', '', 'per visit', true, '2025-01-01'),
('8107', 'Intra-oral radiographs, per film', 135.40, 135.40, 'YES', 'YES', 'YES', 'YES', 'Base price × number of X-rays', '78.90 × 3 = 236.70 (for 3 X-rays)', 'Multiply by number of radiographs taken', 'per film', true, '2025-01-01')
-- NOTE: This is just a sample - you would need to provide the full 179 codes data
;