#!/usr/bin/env python3
"""
Extract distinct rows from .DAT files based on price and code combination.
"""

import os
import csv
from pathlib import Path

def extract_dat_data(directory_path):
    """Extract data from all .DAT files in the specified directory."""
    
    # Dictionary to store unique combinations of (code, price)
    unique_records = {}
    
    # Get all .DAT files
    dat_files = list(Path(directory_path).glob("*.Dat"))
    print(f"Found {len(dat_files)} .DAT files")
    
    # Process each file
    for dat_file in dat_files:
        filename = dat_file.name
        print(f"Processing {filename}...")
        
        try:
            with open(dat_file, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
                
            for line in lines:
                # Skip header lines and empty lines
                if not line.strip() or not line.startswith('D,'):
                    continue
                
                # Split by comma
                fields = line.strip().split(',')
                
                # Check if we have enough fields
                if len(fields) < 15:
                    continue
                
                try:
                    # Extract required fields (using 0-based indexing)
                    pat_id = fields[3] if len(fields) > 3 else ''
                    medical_aid = fields[5] if len(fields) > 5 else ''
                    code = fields[12] if len(fields) > 12 else ''
                    price = fields[13] if len(fields) > 13 else ''
                    diagnosis = fields[14] if len(fields) > 14 else ''
                    
                    # Create unique key based on code and price
                    key = (code, price)
                    
                    # Store only if this combination hasn't been seen before
                    if key not in unique_records:
                        unique_records[key] = {
                            'Filename': filename,
                            'PatID': pat_id,
                            'Medical_Aid': medical_aid,
                            'Codes': code,
                            'Price': price,
                            'Diagnosis': diagnosis
                        }
                    
                except IndexError:
                    # Skip malformed lines
                    continue
                    
        except Exception as e:
            print(f"Error processing {filename}: {e}")
            continue
    
    return unique_records

def save_to_csv(unique_records, output_file):
    """Save the extracted data to CSV file."""
    
    # Define CSV headers
    headers = ['Filename', 'PatID', 'Medical_Aid', 'Codes', 'Price', 'Diagnosis']
    
    # Write to CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=headers)
        writer.writeheader()
        
        # Sort by code and price for better organization
        sorted_records = sorted(unique_records.values(), 
                              key=lambda x: (x['Codes'], float(x['Price']) if x['Price'] else 0))
        
        for record in sorted_records:
            writer.writerow(record)
    
    print(f"\nExtracted {len(unique_records)} unique code-price combinations")
    print(f"Data saved to: {output_file}")

def main():
    # Directory containing .DAT files
    directory = "/mnt/c/Users/Happyou2/Documents/emminance/History"
    
    # Output CSV file
    output_file = os.path.join(directory, "extracted_distinct_data.csv")
    
    # Extract data
    print("Starting data extraction...")
    unique_records = extract_dat_data(directory)
    
    # Save to CSV
    save_to_csv(unique_records, output_file)
    
    # Show sample of extracted data
    print("\nSample of extracted data:")
    sample_records = list(unique_records.values())[:5]
    for record in sample_records:
        print(f"{record['Filename']}, {record['PatID']}, {record['Medical_Aid']}, "
              f"{record['Codes']}, {record['Price']}, {record['Diagnosis']}")

if __name__ == "__main__":
    main()