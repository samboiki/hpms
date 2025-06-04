#!/usr/bin/env python3

import os
import csv
from collections import defaultdict

# Directory containing the data files
data_dir = "/mnt/c/Users/Happyou2/Documents/emminance/History"
output_file = os.path.join(data_dir, "extracted_data_summary.csv")

# Dictionary to store unique codes with their prices and diagnoses
code_data = {}
files_processed = 0
total_records = 0

# Process all .Dat files in the directory
for filename in os.listdir(data_dir):
    if filename.endswith('.Dat'):
        filepath = os.path.join(data_dir, filename)
        files_processed += 1
        
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    line = line.strip()
                    if line and line.startswith('D,'):  # Data lines start with 'D,'
                        parts = line.split(',')
                        if len(parts) > 15:  # Ensure we have enough fields
                            code = parts[13].strip()
                            price = parts[14].strip()
                            diagnosis = parts[15].strip()
                            
                            if code:  # Only process non-empty codes
                                total_records += 1
                                # Store the data, keeping the first occurrence of each code
                                if code not in code_data:
                                    code_data[code] = {
                                        'price': price,
                                        'diagnosis': diagnosis
                                    }
        except Exception as e:
            print(f"Error processing {filename}: {e}")

# Sort codes numerically where possible
sorted_codes = sorted(code_data.keys(), key=lambda x: (x.isdigit(), int(x) if x.isdigit() else x))

# Write the results to CSV
with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
    writer = csv.writer(csvfile)
    writer.writerow(['Code', 'Price', 'Diagnosis'])
    
    for code in sorted_codes:
        writer.writerow([code, code_data[code]['price'], code_data[code]['diagnosis']])

# Print summary
print(f"Data extraction completed!")
print(f"Total files processed: {files_processed}")
print(f"Total records analyzed: {total_records}")
print(f"Distinct codes found: {len(code_data)}")
print(f"Results saved to: {output_file}")

# Display first 10 codes as sample
print("\nSample of extracted data (first 10 codes):")
print("-" * 80)
print(f"{'Code':<10} {'Price':<10} {'Diagnosis':<50}")
print("-" * 80)
for i, code in enumerate(sorted_codes[:10]):
    print(f"{code:<10} {code_data[code]['price']:<10} {code_data[code]['diagnosis'][:50]:<50}")