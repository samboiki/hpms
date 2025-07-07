#!/usr/bin/env python3
import csv
import os
import re
from collections import defaultdict, Counter
import json

def analyze_code_8346_patterns():
    """Analyze code 8346 patterns in .DAT files to understand pricing"""
    
    directory = "/mnt/c/Users/Happyou2/Documents/emminance/History"
    code_8346_records = []
    
    # Process all .DAT files
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
                                diagnosis = fields[14].strip() if len(fields) > 14 else ""
                                
                                # Look for code 8346
                                if code == '8346':
                                    # Try to extract tooth information
                                    tooth_info = ""
                                    if len(fields) > 35:
                                        tooth_info = fields[35].strip()
                                    
                                    code_8346_records.append({
                                        'file': filename,
                                        'price': price,
                                        'diagnosis': diagnosis,
                                        'tooth': tooth_info,
                                        'full_line': line.strip()
                                    })
                            
            except Exception as e:
                print(f"Error processing {filename}: {e}")
    
    return code_8346_records

def analyze_pricing_patterns():
    """Analyze pricing patterns from code_price_frequency.csv"""
    
    frequency_file = "/mnt/c/Users/Happyou2/Documents/emminance/History/code_price_frequency.csv"
    pricing_patterns = defaultdict(list)
    
    with open(frequency_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = row['code']
            price = row['price']
            frequency = row['frequency'].replace(' times', '')
            
            pricing_patterns[code].append({
                'price': float(price),
                'frequency': int(frequency)
            })
    
    return pricing_patterns

def find_multiplication_patterns():
    """Find patterns where prices seem to be multiplied"""
    
    pricing_patterns = analyze_pricing_patterns()
    multiplication_codes = {}
    
    for code, prices in pricing_patterns.items():
        if len(prices) > 1:
            # Sort by price
            sorted_prices = sorted([p['price'] for p in prices])
            
            # Check for multiplication patterns
            base_price = sorted_prices[0]
            multipliers = []
            
            for price in sorted_prices[1:]:
                if base_price > 0:
                    multiplier = price / base_price
                    # Check if it's close to a whole number
                    if abs(multiplier - round(multiplier)) < 0.1:
                        multipliers.append((price, round(multiplier)))
            
            if multipliers:
                multiplication_codes[code] = {
                    'base_price': base_price,
                    'variations': sorted_prices,
                    'possible_multipliers': multipliers
                }
    
    return multiplication_codes

# Main analysis
print("=== ANALYZING DENTAL PRICING PATTERNS ===\n")

print("1. Analyzing Code 8346 Patterns...")
code_8346_records = analyze_code_8346_patterns()

# Group by price
price_groups = defaultdict(list)
for record in code_8346_records:
    price_groups[record['price']].append(record)

print(f"\nFound {len(code_8346_records)} instances of code 8346")
print(f"Unique prices: {len(price_groups)}")

# Show sample records for each unique price
print("\nSample records for each price point:")
for price, records in sorted(price_groups.items(), key=lambda x: float(x[0]) if x[0].replace('.','').isdigit() else 0)[:10]:
    print(f"\nPrice: {price} (occurs {len(records)} times)")
    if records:
        print(f"  Diagnosis: {records[0]['diagnosis']}")
        if len(records) > 1:
            print(f"  Example files: {', '.join(set([r['file'] for r in records[:3]]))}")

print("\n2. Analyzing Multiplication Patterns...")
multiplication_codes = find_multiplication_patterns()

print(f"\nFound {len(multiplication_codes)} codes with potential multiplication patterns:")
for code, info in sorted(multiplication_codes.items())[:20]:
    print(f"\nCode {code}:")
    print(f"  Base price: {info['base_price']}")
    print(f"  Price variations: {info['variations'][:5]}")
    if info['possible_multipliers']:
        print(f"  Possible multipliers: {[f'{p[0]} (x{p[1]})' for p in info['possible_multipliers'][:3]]}")

# Save detailed analysis
output_file = "/mnt/c/Users/Happyou2/Documents/emminance/dental_pricing_analysis.json"
analysis_data = {
    'code_8346_analysis': {
        'total_instances': len(code_8346_records),
        'unique_prices': len(price_groups),
        'price_distribution': {price: len(records) for price, records in price_groups.items()}
    },
    'multiplication_patterns': multiplication_codes
}

with open(output_file, 'w') as f:
    json.dump(analysis_data, f, indent=2)

print(f"\nDetailed analysis saved to: {output_file}")