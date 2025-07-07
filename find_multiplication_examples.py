#!/usr/bin/env python3
import os
import csv
from collections import defaultdict

def find_multiplication_examples():
    """Find specific examples of multiplication patterns in claims"""
    
    directory = "/mnt/c/Users/Happyou2/Documents/emminance/History"
    
    # Track patterns for specific codes
    code_examples = {
        '8145': {
            'base_price': 23.50,
            'name': 'Local anaesthetic',
            'examples': []
        },
        '8107': {
            'base_price': 78.90,
            'name': 'Intra-oral radiographs',
            'examples': []
        },
        '8109': {
            'base_price': 20.00,
            'name': 'Infection control',
            'examples': []
        }
    }
    
    # Process files to find examples
    for filename in os.listdir(directory):
        if filename.upper().endswith('.DAT'):
            filepath = os.path.join(directory, filename)
            
            try:
                with open(filepath, 'r', encoding='latin-1') as file:
                    current_patient = None
                    patient_procedures = defaultdict(list)
                    
                    for line in file:
                        if line.strip() and not line.startswith('1,'):
                            fields = line.strip().split(',')
                            
                            if len(fields) >= 18:
                                patient_id = fields[3].strip() if len(fields) > 3 else ""
                                code = fields[12].strip()
                                price = fields[13].strip()
                                diagnosis = fields[14].strip() if len(fields) > 14 else ""
                                date = fields[16].strip() if len(fields) > 16 else ""
                                quantity = fields[17].strip() if len(fields) > 17 else "1.00"
                                
                                # Track procedures by patient and date
                                if patient_id and code in code_examples:
                                    try:
                                        price_float = float(price)
                                        quantity_float = float(quantity)
                                        base = code_examples[code]['base_price']
                                        
                                        # Calculate multiplier
                                        if base > 0:
                                            multiplier = price_float / base
                                            
                                            # Check if it's a clean multiplication
                                            if abs(multiplier - round(multiplier)) < 0.1 and round(multiplier) > 1:
                                                code_examples[code]['examples'].append({
                                                    'patient': patient_id,
                                                    'date': date,
                                                    'price': price_float,
                                                    'multiplier': round(multiplier),
                                                    'quantity': quantity_float,
                                                    'diagnosis': diagnosis,
                                                    'file': filename
                                                })
                                    
                                    except ValueError:
                                        continue
                            
            except Exception as e:
                continue
    
    # Print findings
    print("=== MULTIPLICATION PATTERN EXAMPLES ===\n")
    
    for code, data in code_examples.items():
        if data['examples']:
            print(f"\nCode {code} - {data['name']} (Base price: {data['base_price']} NAD)")
            print("=" * 60)
            
            # Group by multiplier
            by_multiplier = defaultdict(list)
            for ex in data['examples']:
                by_multiplier[ex['multiplier']].append(ex)
            
            for mult in sorted(by_multiplier.keys()):
                examples = by_multiplier[mult][:3]  # Show up to 3 examples
                print(f"\n{mult}x multiplication ({data['base_price']} × {mult} = {data['base_price'] * mult:.2f} NAD):")
                for ex in examples:
                    print(f"  Patient {ex['patient']} on {ex['date']}: {ex['price']:.2f} NAD")
                    print(f"    File: {ex['file']}")
                print(f"  Total instances: {len(by_multiplier[mult])}")

# Run analysis
find_multiplication_examples()

# Also create a detailed report for code 8145
print("\n\n=== DETAILED ANALYSIS: CODE 8145 (LOCAL ANAESTHETIC) ===")
print("\nPrice breakdown based on injections:")
print("1 injection: 23.50 NAD (base price)")
print("2 injections: 47.00 NAD (23.50 × 2)")
print("3 injections: 70.50 NAD (23.50 × 3)")
print("4 injections: 94.00 NAD (23.50 × 4)")
print("5 injections: 117.50 NAD (23.50 × 5)")
print("6 injections: 141.00 NAD (23.50 × 6)")

print("\nNote: Some variations (38.50, 40.40) likely represent different medical aid rates")