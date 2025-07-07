#!/usr/bin/env python3
import os
import csv
from collections import defaultdict

def extract_dat_data(directory_path):
    """Extract data from .DAT files and create CSV with distinct price-code combinations"""
    
    # Dictionary to store unique combinations of (code, price) as keys
    unique_records = {}
    
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
                            if len(fields) >= 15:
                                # Extract required fields (using 0-based indexing)
                                patid = fields[3].strip() if len(fields) > 3 else ""
                                medical_aid = fields[5].strip() if len(fields) > 5 else ""
                                code = fields[12].strip() if len(fields) > 12 else ""
                                price = fields[13].strip() if len(fields) > 13 else ""
                                diagnosis = fields[14].strip() if len(fields) > 14 else ""
                                
                                # Create unique key based on code and price
                                key = (code, price)
                                
                                # Store the record if this combination is new
                                if key not in unique_records and code and price:
                                    unique_records[key] = {
                                        'filename': filename,
                                        'patid': patid,
                                        'medical_aid': medical_aid,
                                        'code': code,
                                        'price': price,
                                        'diagnosis': diagnosis
                                    }
                            
            except Exception as e:
                print(f"Error processing {filename}: {e}")
    
    # Write to CSV
    output_file = os.path.join(os.path.dirname(directory_path), 'extracted_distinct_data.csv')
    
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['filename', 'patid', 'medical_aid', 'code', 'price', 'diagnosis']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        # Write header
        writer.writeheader()
        
        # Write all unique records sorted by code and price
        sorted_records = sorted(unique_records.values(), key=lambda x: (x['code'], float(x['price']) if x['price'].replace('.','').isdigit() else 0))
        for record in sorted_records:
            writer.writerow(record)
    
    print(f"\nExtraction complete!")
    print(f"Total unique code-price combinations: {len(unique_records)}")
    print(f"Output saved to: {output_file}")
    
    return output_file

if __name__ == "__main__":
    # Directory path
    dat_directory = "/mnt/c/Users/Happyou2/Documents/emminance/History"
    
    # Extract data
    output_file = extract_dat_data(dat_directory)
    
    # Show first few lines of the output
    print("\nFirst 10 lines of output:")
    with open(output_file, 'r') as f:
        for i, line in enumerate(f):
            if i < 10:
                print(line.strip())
            else:
                break