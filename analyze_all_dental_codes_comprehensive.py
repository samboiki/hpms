#!/usr/bin/env python3
import csv
import os
import re
from collections import defaultdict, Counter
import json

# 2025 Official tariff codes and prices
official_2025_codes = {
    '8101': {'description': 'Full mouth examination, charting and treatment planning', 'price': 254.70},
    '8102': {'description': 'Comprehensive consultation', 'price': 479.00},
    '8104': {'description': 'Examination or consultation for a specific problem', 'price': 137.40},
    '8106': {'description': 'Provision of a written treatment plan and quotation', 'price': 345.60},
    '8107': {'description': 'Intra-oral radiographs, per film', 'price': 135.40},
    '8108': {'description': 'Maximum for 8107 is 7 radiographs', 'price': 1061.20},
    '8109': {'description': 'Infection control, per dentist/hygienist/assistant, per visit', 'price': 34.40},
    '8110': {'description': 'Provision of sterilised and wrapped instrumentation', 'price': 76.80},
    '8113': {'description': 'Occlusal radiographs', 'price': 234.50},
    '8114': {'description': 'Hand-wrist radiograph', 'price': 549.80},
    '8115': {'description': 'Extra-oral radiograph, per film', 'price': 549.80},
    '8117': {'description': 'Study models - unmounted', 'price': 151.60},
    '8119': {'description': 'Study models - mounted on adjustable articulator', 'price': 369.90},
    '8121': {'description': 'Diagnostic photographs, per photograph', 'price': 151.60},
    '8129': {'description': 'Additional fee for emergency treatment outside hours', 'price': 513.40},
    '8131': {'description': 'Palliative treatment for dental pain', 'price': 208.20},
    '8132': {'description': 'Gross pulpal debridement', 'price': 339.60},
    '8133': {'description': 'Re-cementing of inlays, crowns or bridges', 'price': 208.20},
    '8135': {'description': 'Removal of inlays and crowns', 'price': 412.30},
    '8136': {'description': 'Access through prosthetic crown', 'price': 188.00},
    '8137': {'description': 'Temporary crown emergency procedure', 'price': 711.50},
    '8140': {'description': 'Fee for treatment at venue other than surgery', 'price': 337.50},
    '8141': {'description': 'Inhalation sedation - first quarter-hour', 'price': 155.60},
    '8143': {'description': 'Inhalation sedation - additional quarter-hour', 'price': 76.80},
    '8144': {'description': 'Intravenous sedation', 'price': 93.00},
    '8145': {'description': 'Local anaesthetic, per visit', 'price': 40.40},
    '8147': {'description': 'Use of monitoring equipment for IV sedation', 'price': 329.50},
    '8151': {'description': 'Oral hygiene instructions', 'price': 208.20},
    '8153': {'description': 'Follow-up for oral hygiene re-evaluation', 'price': 155.60},
    '8155': {'description': 'Polishing only - complete dentition', 'price': 208.20},
    '8157': {'description': 'Re-burnishing and polishing of restorations', 'price': 208.20},
    '8159': {'description': 'Scaling and polishing', 'price': 410.30},
    '8161': {'description': 'Topical application of fluoride', 'price': 208.20},
    '8163': {'description': 'Fissure sealant, per tooth', 'price': 135.40},
    '8167': {'description': 'Treatment of hypersensitive dentine, per visit', 'price': 159.70},
    '8169': {'description': 'Bite plate for TMJ dysfunction', 'price': 802.40},
    '8170': {'description': 'Minor occlusal adjustment', 'price': 456.80},
    '8173': {'description': 'Space maintainer - fixed, per abutment', 'price': 390.10},
    '8175': {'description': 'Space maintainer - removable', 'price': 493.20},
    '8176': {'description': 'Periodontal screening', 'price': 176.00},
    '8177': {'description': 'Oral hygiene instruction for periodontally compromised', 'price': 315.30},
    '8178': {'description': 'Oral hygiene evaluation for periodontally compromised', 'price': 169.80},
    '8179': {'description': 'Plaque removal for periodontally compromised', 'price': 236.50},
    '8180': {'description': 'Scaling and polishing for periodontally compromised', 'price': 444.70},
    '8182': {'description': 'Root planing with/without curettage, per quadrant', 'price': 832.80},
    '8183': {'description': 'Intra-muscular or sub-cutaneous injection', 'price': 93.00},
    '8184': {'description': 'Root planing with/without curettage, per sextant', 'price': 660.90},
    '8185': {'description': 'Gingivectomy-gingivoplasty, per quadrant', 'price': 1087.40},
    '8186': {'description': 'Gingivectomy-gingivoplasty, per sextant', 'price': 865.10},
    '8188': {'description': 'Biopsy - intra-oral', 'price': 529.60},
    '8192': {'description': 'Appositioning of soft tissue injuries', 'price': 1024.80},
    '8193': {'description': 'Osseo-integrated abutment restoration', 'price': 3082.40},
    '8194': {'description': 'Placement of single osseo-integrated implant', 'price': 1932.30},
    '8195': {'description': 'Placement of second osseo-integrated implant', 'price': 1445.20},
    '8196': {'description': 'Placement of third osseo-integrated implant', 'price': 962.10},
    '8198': {'description': 'Exposure of single osseo-integrated implant', 'price': 715.50},
    '8199': {'description': 'Exposure of second osseo-integrated implant', 'price': 537.60},
    '8200': {'description': 'Exposure of third osseo-integrated implant', 'price': 359.80},
    '8201': {'description': 'Single tooth extraction', 'price': 208.20},
    '8202': {'description': 'Each additional tooth extraction same quadrant', 'price': 82.90},
    '8209': {'description': 'Surgical removal of erupted tooth', 'price': 895.40},
    '8210': {'description': 'Removal of unerupted/impacted tooth - first', 'price': 1489.70},
    '8211': {'description': 'Removal of unerupted/impacted tooth - second', 'price': 802.40},
    '8212': {'description': 'Removal of unerupted/impacted tooth - additional', 'price': 452.80},
    '8213': {'description': 'Surgical removal of residual roots', 'price': 895.40},
    '8214': {'description': 'Surgical removal of residual roots - subsequent', 'price': 695.30},
    '8215': {'description': 'Surgical exposure of impacted teeth for orthodontics', 'price': 1661.50},
    '8221': {'description': 'Local treatment of post-extraction haemorrhage', 'price': 155.60},
    '8223': {'description': 'Post-extraction haemorrhage - additional visit', 'price': 103.10},
    '8225': {'description': 'Treatment of septic socket - initial', 'price': 155.60},
    '8227': {'description': 'Treatment of septic socket - additional', 'price': 103.10},
    '8229': {'description': 'Apicoectomy including retrograde filling', 'price': 1024.80},
    '8231': {'description': 'Full upper and lower dentures', 'price': 3355.30},
    '8232': {'description': 'Full upper or lower denture', 'price': 2067.70},
    '8233': {'description': 'Partial denture, one tooth', 'price': 960.10},
    '8234': {'description': 'Partial denture, two teeth', 'price': 960.10},
    '8235': {'description': 'Partial denture, three teeth', 'price': 1443.20},
    '8236': {'description': 'Partial denture, four teeth', 'price': 1443.20},
    '8237': {'description': 'Partial denture, five teeth', 'price': 1443.20},
    '8238': {'description': 'Partial denture, six teeth', 'price': 1910.10},
    '8239': {'description': 'Partial denture, seven teeth', 'price': 1910.10},
    '8240': {'description': 'Partial denture, eight teeth', 'price': 1910.10},
    '8241': {'description': 'Partial denture, nine or more teeth', 'price': 1910.10},
    '8251': {'description': 'Cast gold clasp or rest', 'price': 192.00},
    '8253': {'description': 'Wrought gold clasp or rest', 'price': 192.00},
    '8255': {'description': 'Stainless steel clasp or rest', 'price': 200.10},
    '8257': {'description': 'Lingual bar or palatal bar', 'price': 234.50},
    '8259': {'description': 'Re-base of denture', 'price': 784.20},
    '8261': {'description': 'Re-model of denture', 'price': 1255.20},
    '8263': {'description': 'Reline of denture in selfcuring acrylic', 'price': 493.20},
    '8265': {'description': 'Tissue conditioner and soft reline', 'price': 329.50},
    '8267': {'description': 'Soft base re-line per denture', 'price': 1142.00},
    '8269': {'description': 'Repair of denture', 'price': 266.80},
    '8270': {'description': 'Add clasp to existing partial denture', 'price': 192.00},
    '8271': {'description': 'Add tooth to existing partial denture', 'price': 192.00},
    '8273': {'description': 'Additional fee where impression required', 'price': 155.60},
    '8275': {'description': 'Adjustment of denture', 'price': 155.60},
    '8281': {'description': 'Metal base to partial denture', 'price': 2241.60},
    '8303': {'description': 'Indirect pulp capping', 'price': 278.90},
    '8304': {'description': 'Rubber dam, per arch', 'price': 161.70},
    '8305': {'description': 'Apexification of root canal, per visit', 'price': 278.90},
    '8307': {'description': 'Amputation of pulp (pulpotomy)', 'price': 274.90},
    '8325': {'description': 'Bleaching of non-vital teeth, per tooth', 'price': 491.20},
    '8327': {'description': 'Additional visit for bleaching non-vital tooth', 'price': 234.50},
    '8328': {'description': 'Each additional canal - anteriors and premolars', 'price': 390.10},
    '8329': {'description': 'Each additional canal - anteriors and premolars', 'price': 479.00},
    '8330': {'description': 'Removal of fractured post or instrument', 'price': 274.90},
    '8332': {'description': 'Single-canal tooth, per visit', 'price': 208.20},
    '8333': {'description': 'Multi-canal tooth, per visit', 'price': 289.00},
    '8334': {'description': 'Re-preparation of previously obturated canal', 'price': 309.30},
    '8335': {'description': 'First canal - anteriors and premolars', 'price': 939.90},
    '8336': {'description': 'First canal - molars', 'price': 1297.60},
    '8337': {'description': 'Each additional canal - molars', 'price': 390.10},
    '8338': {'description': 'First canal - anteriors and premolars', 'price': 1445.20},
    '8339': {'description': 'First canal - molars', 'price': 1986.90},
    '8340': {'description': 'Each additional canal - molars', 'price': 479.00},
    '8341': {'description': 'Amalgam - one surface', 'price': 373.90},
    '8342': {'description': 'Amalgam - two surfaces', 'price': 468.90},
    '8343': {'description': 'Amalgam - three surfaces', 'price': 563.90},
    '8344': {'description': 'Amalgam - four or more surfaces', 'price': 632.60},
    '8345': {'description': 'Preformed post retention, per post', 'price': 410.30},
    '8346': {'description': 'RESTORATIVE MATERIAL', 'price': 'TOOTH-SPECIFIC'},
    '8347': {'description': 'Pin retention for restoration, first pin', 'price': 202.10},
    '8348': {'description': 'Pin retention, each additional pin', 'price': 192.00},
    '8349': {'description': 'Carving plastic restoration for prosthesis', 'price': 82.90},
    '8351': {'description': 'Resin - one surface, anterior', 'price': 412.30},
    '8352': {'description': 'Resin - two surfaces, anterior', 'price': 523.50},
    '8353': {'description': 'Resin - three surfaces, anterior', 'price': 620.50},
    '8354': {'description': 'Resin - four or more surfaces, anterior', 'price': 695.30},
    '8355': {'description': 'Composite veneers (Direct)', 'price': 723.60},
    '8356': {'description': 'Bridge per abutment - Maryland type', 'price': 925.80},
    '8357': {'description': 'Preformed metal crown', 'price': 422.40},
    '8361': {'description': 'Inlay, metallic - one surface', 'price': 636.70},
    '8362': {'description': 'Inlay, metallic - two surfaces', 'price': 925.70},
    '8363': {'description': 'Inlay, metallic - three surfaces', 'price': 1538.20},
    '8364': {'description': 'Inlay, metallic - four or more surfaces', 'price': 1863.60},
    '8366': {'description': 'Pin retention as part of cast restoration', 'price': 309.20},
    '8367': {'description': 'Resin - one surface, posterior', 'price': 448.70},
    '8368': {'description': 'Resin - two surfaces, posterior', 'price': 551.80},
    '8369': {'description': 'Resin - three surfaces, posterior', 'price': 663.00},
    '8370': {'description': 'Resin - four or more surfaces, posterior', 'price': 723.60},
    '8371': {'description': 'Inlay, ceramic/resin - one surface', 'price': 760.00},
    '8372': {'description': 'Inlay, ceramic/resin - two surfaces', 'price': 1125.80},
    '8373': {'description': 'Inlay, ceramic/resin - three surfaces', 'price': 1851.40},
    '8374': {'description': 'Inlay, ceramic/resin - four or more surfaces', 'price': 2241.60},
    '8376': {'description': 'Prefabricated post and core', 'price': 1129.90},
    '8391': {'description': 'Cast post and core - single', 'price': 477.00},
    '8393': {'description': 'Cast post and core - double', 'price': 760.00},
    '8395': {'description': 'Cast post and core - triple', 'price': 1101.60},
    '8396': {'description': 'Cast coping', 'price': 311.30},
    '8397': {'description': 'Cast core with pins', 'price': 760.00},
    '8398': {'description': 'Core build-up, including any pins', 'price': 925.70},
    '8401': {'description': 'Cast full crown', 'price': 2379.00},
    '8403': {'description': 'Cast three-quarter crown', 'price': 2379.00},
    '8407': {'description': 'Acrylic veneered crown', 'price': 2379.00},
    '8409': {'description': 'Porcelain jacket crown', 'price': 2379.00},
    '8411': {'description': 'Porcelain veneered crown', 'price': 2379.00},
    '8413': {'description': 'Facing replacement', 'price': 464.90},
    '8414': {'description': 'Additional fee for crown within clasp', 'price': 135.40},
    '8420': {'description': 'Sanitary pontic', 'price': 1156.20},
    '8422': {'description': 'Posterior pontic', 'price': 1538.20},
    '8424': {'description': 'Anterior pontic', 'price': 1940.40},
    '8570': {'description': 'Computer generated ceramic restoration', 'price': 2374.90},
    '8811': {'description': 'Tracing and analysis of extra-oral film', 'price': 62.60},
    '8812': {'description': 'CBCT capture limited field - less than one jaw', 'price': 1155.50},
    '8813': {'description': 'CBCT capture one full arch - mandible', 'price': 1290.70},
    '8814': {'description': 'CBCT capture one full arch - maxilla', 'price': 1290.70},
    '8815': {'description': 'CBCT capture both arches without orbits', 'price': 1352.10},
    '8816': {'description': 'CBCT capture for TMJ series', 'price': 1352.10},
    '8817': {'description': 'CBCT capture maxilla with orbits', 'price': 1475.10},
    '8818': {'description': 'CBCT capture both arches with orbits', 'price': 1647.20},
    '8819': {'description': 'Interpretation of diagnostic image', 'price': 491.60},
    '8820': {'description': 'CBCT image capture limited - less than one jaw', 'price': 693.20},
    '8821': {'description': 'CBCT image capture one arch - mandible', 'price': 774.40},
    '8822': {'description': 'CBCT image capture one arch - maxilla', 'price': 774.40},
    '8823': {'description': 'CBCT capture both arches without orbits', 'price': 811.30},
    '8824': {'description': 'CBCT capture for TMJ series', 'price': 811.30},
    '8825': {'description': 'CBCT capture maxilla with orbits', 'price': 885.00},
    '8826': {'description': 'CBCT capture both arches with orbits', 'price': 988.30}
}

def analyze_all_claims():
    """Comprehensive analysis of all claims data"""
    
    directory = "/mnt/c/Users/Happyou2/Documents/emminance/History"
    
    # Data structures to track patterns
    code_data = defaultdict(lambda: {
        'found_in_claims': False,
        'prices_seen': [],
        'has_tooth_info': False,
        'tooth_numbers': set(),
        'quantities': [],
        'price_patterns': [],
        'diagnoses': set()
    })
    
    # Process all .DAT files
    for filename in os.listdir(directory):
        if filename.upper().endswith('.DAT'):
            filepath = os.path.join(directory, filename)
            
            try:
                with open(filepath, 'r', encoding='latin-1') as file:
                    for line in file:
                        if line.strip() and not line.startswith('1,'):
                            fields = line.strip().split(',')
                            
                            if len(fields) >= 18:
                                code = fields[12].strip()
                                price = fields[13].strip()
                                diagnosis = fields[14].strip() if len(fields) > 14 else ""
                                quantity = fields[17].strip() if len(fields) > 17 else "1.00"
                                
                                if code and price:
                                    try:
                                        price_float = float(price)
                                        quantity_float = float(quantity)
                                        
                                        code_data[code]['found_in_claims'] = True
                                        code_data[code]['prices_seen'].append(price_float)
                                        code_data[code]['quantities'].append(quantity_float)
                                        code_data[code]['diagnoses'].add(diagnosis)
                                        
                                        # Check for tooth information
                                        tooth_match = re.search(r'TOOTH:\s*(\d+)', diagnosis)
                                        if tooth_match:
                                            code_data[code]['has_tooth_info'] = True
                                            code_data[code]['tooth_numbers'].add(tooth_match.group(1))
                                        
                                        # Also check field 35 for tooth info
                                        if len(fields) > 35 and fields[35].strip():
                                            code_data[code]['has_tooth_info'] = True
                                            code_data[code]['tooth_numbers'].add(fields[35].strip())
                                    
                                    except ValueError:
                                        continue
                            
            except Exception as e:
                continue
    
    # Analyze patterns for multiplication
    for code, data in code_data.items():
        if data['prices_seen']:
            unique_prices = sorted(set(data['prices_seen']))
            
            # Find multiplication patterns
            if len(unique_prices) > 1:
                base_price = min(unique_prices)
                multipliers = []
                
                for price in unique_prices:
                    if base_price > 0:
                        ratio = price / base_price
                        if abs(ratio - round(ratio)) < 0.1 and round(ratio) > 1:
                            multipliers.append(round(ratio))
                
                if multipliers:
                    data['price_patterns'] = {
                        'type': 'multiplication',
                        'base_price': base_price,
                        'multipliers': sorted(set(multipliers))
                    }
    
    return code_data

# Main analysis
print("Analyzing all claims data...")
claims_data = analyze_all_claims()

# Create comprehensive CSV
output_file = '/mnt/c/Users/Happyou2/Documents/emminance/COMPREHENSIVE_DENTAL_CODES_ANALYSIS.csv'

with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
    writer = csv.writer(csvfile)
    
    # Write header
    writer.writerow([
        'Code',
        'Description',
        'Official 2025 Price (NAD)',
        'Found in Claims',
        'On 2025 List',
        'Requires Tooth Number',
        'Multiplication Pattern',
        'Pricing Rule',
        'Price Variations Seen',
        'Common Diagnoses'
    ])
    
    # Process all codes (both official and from claims)
    all_codes = set(official_2025_codes.keys()) | set(claims_data.keys())
    
    for code in sorted(all_codes):
        # Get official data
        official = official_2025_codes.get(code, {})
        official_price = official.get('price', 'Not on 2025 list')
        description = official.get('description', 'Not on 2025 list')
        on_2025_list = 'Yes' if code in official_2025_codes else 'No'
        
        # Get claims data
        claims = claims_data.get(code, {})
        found_in_claims = 'Yes' if claims.get('found_in_claims', False) else 'No'
        requires_tooth = 'Yes' if claims.get('has_tooth_info', False) else 'No'
        
        # Determine multiplication pattern
        multiplication_pattern = 'No'
        pricing_rule = 'Fixed price'
        
        if code == '8346':
            multiplication_pattern = 'Tooth-specific'
            pricing_rule = 'Price varies by tooth location (35.32-215.19 NAD)'
        elif claims.get('price_patterns'):
            pattern = claims['price_patterns']
            if pattern['type'] == 'multiplication':
                multiplication_pattern = f"Yes (x{', x'.join(map(str, pattern['multipliers']))})"
                pricing_rule = f"Base {pattern['base_price']:.2f} × quantity"
        
        # Special rules based on description
        if 'per visit' in description.lower():
            pricing_rule = 'Charged once per visit'
        elif 'per film' in description.lower() or 'per photograph' in description.lower():
            multiplication_pattern = 'Yes'
            pricing_rule = f'{official_price} × number of films/photos' if official_price != 'Not on 2025 list' else 'Multiply by quantity'
        elif 'per tooth' in description.lower():
            multiplication_pattern = 'Yes'
            pricing_rule = f'{official_price} × number of teeth' if official_price != 'Not on 2025 list' else 'Multiply by number of teeth'
        elif 'each additional' in description.lower():
            multiplication_pattern = 'Progressive'
            pricing_rule = 'First item at base price, additional items at reduced price'
        elif 'per quadrant' in description.lower() or 'per sextant' in description.lower():
            multiplication_pattern = 'Yes'
            pricing_rule = f'{official_price} × number of quadrants/sextants' if official_price != 'Not on 2025 list' else 'Multiply by area count'
        elif 'per arch' in description.lower():
            multiplication_pattern = 'Yes'
            pricing_rule = f'{official_price} × number of arches (max 2)' if official_price != 'Not on 2025 list' else 'Multiply by arch count'
        
        # Price variations
        price_variations = ''
        if claims.get('prices_seen'):
            unique_prices = sorted(set(claims['prices_seen']))[:5]
            price_variations = ', '.join([f'{p:.2f}' for p in unique_prices])
        
        # Common diagnoses
        diagnoses = ''
        if claims.get('diagnoses'):
            diagnoses_list = list(claims['diagnoses'])[:3]
            diagnoses = '; '.join([d[:50] for d in diagnoses_list if d])
        
        writer.writerow([
            code,
            description[:80],  # Truncate long descriptions
            official_price if isinstance(official_price, str) else f'{official_price:.2f}',
            found_in_claims,
            on_2025_list,
            requires_tooth,
            multiplication_pattern,
            pricing_rule,
            price_variations,
            diagnoses[:100]  # Truncate diagnoses
        ])

print(f"Analysis complete! File saved to: {output_file}")

# Create a summary of key findings
summary_file = '/mnt/c/Users/Happyou2/Documents/emminance/DENTAL_CODES_SUMMARY.txt'
with open(summary_file, 'w') as f:
    f.write("=== DENTAL CODES ANALYSIS SUMMARY ===\n\n")
    
    # Count statistics
    total_official = len(official_2025_codes)
    total_in_claims = sum(1 for c in claims_data.values() if c['found_in_claims'])
    codes_not_in_2025 = [code for code in claims_data.keys() if code not in official_2025_codes and claims_data[code]['found_in_claims']]
    
    f.write(f"Total codes in 2025 official list: {total_official}\n")
    f.write(f"Total codes found in claims: {total_in_claims}\n")
    f.write(f"Codes in claims but NOT in 2025 list: {len(codes_not_in_2025)}\n\n")
    
    if codes_not_in_2025:
        f.write("Codes found in claims but NOT on 2025 list:\n")
        for code in sorted(codes_not_in_2025)[:20]:
            prices = claims_data[code]['prices_seen']
            if prices:
                avg_price = sum(prices) / len(prices)
                f.write(f"  {code}: Average price {avg_price:.2f} NAD\n")
    
    f.write("\n=== MULTIPLICATION PATTERNS IDENTIFIED ===\n")
    
    # Find all codes with multiplication patterns
    multiplication_codes = []
    for code, data in claims_data.items():
        if data.get('price_patterns') and data['price_patterns']['type'] == 'multiplication':
            multiplication_codes.append((code, data['price_patterns']))
    
    for code, pattern in sorted(multiplication_codes)[:20]:
        desc = official_2025_codes.get(code, {}).get('description', 'Unknown')
        f.write(f"\nCode {code} ({desc[:50]}):\n")
        f.write(f"  Base price: {pattern['base_price']:.2f}\n")
        f.write(f"  Multipliers seen: x{', x'.join(map(str, pattern['multipliers']))}\n")

print(f"Summary saved to: {summary_file}")