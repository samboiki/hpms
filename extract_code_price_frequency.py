#!/usr/bin/env python3
import os
import csv
from collections import defaultdict

def extract_code_price_frequency(directory_path):
    """Extract code-price combinations and their frequency from .DAT files"""
    
    # Dictionary to count occurrences of each (code, price) combination
    frequency_counter = defaultdict(int)
    
    # Process all .DAT files in the directory
    for filename in os.listdir(directory_path):
        if filename.upper().endswith('.DAT'):
            filepath = os.path.join(directory_path, filename)
            print(f"Processing: {filename}")
            
            try:
                with open(filepath, 'r', encoding='latin-1') as file:
                    for line in file:
                        # Skip header lines (first line) and empty lines
                        if line.strip() and not line.startswith('1,'):
                            fields = line.strip().split(',')
                            
                            # Ensure we have enough fields
                            if len(fields) >= 14:
                                # Extract required fields (using 0-based indexing)
                                code = fields[12].strip() if len(fields) > 12 else ""
                                price = fields[13].strip() if len(fields) > 13 else ""
                                
                                # Count this combination if both code and price exist
                                if code and price:
                                    frequency_counter[(code, price)] += 1
                            
            except Exception as e:
                print(f"Error processing {filename}: {e}")
    
    # Write to CSV
    output_file = os.path.join(directory_path, 'code_price_frequency.csv')
    
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        # Write header
        csvfile.write('code,price,frequency\n')
        
        # Sort by code and then by price
        sorted_items = sorted(frequency_counter.items(), 
                            key=lambda x: (x[0][0], float(x[0][1]) if x[0][1].replace('.','').isdigit() else 0))
        
        # Write each row
        for (code, price), count in sorted_items:
            csvfile.write(f'{code},{price},{count} times\n')
    
    print(f"\nExtraction complete!")
    print(f"Total unique code-price combinations: {len(frequency_counter)}")
    print(f"Output saved to: {output_file}")
    
    return output_file

if __name__ == "__main__":
    # Directory path
    dat_directory = "/mnt/c/Users/Happyou2/Documents/emminance/History"
    
    # Extract data
    output_file = extract_code_price_frequency(dat_directory)
    
    # Show first few lines of the output
    print("\nFirst 20 lines of output:")
    with open(output_file, 'r') as f:
        for i, line in enumerate(f):
            if i < 20:
                print(line.strip())
            else:
                break