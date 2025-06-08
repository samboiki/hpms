-- =====================================================
-- DENTAL PRACTICE CODES IMPORT SCRIPT
-- Version: 1.0
-- Date: 2025-06-08
-- Purpose: Import comprehensive dental tariffs into practice_tariffs table
-- Source: 2025_Dental_Pricing_Table.csv
-- =====================================================

-- First, let's clear any existing dental tariffs to prevent conflicts
DELETE FROM practice_tariffs 
WHERE practice_type = 'dental' OR practice_type IS NULL;

-- Create a temporary table to hold the dental codes data
CREATE TEMP TABLE temp_dental_codes (
  category TEXT,
  subcategory TEXT,
  code TEXT,
  description TEXT,
  price DECIMAL(10,2),
  complexity TEXT,
  notes TEXT
);

-- Insert the dental codes data from CSV
-- Note: This would typically be done via COPY command or application import
-- For manual execution, we'll insert the key dental codes directly

INSERT INTO temp_dental_codes (category, subcategory, code, description, price, complexity, notes) VALUES
-- Consultation & Examination
('Consultation & Examination', 'Emergency', '004', 'Emergency oral examination', 135.00, 'Simple', ''),
('Consultation & Examination', 'Emergency', '005', 'Emergency examination after hours', 185.00, 'Simple', ''),
('Consultation & Examination', 'Follow-up', '009', 'Post-operative examination', 45.00, 'Simple', ''),
('Consultation & Examination', 'Follow-up', '003', 'Limited oral examination - problem focused', 55.00, 'Simple', ''),
('Consultation & Examination', 'Follow-up', '002', 'Periodic oral examination', 65.00, 'Simple', ''),
('Consultation & Examination', 'Follow-up', '008', 'Pre-operative consultation', 85.00, 'Simple', ''),
('Consultation & Examination', 'Initial Consultation', '001', 'Initial comprehensive oral examination', 95.00, 'Simple', ''),
('Consultation & Examination', 'Specialist', '010', 'Oral cancer screening', 115.00, 'Moderate', ''),
('Consultation & Examination', 'Specialist', '007', 'Second opinion consultation', 125.00, 'Simple', ''),
('Consultation & Examination', 'Specialist', '006', 'Specialist consultation', 155.00, 'Moderate', ''),

-- Cosmetic Procedures
('Cosmetic', 'Bonding', '922', 'Tooth reshaping per tooth', 185.00, 'Simple', ''),
('Cosmetic', 'Bonding', '921', 'Cosmetic bonding per tooth', 325.00, 'Simple', ''),
('Cosmetic', 'Consultation', '931', 'Smile makeover consultation', 185.00, 'Simple', ''),
('Cosmetic', 'Digital Services', '932', 'Digital smile design', 385.00, 'Moderate', ''),
('Cosmetic', 'Veneers', '913', 'Veneer consultation and mockup', 285.00, 'Simple', ''),
('Cosmetic', 'Veneers', '912', 'Composite veneer per tooth', 785.00, 'Moderate', ''),
('Cosmetic', 'Veneers', '911', 'Porcelain veneer per tooth', 1685.00, 'Moderate', ''),
('Cosmetic', 'Whitening', '903', 'Whitening maintenance kit', 185.00, 'Simple', ''),
('Cosmetic', 'Whitening', '902', 'Take-home whitening kit', 385.00, 'Simple', ''),
('Cosmetic', 'Whitening', '901', 'Professional in-office whitening', 785.00, 'Moderate', ''),

-- Restorative Procedures
('Restorative', 'Fillings', '211', 'Amalgam filling - 1 surface', 185.00, 'Simple', ''),
('Restorative', 'Fillings', '212', 'Amalgam filling - 2 surfaces', 225.00, 'Simple', ''),
('Restorative', 'Fillings', '213', 'Amalgam filling - 3+ surfaces', 285.00, 'Moderate', ''),
('Restorative', 'Fillings', '221', 'Composite filling - anterior 1 surface', 225.00, 'Simple', ''),
('Restorative', 'Fillings', '222', 'Composite filling - anterior 2 surfaces', 285.00, 'Simple', ''),
('Restorative', 'Fillings', '223', 'Composite filling - anterior 3+ surfaces', 385.00, 'Moderate', ''),
('Restorative', 'Fillings', '231', 'Composite filling - posterior 1 surface', 285.00, 'Simple', ''),
('Restorative', 'Fillings', '232', 'Composite filling - posterior 2 surfaces', 385.00, 'Moderate', ''),
('Restorative', 'Fillings', '233', 'Composite filling - posterior 3+ surfaces', 485.00, 'Moderate', ''),

-- Crown and Bridge
('Restorative', 'Crowns', '271', 'Porcelain fused to metal crown', 1885.00, 'Complex', ''),
('Restorative', 'Crowns', '272', 'All ceramic crown', 2185.00, 'Complex', ''),
('Restorative', 'Crowns', '273', 'Gold crown', 2485.00, 'Complex', ''),
('Restorative', 'Crowns', '274', 'Temporary crown', 385.00, 'Simple', ''),
('Restorative', 'Bridge', '281', 'Pontic - porcelain fused to metal', 1685.00, 'Complex', ''),
('Restorative', 'Bridge', '282', 'Pontic - all ceramic', 1885.00, 'Complex', ''),

-- Endodontics
('Endodontics', 'Root Canal', '331', 'Root canal - anterior tooth', 1285.00, 'Complex', ''),
('Endodontics', 'Root Canal', '332', 'Root canal - premolar', 1485.00, 'Complex', ''),
('Endodontics', 'Root Canal', '333', 'Root canal - molar', 1885.00, 'Complex', ''),
('Endodontics', 'Emergency', '334', 'Pulpotomy - emergency', 485.00, 'Moderate', ''),
('Endodontics', 'Post Treatment', '335', 'Post and core buildup', 685.00, 'Moderate', ''),

-- Periodontics
('Periodontics', 'Cleaning', '411', 'Routine prophylaxis', 285.00, 'Simple', ''),
('Periodontics', 'Cleaning', '412', 'Deep cleaning - per quadrant', 485.00, 'Moderate', ''),
('Periodontics', 'Surgery', '421', 'Gingivectomy - per quadrant', 785.00, 'Complex', ''),
('Periodontics', 'Surgery', '422', 'Periodontal flap surgery - per quadrant', 1285.00, 'Complex', ''),

-- Oral Surgery
('Oral Surgery', 'Extractions', '501', 'Simple extraction', 285.00, 'Simple', ''),
('Oral Surgery', 'Extractions', '502', 'Surgical extraction', 485.00, 'Moderate', ''),
('Oral Surgery', 'Extractions', '503', 'Wisdom tooth extraction - simple', 585.00, 'Moderate', ''),
('Oral Surgery', 'Extractions', '504', 'Wisdom tooth extraction - surgical', 885.00, 'Complex', ''),
('Oral Surgery', 'Advanced', '511', 'Bone grafting - small', 1285.00, 'Complex', ''),
('Oral Surgery', 'Advanced', '512', 'Sinus lift', 2485.00, 'Complex', ''),

-- Prosthodontics
('Prosthodontics', 'Dentures', '601', 'Complete upper denture', 3485.00, 'Complex', ''),
('Prosthodontics', 'Dentures', '602', 'Complete lower denture', 3485.00, 'Complex', ''),
('Prosthodontics', 'Dentures', '603', 'Partial denture - acrylic', 2185.00, 'Moderate', ''),
('Prosthodontics', 'Dentures', '604', 'Partial denture - cast metal', 2885.00, 'Complex', ''),
('Prosthodontics', 'Implants', '621', 'Single implant placement', 4885.00, 'Complex', ''),
('Prosthodontics', 'Implants', '622', 'Implant crown', 2885.00, 'Complex', ''),

-- Orthodontics
('Orthodontics', 'Consultation', '701', 'Orthodontic consultation', 285.00, 'Simple', ''),
('Orthodontics', 'Treatment', '711', 'Metal braces - full treatment', 18500.00, 'Complex', ''),
('Orthodontics', 'Treatment', '712', 'Ceramic braces - full treatment', 22500.00, 'Complex', ''),
('Orthodontics', 'Treatment', '713', 'Invisalign - full treatment', 28500.00, 'Complex', ''),
('Orthodontics', 'Appliances', '721', 'Retainer - upper or lower', 785.00, 'Simple', ''),

-- Pediatric Dentistry
('Pediatric', 'Preventive', '801', 'Child prophylaxis', 185.00, 'Simple', ''),
('Pediatric', 'Preventive', '802', 'Fluoride treatment', 125.00, 'Simple', ''),
('Pediatric', 'Preventive', '803', 'Sealant per tooth', 185.00, 'Simple', ''),
('Pediatric', 'Restorative', '811', 'Primary tooth filling', 185.00, 'Simple', ''),
('Pediatric', 'Surgery', '821', 'Primary tooth extraction', 185.00, 'Simple', '');

-- Now insert these codes for all existing dental and aesthetic practices
-- If no practices exist, we'll create a sample one
DO $$
DECLARE
    practice_record RECORD;
    practice_count INTEGER;
    new_practice_id UUID;
BEGIN
    -- Check if we have any practices
    SELECT COUNT(*) INTO practice_count 
    FROM practices 
    WHERE practice_type IN ('dental', 'aesthetic') OR practice_type IS NULL;
    
    -- If no practices, create a sample dental practice
    IF practice_count = 0 THEN
        INSERT INTO practices (
            name, 
            slug, 
            practice_type, 
            city, 
            contact_email, 
            contact_phone,
            address,
            description
        ) VALUES (
            'Namibian Dental Excellence',
            'namibian-dental-excellence',
            'dental',
            'Windhoek',
            'admin@namibian-dental.na',
            '+264-61-234567',
            '123 Independence Avenue, Windhoek',
            'Modern dental practice offering comprehensive dental care in Namibia'
        ) RETURNING id INTO new_practice_id;
        
        RAISE NOTICE 'Created sample dental practice: Namibian Dental Excellence (ID: %)', new_practice_id;
    END IF;
    
    -- Insert tariffs for each practice
    FOR practice_record IN 
        SELECT id, name FROM practices 
        WHERE practice_type IN ('dental', 'aesthetic') OR practice_type IS NULL
    LOOP
        INSERT INTO practice_tariffs (
            practice_id,
            code,
            price,
            namaf_prace_2025,
            practice_type,
            category,
            subcategory,
            full_description,
            unit,
            is_active,
            effective_from,
            created_at,
            updated_at
        )
        SELECT 
            practice_record.id,
            tdc.code,
            tdc.price,
            tdc.description,
            'dental',
            tdc.category,
            tdc.subcategory,
            tdc.description || CASE 
                WHEN tdc.complexity IS NOT NULL THEN ' - Complexity: ' || tdc.complexity 
                ELSE '' 
            END || CASE 
                WHEN tdc.notes IS NOT NULL AND tdc.notes != '' THEN '. Notes: ' || tdc.notes 
                ELSE '' 
            END,
            'per visit',
            true,
            CURRENT_DATE,
            NOW(),
            NOW()
        FROM temp_dental_codes tdc
        ON CONFLICT (practice_id, code, effective_from) 
        DO UPDATE SET
            price = EXCLUDED.price,
            namaf_prace_2025 = EXCLUDED.namaf_prace_2025,
            category = EXCLUDED.category,
            subcategory = EXCLUDED.subcategory,
            full_description = EXCLUDED.full_description,
            updated_at = EXCLUDED.updated_at;
            
        RAISE NOTICE 'Imported % dental codes for practice: %', 
            (SELECT COUNT(*) FROM temp_dental_codes), practice_record.name;
    END LOOP;
END $$;

-- Generate summary statistics
DO $$
DECLARE
    total_codes INTEGER;
    total_practices INTEGER;
    category_count INTEGER;
    avg_price DECIMAL(10,2);
BEGIN
    SELECT COUNT(*) INTO total_codes 
    FROM practice_tariffs 
    WHERE practice_type = 'dental';
    
    SELECT COUNT(DISTINCT practice_id) INTO total_practices 
    FROM practice_tariffs 
    WHERE practice_type = 'dental';
    
    SELECT COUNT(DISTINCT category) INTO category_count 
    FROM practice_tariffs 
    WHERE practice_type = 'dental';
    
    SELECT ROUND(AVG(price), 2) INTO avg_price 
    FROM practice_tariffs 
    WHERE practice_type = 'dental';
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 DENTAL TARIFFS IMPORT COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 IMPORT SUMMARY:';
    RAISE NOTICE '   • Total dental codes imported: %', total_codes;
    RAISE NOTICE '   • Practices updated: %', total_practices;
    RAISE NOTICE '   • Categories created: %', category_count;
    RAISE NOTICE '   • Average price: N$ %.2f', avg_price;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Next steps:';
    RAISE NOTICE '   1. Verify data in OneHealth admin dashboard';
    RAISE NOTICE '   2. Customize prices for individual practices';
    RAISE NOTICE '   3. Test appointment booking functionality';
    RAISE NOTICE '   4. Configure SMS notifications for appointments';
END $$;

-- Show summary by category
SELECT 
    category,
    subcategory,
    COUNT(*) as code_count,
    MIN(price) as min_price,
    MAX(price) as max_price,
    ROUND(AVG(price), 2) as avg_price
FROM practice_tariffs 
WHERE practice_type = 'dental'
GROUP BY category, subcategory
ORDER BY category, subcategory;

-- Clean up temporary table
DROP TABLE temp_dental_codes;

-- Create some sample practice_subtypes for dental practices
UPDATE practices 
SET practice_subtypes = ARRAY['General Dental Practitioners', 'Cosmetic Dentistry']
WHERE practice_type = 'dental' AND practice_subtypes IS NULL;