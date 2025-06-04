-- Import Comprehensive Dental Tariffs for General Dental Practitioners
-- Execute this after the main migration is complete

-- First, add practice_type and practice_subtypes to practices table if not already added
ALTER TABLE practices ADD COLUMN IF NOT EXISTS practice_type TEXT DEFAULT 'general';
ALTER TABLE practices ADD COLUMN IF NOT EXISTS practice_subtypes TEXT[] DEFAULT ARRAY['General Practice'];

-- Update Dr. Polina practice to be aesthetic type
UPDATE practices 
SET practice_type = 'aesthetic', 
    practice_subtypes = ARRAY['Aesthetic Medicine', 'Cosmetic Procedures']
WHERE slug = 'dr-polina';

-- Insert comprehensive dental tariffs for all practices with dental type
INSERT INTO practice_tariffs (
  practice_id, code, price, namaf_prace_2025, edi_diagnosi, full_description, 
  practice_type, practice_subtypes, category, subcategory
) 
SELECT 
  p.id as practice_id,
  tariff_data.code,
  tariff_data.price,
  tariff_data.namaf_prace_2025,
  tariff_data.edi_diagnosi,
  tariff_data.full_description,
  'dental' as practice_type,
  ARRAY['General Dental Practitioners'] as practice_subtypes,
  tariff_data.category,
  tariff_data.subcategory
FROM practices p
CROSS JOIN (VALUES
  ('8101', 148.30, 'FULL MOUTH EXAMINATION CHARTIN', '', 'Complete oral examination with charting', 'Examination', 'Diagnostic'),
  ('8104', 80.00, 'EXAMINATION OR CONSULTATION FO', '', 'General dental consultation', 'Examination', 'Diagnostic'),
  ('8107', 236.70, 'TOOTH: 45 INTRAORAL RADIOGRAPH', '', 'Intraoral X-ray examination', 'Radiology', 'Diagnostic'),
  ('8109', 40.00, 'INFECTION CONTROL PER DENTIST', '', 'Infection control procedures', 'Safety', 'Procedural'),
  ('8110', 44.70, 'PROVISION OF STERILISED AND WR', '', 'Sterilized instruments provision', 'Safety', 'Procedural'),
  ('8119', 215.40, 'STUDY MODELS MOUNTED ON ADJUS', '', 'Study models for treatment planning', 'Prosthetics', 'Diagnostic'),
  ('8131', 121.20, 'TOOTH: 36 PALLIATIVE EMERGENCY', '', 'Emergency pain relief treatment', 'Emergency', 'Pain Management'),
  ('8132', 197.80, 'TOOTH: 11 GROSS PULPAL DEBRIDE', '', 'Pulp chamber cleaning', 'Endodontics', 'Root Canal'),
  ('8133', 121.20, 'TOOTH: 31 RECEMENTING OF INLAY', '', 'Re-cementing dental restoration', 'Restorative', 'Repair'),
  ('8140', 196.60, 'FEE FOR TREATMENT AT A VENUE O', '', 'Off-site treatment fee', 'Administrative', 'Special'),
  ('8145', 23.50, 'LOCAL ANAESTHETIC PER VISIT', '', 'Local anesthesia administration', 'Anesthesia', 'Pain Management'),
  ('8146', 800.00, 'TOOTH: 21/12 RESIN BONDING FOR', '', 'Cosmetic resin bonding', 'Cosmetic', 'Aesthetic'),
  ('8151', 121.20, 'ORAL HYGIENE INSTRUCTIONS', '', 'Patient education on oral care', 'Preventive', 'Education'),
  ('8155', 121.20, 'POLISHING ONLY INCLUDING REMOV', '', 'Teeth polishing and stain removal', 'Preventive', 'Cleaning'),
  ('8159', 238.90, 'SCALING AND POLISHING', '', 'Professional teeth cleaning', 'Preventive', 'Cleaning'),
  ('8161', 121.20, 'TOPICAL APPLICATION OF FLUORID', '', 'Fluoride treatment application', 'Preventive', 'Protection'),
  ('8163', 78.90, 'TOOTH: 36 TOOTH SURFACE: O FIS', '', 'Fissure sealant application', 'Preventive', 'Protection'),
  ('8167', 93.00, 'TOOTH: 35 TREATMENT OF HYPERSE', '', 'Hypersensitivity treatment', 'Treatment', 'Desensitization'),
  ('8184', 384.90, 'ROOT PLANING WITH OR WITHOUT P', '', 'Deep periodontal cleaning', 'Periodontics', 'Deep Cleaning'),
  ('8185', 633.30, 'TOOTH: 38 GINGIVECTOMYGINGIVOP', '', 'Gum surgery procedure', 'Periodontics', 'Surgery'),
  ('8186', 503.80, 'GINGIVECTOMYGINGIVOPLASTY PER', '', 'Gum reshaping per quadrant', 'Periodontics', 'Surgery'),
  ('8201', 121.20, 'TOOTH: 47 SINGLE TOOTH', '', 'Single tooth extraction', 'Oral Surgery', 'Extraction'),
  ('8209', 521.40, 'TOOTH: 45 SURGICAL REMOVAL OF', '', 'Surgical tooth extraction', 'Oral Surgery', 'Extraction'),
  ('8210', 867.50, 'TOOTH: 18 REMOVAL OF UNERUPTED', '', 'Impacted tooth removal', 'Oral Surgery', 'Extraction'),
  ('8213', 521.40, 'TOOTH: 36 SURGICAL REMOVAL OF', '', 'Complex surgical extraction', 'Oral Surgery', 'Extraction'),
  ('8220', 400.00, 'USE OF SUTURE PROVIDED BY PRAC', '', 'Surgical suturing', 'Oral Surgery', 'Repair'),
  ('8225', 90.60, 'TOOTH: 46 TREATMENT OF SEPTIC', '', 'Infection treatment', 'Treatment', 'Infection Control'),
  ('8255', 116.50, 'TOOTH: 11 STAINLESS STEEL CLAS', '', 'Stainless steel crown', 'Restorative', 'Crown'),
  ('8273', 296.20, 'ADDITIONAL FEEBENEFIT WHERE IM', '', 'Additional procedure fee', 'Administrative', 'Additional'),
  ('8303', 162.40, 'TOOTH: 45 TOOTH SURFACE: O IND', '', 'Indirect restoration', 'Restorative', 'Filling'),
  ('8304', 188.40, 'RUBBER DAM PER ARCH', '', 'Rubber dam isolation', 'Procedural', 'Isolation'),
  ('8327', 223.10, 'TOOTH: 21 EACH ADDITIONAL VISI', '', 'Additional endodontic visit', 'Endodontics', 'Root Canal'),
  ('8329', 455.90, 'TOOTH: 25 EACH ADDITIONAL CANA', '', 'Additional root canal', 'Endodontics', 'Root Canal'),
  ('8338', 841.60, 'TOOTH: 11 FIRST CANAL ANTERIO', '', 'Anterior root canal treatment', 'Endodontics', 'Root Canal'),
  ('8339', 1157.10, 'TOOTH: 36 FIRST CANAL MOLARS', '', 'Molar root canal treatment', 'Endodontics', 'Root Canal'),
  ('8340', 279.00, 'TOOTH: 36 EACH ADDITIONAL CANA', '', 'Additional canal treatment', 'Endodontics', 'Root Canal'),
  ('8346', 42.14, 'TOOTH: 34 RESTORATIVE MATERIAL', '', 'Restorative material fee', 'Restorative', 'Material'),
  ('8351', 240.10, 'TOOTH: 21 RESIN ONE SURFACE A', '', 'Single surface resin filling', 'Restorative', 'Filling'),
  ('8352', 304.90, 'TOOTH: 13 RESIN TWO SURFACES', '', 'Two surface resin filling', 'Restorative', 'Filling'),
  ('8353', 361.40, 'TOOTH: 12 RESIN THREE SURFACE', '', 'Three surface resin filling', 'Restorative', 'Filling'),
  ('8354', 404.90, 'TOOTH: 12 RESIN FOUR OR MORE', '', 'Four+ surface resin filling', 'Restorative', 'Filling'),
  ('8367', 261.30, 'TOOTH: 38 RESIN ONE SURFACE P', '', 'Posterior single surface filling', 'Restorative', 'Filling'),
  ('8368', 321.30, 'TOOTH: 44 RESIN TWO SURFACES', '', 'Posterior two surface filling', 'Restorative', 'Filling'),
  ('8369', 386.10, 'TOOTH: 35 RESIN THREE SURFACE', '', 'Posterior three surface filling', 'Restorative', 'Filling'),
  ('8370', 421.40, 'TOOTH: 34 RESIN FOUR OR MORE', '', 'Posterior four+ surface filling', 'Restorative', 'Filling'),
  ('9301', 94.80, 'CASTING AND TRIMMING OF MODEL', '', 'Model casting and trimming', 'Laboratory', 'Model'),
  ('9303', 41.00, 'CASTING AND TRIMMING OF MODEL', '', 'Simple model casting', 'Laboratory', 'Model'),
  ('9313', 90.20, 'DUPLICATING MODEL PER MODEL', '', 'Model duplication', 'Laboratory', 'Model'),
  ('9327', 39.84, 'INFECTION CONTROL PER IMPRESSI', '', 'Impression infection control', 'Safety', 'Procedural'),
  ('9330', 52.70, 'DELIVERY CHARGE PER PROCEDURE', '', 'Appliance delivery fee', 'Administrative', 'Delivery'),
  ('9351', 394.80, 'SETUP AND FINISH OF ONETOOTH D', '', 'Single tooth denture setup', 'Prosthetics', 'Denture'),
  ('9352', 419.40, 'SETUP AND FINISH OF TWOTOOTH D', '', 'Two tooth denture setup', 'Prosthetics', 'Denture'),
  ('9353', 741.70, 'SETUP AND FINISH OF THREETOOTH', '', 'Three tooth denture setup', 'Prosthetics', 'Denture'),
  ('9355', 515.40, 'SETUP AND FINISH OF FIVETOOTH', '', 'Five tooth denture setup', 'Prosthetics', 'Denture'),
  ('9358', 770.80, 'SETUP AND FINISH OF EIGHTTOOTH', '', 'Eight tooth denture setup', 'Prosthetics', 'Denture'),
  ('9385', 248.60, 'ADDITIONAL FEE FOR SUPPLYING F', '', 'Additional supply fee', 'Administrative', 'Additional'),
  ('9447', 585.80, 'CAST CLASP', '', 'Cast metal clasp', 'Prosthetics', 'Clasp'),
  ('9450', 112.50, 'FINISHING OF ACRYLIC WORK ON A', '', 'Acrylic work finishing', 'Laboratory', 'Finishing'),
  ('9453', 869.20, 'BASIC CHARGE WHICH INCLUDES R', '', 'Basic denture charge', 'Prosthetics', 'Denture'),
  ('9455', 217.80, 'ADDITIONAL CHARGE FOR EACH ONE', '', 'Additional tooth charge', 'Prosthetics', 'Additional'),
  ('9459', 136.00, 'ADDITIONAL CHARGE FOR EACH RES', '', 'Additional restoration charge', 'Prosthetics', 'Additional'),
  ('9469', 59.70, 'ADDITIONAL CHARGE FOR SADDLE W', '', 'Saddle work additional charge', 'Prosthetics', 'Additional'),
  ('9473', 59.70, 'ADDITIONAL CHARGE FOR HORSESHO', '', 'Horseshoe clasp additional', 'Prosthetics', 'Clasp'),
  ('9587', 328.00, 'ADDITIONAL FEE FOR BALL CLASP', '', 'Ball clasp additional fee', 'Prosthetics', 'Clasp'),
  ('9589', 226.40, 'ADDITIONAL FEE FOR SINGLE ARM', '', 'Single arm clasp fee', 'Prosthetics', 'Clasp'),
  ('9631', 302.20, 'GUM GUARD', '', 'Custom gum guard', 'Prosthetics', 'Guard'),
  ('9700', 68.00, 'DIATORICS 1 X 68', '', 'Diatorics procedure', 'Treatment', 'Special'),
  ('9702', 300.00, 'DIATORICS ODDS ANTERIOR', '', 'Anterior diatorics', 'Treatment', 'Special'),
  ('9722', 500.00, 'ACRYLIC PER DENTURE', '', 'Acrylic denture work', 'Prosthetics', 'Denture'),
  ('9726', 480.00, 'PREFORMED ROACH OR BALL CLASP', '', 'Preformed clasp work', 'Prosthetics', 'Clasp'),
  ('9741', 240.00, 'COST OF COBALT CHROME CASTING', '', 'Cobalt chrome casting', 'Laboratory', 'Casting'),
  ('9776', 385.00, 'COST OF MOUTH PROTECTOR MATERI', '', 'Mouth protector materials', 'Prosthetics', 'Guard')
) AS tariff_data(code, price, namaf_prace_2025, edi_diagnosi, full_description, category, subcategory)
WHERE p.practice_type = 'dental' OR p.practice_type IS NULL;

-- For practices that don't have a type yet, set them as dental if they should be
UPDATE practices 
SET practice_type = 'dental', 
    practice_subtypes = ARRAY['General Dental Practitioners']
WHERE practice_type IS NULL AND slug != 'dr-polina';

-- Summary
SELECT 
  'Dental tariffs imported successfully!' as status,
  COUNT(*) as total_tariffs_imported
FROM practice_tariffs 
WHERE practice_type = 'dental';