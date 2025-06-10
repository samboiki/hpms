#!/usr/bin/env python3
"""
Script to process files and extract D records for CSV output
"""
import os
import csv
import glob

def process_files(directory_path, output_csv):
    """
    Process all files in directory, extract first 2 and last 2 D records
    """
    results = []
    
    # Get all files in the directory
    if os.path.exists(directory_path):
        files = glob.glob(os.path.join(directory_path, '*'))
    else:
        print(f"Directory not found: {directory_path}")
        return
    
    for file_path in files:
        if os.path.isfile(file_path):
            filename = os.path.basename(file_path)
            print(f"Processing: {filename}")
            
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
                
                # Filter lines that start with 'D'
                d_records = [line.strip() for line in lines if line.strip().startswith('D')]
                
                if len(d_records) == 0:
                    print(f"  No D records found in {filename}")
                    continue
                
                # Get first 2 and last 2 records
                selected_records = []
                
                if len(d_records) == 1:
                    selected_records = d_records
                elif len(d_records) == 2:
                    selected_records = d_records
                elif len(d_records) == 3:
                    selected_records = [d_records[0], d_records[1], d_records[2]]
                else:
                    # First 2 and last 2
                    selected_records = d_records[:2] + d_records[-2:]
                
                print(f"  Found {len(d_records)} D records, selected {len(selected_records)}")
                
                # Add the selected records - split each field into its own row
                for record in selected_records:
                    # Split the D record by comma and add each field as a separate row
                    fields = record.split(',')
                    for field in fields:
                        results.append([filename, field.strip()])
                    
            except Exception as e:
                print(f"  Error processing {filename}: {e}")
    
    # Write to CSV
    with open(output_csv, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['Filename', 'Data'])  # Header
        writer.writerows(results)
    
    print(f"\nResults written to: {output_csv}")
    print(f"Total rows: {len(results)}")

def main():
    # Using the x folder you put in sample_data
    directory_path = "/home/happy/projects/hpms/sample_data/x"
    
    # Create CSV in the same directory
    output_csv = os.path.join(directory_path, "d_records_output.csv")
    
    process_files(directory_path, output_csv)

if __name__ == "__main__":
    main()