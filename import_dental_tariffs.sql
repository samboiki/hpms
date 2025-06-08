-- Dental Tariffs Import SQL
-- Generated from dentalpractice_codes_2025.xlsx
-- Total procedures: 178

-- Drop existing table if it exists
DROP TABLE IF EXISTS dental_tariffs CASCADE;

-- Create dental tariffs table
CREATE TABLE dental_tariffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code INTEGER UNIQUE NOT NULL,
    description TEXT NOT NULL,
    price_nad DECIMAL(10,2) NOT NULL,
    found_in_claims BOOLEAN DEFAULT false,
    requires_tooth_number BOOLEAN DEFAULT false,
    can_be_multiplied VARCHAR(20) DEFAULT 'NO',
    business_rule TEXT,
    example_calculation TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_dental_tariffs_code ON dental_tariffs(code);
CREATE INDEX idx_dental_tariffs_description ON dental_tariffs USING gin(to_tsvector('english', description));
CREATE INDEX idx_dental_tariffs_price ON dental_tariffs(price_nad);
CREATE INDEX idx_dental_tariffs_requires_tooth ON dental_tariffs(requires_tooth_number);
CREATE INDEX idx_dental_tariffs_can_multiply ON dental_tariffs(can_be_multiplied);

-- Insert dental tariff data
INSERT INTO dental_tariffs (
    code, description, price_nad, found_in_claims, requires_tooth_number, 
    can_be_multiplied, business_rule, example_calculation, notes
) VALUES
(8101, 'Full mouth examination, charting and treatment planning', 254.7, true, true, 'NO', 'Fixed price', '254.7 NAD', NULL),
(8102, 'Comprehensive consultation', 479, false, false, 'NO', 'Fixed price', '479.0 NAD', NULL),
(8104, 'Examination or consultation for a specific problem', 137.4, true, true, 'NO', 'Fixed price', '137.4 NAD', NULL),
(8106, 'Provision of a written treatment plan and quotation', 345.6, false, false, 'NO', 'Fixed price', '345.6 NAD', NULL),
(8107, 'Intra-oral radiographs, per film', 135.4, true, true, 'YES', 'Base price × number of X-rays', '78.90 × 3 = 236.70 (for 3 X-rays)', 'Multiply by number of radiographs taken'),
(8108, 'Maximum for 8107 is 7 radiographs', 1061.2, false, false, 'NO', 'Fixed price', '1061.2 NAD', NULL),
(8109, 'Infection control, per dentist/hygienist/assistant, per visit', 34.4, true, true, 'SOMETIMES', 'Usually charged once per visit, but can be per procedure', '40.00 NAD per visit OR 20.00 × procedures', 'Two pricing models observed in claims'),
(8110, 'Provision of sterilised and wrapped instrumentation', 76.8, true, true, 'NO', 'Fixed price', '76.8 NAD', NULL),
(8113, 'Occlusal radiographs', 234.5, false, false, 'NO', 'Fixed price', '234.5 NAD', NULL),
(8114, 'Hand-wrist radiograph', 549.8, false, false, 'NO', 'Fixed price', '549.8 NAD', NULL),
(8115, 'Extra-oral radiograph, per film', 549.8, false, false, 'YES', 'Base price × number of films/photos', '549.8 × quantity', 'Multiply by number of films or photographs taken'),
(8117, 'Study models - unmounted', 151.6, false, false, 'NO', 'Fixed price', '151.6 NAD', NULL),
(8119, 'Study models - mounted on adjustable articulator', 369.9, true, true, 'NO', 'Fixed price', '369.9 NAD', NULL),
(8121, 'Diagnostic photographs, per photograph', 151.6, false, false, 'YES', 'Base price × number of films/photos', '151.6 × quantity', 'Multiply by number of films or photographs taken'),
(8129, 'Additional fee for emergency treatment outside hours', 513.4, false, false, 'NO', 'Fixed price', '513.4 NAD', NULL),
(8131, 'Palliative treatment for dental pain', 208.2, true, true, 'NO', 'Fixed price', '208.2 NAD', NULL),
(8132, 'Gross pulpal debridement', 339.6, true, true, 'NO', 'Fixed price', '339.6 NAD', NULL),
(8133, 'Re-cementing of inlays, crowns or bridges', 208.2, true, true, 'NO', 'Fixed price', '208.2 NAD', NULL),
(8135, 'Removal of inlays and crowns', 412.3, false, false, 'NO', 'Fixed price', '412.3 NAD', NULL),
(8136, 'Access through prosthetic crown', 188, false, false, 'NO', 'Fixed price', '188.0 NAD', NULL),
(8137, 'Temporary crown emergency procedure', 711.5, false, false, 'NO', 'Fixed price', '711.5 NAD', NULL),
(8140, 'Fee for treatment at venue other than surgery', 337.5, true, true, 'NO', 'Fixed price', '337.5 NAD', NULL),
(8141, 'Inhalation sedation - first quarter-hour', 155.6, false, false, 'NO', 'Fixed price', '155.6 NAD', NULL),
(8143, 'Inhalation sedation - additional quarter-hour', 76.8, false, false, 'NO', 'Fixed price', '76.8 NAD', NULL),
(8144, 'Intravenous sedation', 93, false, false, 'NO', 'Fixed price', '93.0 NAD', NULL),
(8145, 'Local anaesthetic, per visit', 40.4, true, true, 'YES', 'Base price × number of injections', '23.50 × 2 = 47.00 (for 2 injections)', 'Multiply by number of anaesthetic carpules administered'),
(8147, 'Use of monitoring equipment for IV sedation', 329.5, false, false, 'NO', 'Fixed price', '329.5 NAD', NULL),
(8151, 'Oral hygiene instructions', 208.2, true, true, 'NO', 'Fixed price', '208.2 NAD', NULL),
(8153, 'Follow-up for oral hygiene re-evaluation', 155.6, false, false, 'NO', 'Fixed price', '155.6 NAD', NULL),
(8155, 'Polishing only - complete dentition', 208.2, true, true, 'NO', 'Fixed price', '208.2 NAD', NULL),
(8157, 'Re-burnishing and polishing of restorations', 208.2, false, false, 'NO', 'Fixed price', '208.2 NAD', NULL),
(8159, 'Scaling and polishing', 410.3, true, true, 'NO', 'Fixed price', '410.3 NAD', NULL),
(8161, 'Topical application of fluoride', 208.2, true, true, 'NO', 'Fixed price', '208.2 NAD', NULL),
(8163, 'Fissure sealant, per tooth', 135.4, true, true, 'YES', 'Base price × number of teeth', '135.4 × number of teeth', 'Multiply by number of teeth treated'),
(8167, 'Treatment of hypersensitive dentine, per visit', 159.7, true, true, 'NO', 'Charged once per visit', '159.7 per visit', 'Should only appear once per invoice'),
(8169, 'Bite plate for TMJ dysfunction', 802.4, false, false, 'NO', 'Fixed price', '802.4 NAD', NULL),
(8170, 'Minor occlusal adjustment', 456.8, false, false, 'NO', 'Fixed price', '456.8 NAD', NULL),
(8173, 'Space maintainer - fixed, per abutment', 390.1, false, false, 'NO', 'Fixed price', '390.1 NAD', NULL),
(8175, 'Space maintainer - removable', 493.2, false, false, 'NO', 'Fixed price', '493.2 NAD', NULL),
(8176, 'Periodontal screening', 252.7, false, false, 'NO', 'Fixed price', '252.7 NAD', NULL),
(8177, 'Oral hygiene instruction for periodontally compromised', 315.3, false, false, 'NO', 'Fixed price', '315.3 NAD', NULL),
(8178, 'Oral hygiene evaluation for periodontally compromised', 169.8, false, false, 'NO', 'Fixed price', '169.8 NAD', NULL),
(8179, 'Plaque removal for periodontally compromised', 236.5, false, false, 'NO', 'Fixed price', '236.5 NAD', NULL),
(8180, 'Scaling and polishing for periodontally compromised', 444.7, false, false, 'NO', 'Fixed price', '444.7 NAD', NULL),
(8182, 'Root planing with/without curettage, per quadrant', 832.8, false, false, 'YES', 'Base price × number of quadrants (max 4)', '832.8 × quadrants', 'Multiply by number of quadrants treated'),
(8183, 'Intra-muscular or sub-cutaneous injection', 93, false, false, 'NO', 'Fixed price', '93.0 NAD', NULL),
(8184, 'Root planing with/without curettage, per sextant', 660.9, true, true, 'YES', 'Base price × number of sextants (max 6)', '660.9 × sextants', 'Multiply by number of sextants treated'),
(8185, 'Gingivectomy-gingivoplasty, per quadrant', 1087.4, true, true, 'YES', 'Base price × number of quadrants (max 4)', '1087.4 × quadrants', 'Multiply by number of quadrants treated'),
(8186, 'Gingivectomy-gingivoplasty, per sextant', 865.1, true, true, 'YES', 'Base price × number of sextants (max 6)', '865.1 × sextants', 'Multiply by number of sextants treated'),
(8188, 'Biopsy - intra-oral', 529.6, false, false, 'NO', 'Fixed price', '529.6 NAD', NULL),
(8192, 'Appositioning of soft tissue injuries', 1024.8, false, false, 'NO', 'Fixed price', '1024.8 NAD', NULL),
(8193, 'Osseo-integrated abutment restoration', 3082.4, false, false, 'NO', 'Fixed price', '3082.4 NAD', NULL),
(8194, 'Placement of single osseo-integrated implant', 1932.3, false, false, 'NO', 'Fixed price', '1932.3 NAD', NULL),
(8195, 'Placement of second osseo-integrated implant', 1445.2, false, false, 'NO', 'Fixed price', '1445.2 NAD', NULL),
(8196, 'Placement of third osseo-integrated implant', 962.1, false, false, 'NO', 'Fixed price', '962.1 NAD', NULL),
(8198, 'Exposure of single osseo-integrated implant', 715.5, false, false, 'NO', 'Fixed price', '715.5 NAD', NULL),
(8199, 'Exposure of second osseo-integrated implant', 537.6, false, false, 'NO', 'Fixed price', '537.6 NAD', NULL),
(8200, 'Exposure of third osseo-integrated implant', 359.8, false, false, 'NO', 'Fixed price', '359.8 NAD', NULL),
(8201, 'Single tooth extraction', 208.2, true, true, 'NO', 'Fixed price', '208.2 NAD', NULL),
(8202, 'Each additional tooth extraction same quadrant', 82.9, false, false, 'PROGRESSIVE', 'First item at full price, additional items at reduced price', 'First: 82.9, Additional: varies', 'Different prices for first vs additional items'),
(8209, 'Surgical removal of erupted tooth', 895.4, true, true, 'NO', 'Fixed price', '895.4 NAD', NULL),
(8210, 'Removal of unerupted/impacted tooth - first', 1489.7, true, true, 'NO', 'Fixed price', '1489.7 NAD', NULL),
(8211, 'Removal of unerupted/impacted tooth - second', 802.4, false, false, 'NO', 'Fixed price', '802.4 NAD', NULL),
(8212, 'Removal of unerupted/impacted tooth - additional', 452.8, false, false, 'NO', 'Fixed price', '452.8 NAD', NULL),
(8213, 'Surgical removal of residual roots', 895.4, true, true, 'NO', 'Fixed price', '895.4 NAD', NULL),
(8214, 'Surgical removal of residual roots - subsequent', 695.3, false, false, 'NO', 'Fixed price', '695.3 NAD', NULL),
(8215, 'Surgical exposure of impacted teeth for orthodontics', 1661.5, false, false, 'NO', 'Fixed price', '1661.5 NAD', NULL),
(8221, 'Local treatment of post-extraction haemorrhage', 155.6, false, false, 'NO', 'Fixed price', '155.6 NAD', NULL),
(8223, 'Post-extraction haemorrhage - additional visit', 103.1, false, false, 'NO', 'Fixed price', '103.1 NAD', NULL),
(8225, 'Treatment of septic socket - initial', 155.6, true, true, 'NO', 'Fixed price', '155.6 NAD', NULL),
(8227, 'Treatment of septic socket - additional', 103.1, false, false, 'NO', 'Fixed price', '103.1 NAD', NULL),
(8229, 'Apicoectomy including retrograde filling', 1024.8, false, false, 'NO', 'Fixed price', '1024.8 NAD', NULL),
(8231, 'Full upper and lower dentures', 3355.3, false, false, 'NO', 'Fixed price', '3355.3 NAD', NULL),
(8232, 'Full upper or lower denture', 2067.7, false, false, 'NO', 'Fixed price', '2067.7 NAD', NULL),
(8233, 'Partial denture, one tooth', 960.1, false, false, 'NO', 'Fixed price', '960.1 NAD', NULL),
(8234, 'Partial denture, two teeth', 960.1, false, false, 'NO', 'Fixed price', '960.1 NAD', NULL),
(8235, 'Partial denture, three teeth', 1443.2, false, false, 'NO', 'Fixed price', '1443.2 NAD', NULL),
(8236, 'Partial denture, four teeth', 1443.2, false, false, 'NO', 'Fixed price', '1443.2 NAD', NULL),
(8237, 'Partial denture, five teeth', 1443.2, false, false, 'NO', 'Fixed price', '1443.2 NAD', NULL),
(8238, 'Partial denture, six teeth', 1910.1, false, false, 'NO', 'Fixed price', '1910.1 NAD', NULL),
(8239, 'Partial denture, seven teeth', 1910.1, false, false, 'NO', 'Fixed price', '1910.1 NAD', NULL),
(8240, 'Partial denture, eight teeth', 1910.1, false, false, 'NO', 'Fixed price', '1910.1 NAD', NULL),
(8241, 'Partial denture, nine or more teeth', 1910.1, false, false, 'NO', 'Fixed price', '1910.1 NAD', NULL),
(8251, 'Cast gold clasp or rest', 192, false, false, 'NO', 'Fixed price', '192.0 NAD', NULL),
(8253, 'Wrought gold clasp or rest', 192, false, false, 'NO', 'Fixed price', '192.0 NAD', NULL),
(8255, 'Stainless steel clasp or rest', 200.1, true, true, 'NO', 'Fixed price', '200.1 NAD', NULL),
(8257, 'Lingual bar or palatal bar', 234.5, false, false, 'NO', 'Fixed price', '234.5 NAD', NULL),
(8259, 'Re-base of denture', 784.2, false, false, 'NO', 'Fixed price', '784.2 NAD', NULL),
(8261, 'Re-model of denture', 1255.2, false, false, 'NO', 'Fixed price', '1255.2 NAD', NULL),
(8263, 'Reline of denture in selfcuring acrylic', 493.2, false, false, 'NO', 'Fixed price', '493.2 NAD', NULL),
(8265, 'Tissue conditioner and soft reline', 329.5, false, false, 'NO', 'Fixed price', '329.5 NAD', NULL),
(8267, 'Soft base re-line per denture', 1142, false, false, 'NO', 'Fixed price', '1142.0 NAD', NULL),
(8269, 'Repair of denture', 266.8, false, false, 'NO', 'Fixed price', '266.8 NAD', NULL),
(8270, 'Add clasp to existing partial denture', 192, false, false, 'NO', 'Fixed price', '192.0 NAD', NULL),
(8271, 'Add tooth to existing partial denture', 192, false, false, 'NO', 'Fixed price', '192.0 NAD', NULL),
(8273, 'Additional fee where impression required', 155.6, true, true, 'NO', 'Fixed price', '155.6 NAD', NULL),
(8275, 'Adjustment of denture', 155.6, false, false, 'NO', 'Fixed price', '155.6 NAD', NULL),
(8281, 'Metal base to partial denture', 2241.6, false, false, 'NO', 'Fixed price', '2241.6 NAD', NULL),
(8303, 'Indirect pulp capping', 278.9, true, true, 'NO', 'Fixed price', '278.9 NAD', NULL),
(8304, 'Rubber dam, per arch', 161.7, true, true, 'YES', 'Base price × number of arches (max 2)', '161.7 × arches', 'Multiply by number of arches (upper/lower)'),
(8305, 'Apexification of root canal, per visit', 278.9, false, false, 'NO', 'Charged once per visit', '278.9 per visit', 'Should only appear once per invoice'),
(8307, 'Amputation of pulp (pulpotomy)', 274.9, false, false, 'NO', 'Fixed price', '274.9 NAD', NULL),
(8325, 'Bleaching of non-vital teeth, per tooth', 491.2, false, false, 'YES', 'Base price × number of teeth', '491.2 × number of teeth', 'Multiply by number of teeth treated'),
(8327, 'Additional visit for bleaching non-vital tooth', 234.5, true, true, 'NO', 'Fixed price', '234.5 NAD', NULL),
(8328, 'Each additional canal - anteriors and premolars', 390.1, false, false, 'PROGRESSIVE', 'First item at full price, additional items at reduced price', 'First: 390.1, Additional: varies', 'Different prices for first vs additional items'),
(8329, 'Each additional canal - anteriors and premolars', 479, true, true, 'PROGRESSIVE', 'First item at full price, additional items at reduced price', 'First: 479.0, Additional: varies', 'Different prices for first vs additional items'),
(8330, 'Removal of fractured post or instrument', 274.9, false, false, 'NO', 'Fixed price', '274.9 NAD', NULL),
(8332, 'Single-canal tooth, per visit', 208.2, false, false, 'NO', 'Charged once per visit', '208.2 per visit', 'Should only appear once per invoice'),
(8333, 'Multi-canal tooth, per visit', 289, false, false, 'NO', 'Charged once per visit', '289.0 per visit', 'Should only appear once per invoice'),
(8334, 'Re-preparation of previously obturated canal', 309.3, false, false, 'NO', 'Fixed price', '309.3 NAD', NULL),
(8335, 'First canal - anteriors and premolars', 939.9, false, false, 'NO', 'Fixed price', '939.9 NAD', NULL),
(8336, 'First canal - molars', 1297.6, false, false, 'NO', 'Fixed price', '1297.6 NAD', NULL),
(8337, 'Each additional canal - molars', 390.1, false, false, 'PROGRESSIVE', 'First item at full price, additional items at reduced price', 'First: 390.1, Additional: varies', 'Different prices for first vs additional items'),
(8338, 'First canal - anteriors and premolars', 1445.2, true, true, 'NO', 'Fixed price', '1445.2 NAD', NULL),
(8339, 'First canal - molars', 1986.9, true, true, 'NO', 'Fixed price', '1986.9 NAD', NULL),
(8340, 'Each additional canal - molars', 479, true, true, 'PROGRESSIVE', 'First item at full price, additional items at reduced price', 'First: 479.0, Additional: varies', 'Different prices for first vs additional items'),
(8341, 'Amalgam - one surface', 373.9, false, false, 'NO', 'Fixed price', '373.9 NAD', NULL),
(8342, 'Amalgam - two surfaces', 468.9, false, false, 'NO', 'Fixed price', '468.9 NAD', NULL),
(8343, 'Amalgam - three surfaces', 563.9, false, false, 'NO', 'Fixed price', '563.9 NAD', NULL),
(8344, 'Amalgam - four or more surfaces', 632.6, false, false, 'NO', 'Fixed price', '632.6 NAD', NULL),
(8345, 'Preformed post retention, per post', 410.3, false, false, 'NO', 'Fixed price', '410.3 NAD', NULL),
(8347, 'Pin retention for restoration, first pin', 202.1, false, false, 'NO', 'Fixed price', '202.1 NAD', NULL),
(8348, 'Pin retention, each additional pin', 192, false, false, 'PROGRESSIVE', 'First item at full price, additional items at reduced price', 'First: 192.0, Additional: varies', 'Different prices for first vs additional items'),
(8349, 'Carving plastic restoration for prosthesis', 82.9, false, false, 'NO', 'Fixed price', '82.9 NAD', NULL),
(8351, 'Resin - one surface, anterior', 412.3, true, true, 'NO', 'Fixed price', '412.3 NAD', NULL),
(8352, 'Resin - two surfaces, anterior', 523.5, true, true, 'NO', 'Fixed price', '523.5 NAD', NULL),
(8353, 'Resin - three surfaces, anterior', 620.5, true, true, 'NO', 'Fixed price', '620.5 NAD', NULL),
(8354, 'Resin - four or more surfaces, anterior', 695.3, true, true, 'NO', 'Fixed price', '695.3 NAD', NULL),
(8355, 'Composite veneers (Direct)', 723.6, false, false, 'NO', 'Fixed price', '723.6 NAD', NULL),
(8356, 'Bridge per abutment - Maryland type', 925.8, false, false, 'NO', 'Fixed price', '925.8 NAD', NULL),
(8357, 'Preformed metal crown', 422.4, false, false, 'NO', 'Fixed price', '422.4 NAD', NULL),
(8361, 'Inlay, metallic - one surface', 636.7, false, false, 'NO', 'Fixed price', '636.7 NAD', NULL),
(8362, 'Inlay, metallic - two surfaces', 925.7, false, false, 'NO', 'Fixed price', '925.7 NAD', NULL),
(8363, 'Inlay, metallic - three surfaces', 1538.2, false, false, 'NO', 'Fixed price', '1538.2 NAD', NULL),
(8364, 'Inlay, metallic - four or more surfaces', 1863.6, false, false, 'NO', 'Fixed price', '1863.6 NAD', NULL),
(8366, 'Pin retention as part of cast restoration', 309.2, false, false, 'NO', 'Fixed price', '309.2 NAD', NULL),
(8367, 'Resin - one surface, posterior', 448.7, true, true, 'NO', 'Fixed price', '448.7 NAD', NULL),
(8368, 'Resin - two surfaces, posterior', 551.8, true, true, 'NO', 'Fixed price', '551.8 NAD', NULL),
(8369, 'Resin - three surfaces, posterior', 663, true, true, 'NO', 'Fixed price', '663.0 NAD', NULL),
(8370, 'Resin - four or more surfaces, posterior', 723.6, true, true, 'NO', 'Fixed price', '723.6 NAD', NULL),
(8371, 'Inlay, ceramic/resin - one surface', 760, false, false, 'NO', 'Fixed price', '760.0 NAD', NULL),
(8372, 'Inlay, ceramic/resin - two surfaces', 1125.8, false, false, 'NO', 'Fixed price', '1125.8 NAD', NULL),
(8373, 'Inlay, ceramic/resin - three surfaces', 1851.4, false, false, 'NO', 'Fixed price', '1851.4 NAD', NULL),
(8374, 'Inlay, ceramic/resin - four or more surfaces', 2241.6, false, false, 'NO', 'Fixed price', '2241.6 NAD', NULL),
(8376, 'Prefabricated post and core', 1129.9, false, false, 'NO', 'Fixed price', '1129.9 NAD', NULL),
(8391, 'Cast post and core - single', 477, false, false, 'NO', 'Fixed price', '477.0 NAD', NULL),
(8393, 'Cast post and core - double', 760, false, false, 'NO', 'Fixed price', '760.0 NAD', NULL),
(8395, 'Cast post and core - triple', 1101.6, false, false, 'NO', 'Fixed price', '1101.6 NAD', NULL),
(8396, 'Cast coping', 311.3, false, false, 'NO', 'Fixed price', '311.3 NAD', NULL),
(8397, 'Cast core with pins', 760, false, false, 'NO', 'Fixed price', '760.0 NAD', NULL),
(8398, 'Core build-up, including any pins', 925.7, false, false, 'NO', 'Fixed price', '925.7 NAD', NULL),
(8401, 'Cast full crown', 2379, false, false, 'NO', 'Fixed price', '2379.0 NAD', NULL),
(8403, 'Cast three-quarter crown', 2379, false, false, 'NO', 'Fixed price', '2379.0 NAD', NULL),
(8407, 'Acrylic veneered crown', 2379, false, false, 'NO', 'Fixed price', '2379.0 NAD', NULL),
(8409, 'Porcelain jacket crown', 2379, false, false, 'NO', 'Fixed price', '2379.0 NAD', NULL),
(8411, 'Porcelain veneered crown', 2379, false, false, 'NO', 'Fixed price', '2379.0 NAD', NULL),
(8413, 'Facing replacement', 464.9, false, false, 'NO', 'Fixed price', '464.9 NAD', NULL),
(8414, 'Additional fee for crown within clasp', 135.4, false, false, 'NO', 'Fixed price', '135.4 NAD', NULL),
(8420, 'Sanitary pontic', 1156.2, false, false, 'NO', 'Fixed price', '1156.2 NAD', NULL),
(8422, 'Posterior pontic', 1538.2, false, false, 'NO', 'Fixed price', '1538.2 NAD', NULL),
(8424, 'Anterior pontic', 1940.4, false, false, 'NO', 'Fixed price', '1940.4 NAD', NULL),
(8570, 'Computer generated ceramic restoration', 2374.9, false, false, 'NO', 'Fixed price', '2374.9 NAD', NULL),
(8811, 'Tracing and analysis of extra-oral film', 62.6, false, false, 'NO', 'Fixed price', '62.6 NAD', NULL),
(8812, 'CBCT capture limited field - less than one jaw', 1155.5, false, false, 'NO', 'Fixed price', '1155.5 NAD', NULL),
(8813, 'CBCT capture one full arch - mandible', 1290.7, false, false, 'NO', 'Fixed price', '1290.7 NAD', NULL),
(8814, 'CBCT capture one full arch - maxilla', 1290.7, false, false, 'NO', 'Fixed price', '1290.7 NAD', NULL),
(8815, 'CBCT capture both arches without orbits', 1352.1, false, false, 'NO', 'Fixed price', '1352.1 NAD', NULL),
(8816, 'CBCT capture for TMJ series', 1352.1, false, false, 'NO', 'Fixed price', '1352.1 NAD', NULL),
(8817, 'CBCT capture maxilla with orbits', 1475.1, false, false, 'NO', 'Fixed price', '1475.1 NAD', NULL),
(8818, 'CBCT capture both arches with orbits', 1647.2, false, false, 'NO', 'Fixed price', '1647.2 NAD', NULL),
(8819, 'Interpretation of diagnostic image', 491.6, false, false, 'NO', 'Fixed price', '491.6 NAD', NULL),
(8820, 'CBCT image capture limited - less than one jaw', 693.2, false, false, 'NO', 'Fixed price', '693.2 NAD', NULL),
(8821, 'CBCT image capture one arch - mandible', 774.4, false, false, 'NO', 'Fixed price', '774.4 NAD', NULL),
(8822, 'CBCT image capture one arch - maxilla', 774.4, false, false, 'NO', 'Fixed price', '774.4 NAD', NULL),
(8823, 'CBCT capture both arches without orbits', 811.3, false, false, 'NO', 'Fixed price', '811.3 NAD', NULL),
(8824, 'CBCT capture for TMJ series', 811.3, false, false, 'NO', 'Fixed price', '811.3 NAD', NULL),
(8825, 'CBCT capture maxilla with orbits', 885, false, false, 'NO', 'Fixed price', '885.0 NAD', NULL),
(8826, 'CBCT capture both arches with orbits', 988.3, false, false, 'NO', 'Fixed price', '988.3 NAD', NULL);

-- Helper function to calculate procedure price with quantity
CREATE OR REPLACE FUNCTION calculate_procedure_price(
    p_code INTEGER,
    p_quantity INTEGER DEFAULT 1
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    tariff RECORD;
    calculated_price DECIMAL(10,2);
BEGIN
    SELECT * INTO tariff FROM dental_tariffs WHERE code = p_code;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tariff not found for code: %', p_code;
    END IF;
    
    CASE tariff.can_be_multiplied
        WHEN 'YES' THEN
            calculated_price := tariff.price_nad * p_quantity;
        WHEN 'SOMETIMES' THEN
            -- For 'SOMETIMES', allow multiplication but cap at reasonable limits
            calculated_price := tariff.price_nad * LEAST(p_quantity, 10);
        WHEN 'PROGRESSIVE' THEN
            -- Progressive pricing with bulk discount
            calculated_price := tariff.price_nad * p_quantity * 
                CASE 
                    WHEN p_quantity >= 5 THEN 0.9  -- 10% discount for 5+
                    WHEN p_quantity >= 3 THEN 0.95 -- 5% discount for 3+
                    ELSE 1.0 
                END;
        ELSE
            calculated_price := tariff.price_nad;
    END CASE;
    
    RETURN calculated_price;
END;
$$ LANGUAGE plpgsql;

-- Function to search procedures by description
CREATE OR REPLACE FUNCTION search_dental_procedures(search_term TEXT)
RETURNS TABLE(
    code INTEGER,
    description TEXT,
    price_nad DECIMAL(10,2),
    requires_tooth_number BOOLEAN,
    can_be_multiplied VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dt.code,
        dt.description,
        dt.price_nad,
        dt.requires_tooth_number,
        dt.can_be_multiplied
    FROM dental_tariffs dt
    WHERE dt.description ILIKE '%' || search_term || '%'
    ORDER BY dt.code;
END;
$$ LANGUAGE plpgsql;

-- Create supporting tables for billing integration
CREATE TABLE IF NOT EXISTS appointment_procedures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID,
    tariff_code INTEGER REFERENCES dental_tariffs(code),
    tooth_number VARCHAR(10),
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_appointment_procedures_appointment ON appointment_procedures(appointment_id);
CREATE INDEX idx_appointment_procedures_tariff ON appointment_procedures(tariff_code);

-- Verification queries
SELECT 'Total dental procedures imported:' as info, COUNT(*) as count FROM dental_tariffs;
SELECT 'Price range:' as info, MIN(price_nad) as min_price, MAX(price_nad) as max_price FROM dental_tariffs;
SELECT 'Procedures requiring tooth number:' as info, COUNT(*) as count FROM dental_tariffs WHERE requires_tooth_number = true;
SELECT 'Procedures that can be multiplied:' as info, COUNT(*) as count FROM dental_tariffs WHERE can_be_multiplied != 'NO';

-- Sample expensive procedures
SELECT code, description, price_nad 
FROM dental_tariffs 
WHERE price_nad > 1000 
ORDER BY price_nad DESC 
LIMIT 5;
