#!/usr/bin/env python3
import csv
import os
import re
from collections import defaultdict, Counter
import json

def analyze_tooth_specific_pricing():
    """Analyze tooth-specific pricing patterns, especially for code 8346"""
    
    directory = "/mnt/c/Users/Happyou2/Documents/emminance/History"
    tooth_pricing = defaultdict(lambda: defaultdict(list))
    
    # Process all .DAT files
    for filename in os.listdir(directory):
        if filename.upper().endswith('.DAT'):
            filepath = os.path.join(directory, filename)
            
            try:
                with open(filepath, 'r', encoding='latin-1') as file:
                    for line in file:
                        if line.strip() and not line.startswith('1,'):
                            fields = line.strip().split(',')
                            
                            if len(fields) >= 36:
                                code = fields[12].strip()
                                price = fields[13].strip()
                                diagnosis = fields[14].strip() if len(fields) > 14 else ""
                                tooth_field = fields[35].strip() if len(fields) > 35 else ""
                                
                                # Extract tooth number from diagnosis
                                tooth_match = re.search(r'TOOTH:\s*(\d+)', diagnosis)
                                if tooth_match:
                                    tooth_num = tooth_match.group(1)
                                    if price and price != '0.00':
                                        tooth_pricing[code][tooth_num].append(float(price))
                            
            except Exception as e:
                continue
    
    return tooth_pricing

def analyze_per_visit_patterns():
    """Analyze codes that are charged per visit (like 8145)"""
    
    directory = "/mnt/c/Users/Happyou2/Documents/emminance/History"
    per_visit_codes = {}
    
    # Known per-visit codes from descriptions
    per_visit_keywords = ['PER VISIT', 'PER DENTIST', 'PER PATIENT']
    
    for filename in os.listdir(directory):
        if filename.upper().endswith('.DAT'):
            filepath = os.path.join(directory, filename)
            
            try:
                with open(filepath, 'r', encoding='latin-1') as file:
                    for line in file:
                        if line.strip() and not line.startswith('1,'):
                            fields = line.strip().split(',')
                            
                            if len(fields) >= 15:
                                code = fields[12].strip()
                                price = fields[13].strip()
                                diagnosis = fields[14].strip()
                                quantity = fields[17].strip() if len(fields) > 17 else "1.00"
                                
                                # Check if this is a per-visit code
                                for keyword in per_visit_keywords:
                                    if keyword in diagnosis.upper():
                                        if code not in per_visit_codes:
                                            per_visit_codes[code] = {
                                                'description': diagnosis,
                                                'prices': [],
                                                'quantities': []
                                            }
                                        per_visit_codes[code]['prices'].append(float(price))
                                        per_visit_codes[code]['quantities'].append(float(quantity))
                                        break
                            
            except Exception as e:
                continue
    
    return per_visit_codes

def create_pricing_rules():
    """Create comprehensive pricing rules based on analysis"""
    
    tooth_pricing = analyze_tooth_specific_pricing()
    per_visit_codes = analyze_per_visit_patterns()
    
    # Analyze code 8346 specifically
    code_8346_analysis = {}
    if '8346' in tooth_pricing:
        tooth_prices = {}
        for tooth, prices in tooth_pricing['8346'].items():
            # Get most common price for each tooth
            if prices:
                avg_price = sum(prices) / len(prices)
                tooth_prices[tooth] = {
                    'average': round(avg_price, 2),
                    'min': min(prices),
                    'max': max(prices),
                    'count': len(prices)
                }
        code_8346_analysis = tooth_prices
    
    # Load frequency data
    frequency_data = {}
    with open("/mnt/c/Users/Happyou2/Documents/emminance/History/code_price_frequency.csv", 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row['code']
            if code not in frequency_data:
                frequency_data[code] = []
            frequency_data[code].append({
                'price': float(row['price']),
                'frequency': int(row['frequency'].replace(' times', ''))
            })
    
    # Create comprehensive rules
    pricing_rules = []
    
    # Add code 8346 rules
    pricing_rules.append({
        'code': '8346',
        'description': 'RESTORATIVE MATERIAL',
        'rule_type': 'tooth_specific',
        'base_price': 'Varies by tooth',
        'pricing_logic': 'Price depends on tooth location',
        'tooth_pricing': code_8346_analysis,
        'notes': 'Different teeth have different material costs'
    })
    
    # Add per-visit codes
    for code, info in per_visit_codes.items():
        if info['prices']:
            pricing_rules.append({
                'code': code,
                'description': info['description'],
                'rule_type': 'per_visit',
                'base_price': round(sum(info['prices']) / len(info['prices']), 2),
                'pricing_logic': 'Charged once per visit regardless of procedures',
                'notes': f'Average quantity: {sum(info["quantities"]) / len(info["quantities"]):.2f}'
            })
    
    # Add multiplication patterns
    for code, prices in frequency_data.items():
        if len(prices) > 1 and code not in ['8346']:  # Skip 8346 as it's tooth-specific
            sorted_prices = sorted([p['price'] for p in prices])
            base_price = sorted_prices[0]
            
            multipliers = []
            for price in sorted_prices[1:]:
                if base_price > 0:
                    multiplier = price / base_price
                    if abs(multiplier - round(multiplier)) < 0.1:
                        multipliers.append(round(multiplier))
            
            if multipliers and len(set(multipliers)) > 0:
                pricing_rules.append({
                    'code': code,
                    'description': f'Code {code}',
                    'rule_type': 'multiplication',
                    'base_price': base_price,
                    'pricing_logic': 'Price multiplied by number of units/teeth',
                    'common_multipliers': list(set(multipliers))[:5],
                    'price_variations': sorted_prices[:10]
                })
    
    return pricing_rules

# Main execution
print("=== COMPREHENSIVE DENTAL PRICING ANALYSIS ===\n")

pricing_rules = create_pricing_rules()

# Print summary
print(f"Total pricing rules identified: {len(pricing_rules)}\n")

# Group by rule type
rule_types = defaultdict(list)
for rule in pricing_rules:
    rule_types[rule['rule_type']].append(rule)

print("Rules by type:")
for rule_type, rules in rule_types.items():
    print(f"  {rule_type}: {len(rules)} rules")

print("\n=== CODE 8346 TOOTH-SPECIFIC PRICING ===")
for rule in pricing_rules:
    if rule['code'] == '8346':
        print(f"\nCode: {rule['code']} - {rule['description']}")
        print(f"Rule Type: {rule['rule_type']}")
        print(f"Pricing Logic: {rule['pricing_logic']}")
        
        if 'tooth_pricing' in rule and rule['tooth_pricing']:
            print("\nTooth-specific prices:")
            # Group teeth by price range
            price_groups = defaultdict(list)
            for tooth, data in rule['tooth_pricing'].items():
                price_groups[data['average']].append(tooth)
            
            for price, teeth in sorted(price_groups.items()):
                print(f"  Price {price}: Teeth {', '.join(sorted(teeth))}")

print("\n=== PER-VISIT CODES ===")
for rule in rule_types['per_visit'][:10]:
    print(f"\nCode: {rule['code']}")
    print(f"Description: {rule['description']}")
    print(f"Average Price: {rule['base_price']}")
    print(f"Notes: {rule['notes']}")

print("\n=== MULTIPLICATION-BASED CODES ===")
for rule in rule_types['multiplication'][:10]:
    print(f"\nCode: {rule['code']}")
    print(f"Base Price: {rule['base_price']}")
    print(f"Common Multipliers: {rule['common_multipliers']}")
    print(f"Price Variations: {rule['price_variations'][:5]}")

# Save comprehensive analysis
output_file = "/mnt/c/Users/Happyou2/Documents/emminance/comprehensive_pricing_rules.json"
with open(output_file, 'w') as f:
    json.dump(pricing_rules, f, indent=2)

print(f"\n\nComprehensive pricing rules saved to: {output_file}")

# Create CSV for easy viewing
csv_output = "/mnt/c/Users/Happyou2/Documents/emminance/pricing_rules_summary.csv"
with open(csv_output, 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['Code', 'Description', 'Rule Type', 'Base Price', 'Pricing Logic', 'Additional Notes'])
    
    for rule in pricing_rules:
        notes = rule.get('notes', '')
        if rule['rule_type'] == 'tooth_specific':
            notes = f"Tooth-specific pricing. {len(rule.get('tooth_pricing', {}))} different tooth prices"
        elif rule['rule_type'] == 'multiplication':
            notes = f"Multipliers: {rule.get('common_multipliers', [])}"
        
        writer.writerow([
            rule['code'],
            rule.get('description', ''),
            rule['rule_type'],
            rule.get('base_price', 'Varies'),
            rule.get('pricing_logic', ''),
            notes
        ])

print(f"Summary CSV saved to: {csv_output}")