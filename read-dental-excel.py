#!/usr/bin/env python3

import pandas as pd
import json
import os

def read_dental_excel():
    # Path to the Excel file
    excel_path = r'c:/Users/Happyou2/Documents/emminance/dentalpractice_codes_2025.xlsx'
    
    try:
        # Read the Excel file
        print(f"Reading Excel file: {excel_path}")
        
        # First, let's see what sheets are available
        xl_file = pd.ExcelFile(excel_path)
        print(f"Available sheets: {xl_file.sheet_names}")
        
        # Read the first sheet (or try different sheets)
        for sheet_name in xl_file.sheet_names:
            print(f"\n=== READING SHEET: {sheet_name} ===")
            df = pd.read_excel(excel_path, sheet_name=sheet_name)
            
            print(f"Shape: {df.shape}")
            print(f"Columns: {list(df.columns)}")
            
            # Show first few rows
            print("\n=== FIRST 5 ROWS ===")
            print(df.head())
            
            # Show data types
            print("\n=== DATA TYPES ===")
            print(df.dtypes)
            
            # Check for null values
            print("\n=== NULL VALUES ===")
            print(df.isnull().sum())
            
            # Save sample data to JSON for analysis
            sample_data = df.head(10).to_dict('records')
            with open(f'/home/happy/projects/hpms/dental_codes_sample_{sheet_name.replace(" ", "_")}.json', 'w') as f:
                json.dump(sample_data, f, indent=2, default=str)
            
            print(f"Sample data saved to dental_codes_sample_{sheet_name.replace(' ', '_')}.json")
            
            # If this sheet has dental codes, break after first sheet
            if len(df) > 50:  # Assume main data sheet has many rows
                break
                
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        return None

if __name__ == "__main__":
    read_dental_excel()