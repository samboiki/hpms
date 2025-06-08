#!/usr/bin/env python3
"""
Script to read and analyze dental practice codes from Excel file
"""
import pandas as pd
import sys
import os

def read_dental_excel(file_path):
    """Read and analyze the dental practice codes Excel file"""
    try:
        # Check if file exists
        if not os.path.exists(file_path):
            print(f"Error: File not found at {file_path}")
            return None
            
        print(f"Reading Excel file: {file_path}")
        
        # Read the Excel file
        excel_file = pd.ExcelFile(file_path)
        
        print(f"\nSheet names in the Excel file:")
        for i, sheet_name in enumerate(excel_file.sheet_names):
            print(f"  {i+1}. {sheet_name}")
        
        # Read all sheets and analyze structure
        all_sheets_data = {}
        
        for sheet_name in excel_file.sheet_names:
            print(f"\n{'='*60}")
            print(f"ANALYZING SHEET: {sheet_name}")
            print(f"{'='*60}")
            
            try:
                df = pd.read_excel(file_path, sheet_name=sheet_name)
                
                print(f"Shape: {df.shape} (rows: {df.shape[0]}, columns: {df.shape[1]})")
                
                print(f"\nColumn names:")
                for i, col in enumerate(df.columns):
                    print(f"  {i+1}. {col}")
                
                print(f"\nFirst 5 rows of data:")
                print(df.head().to_string())
                
                print(f"\nData types:")
                print(df.dtypes.to_string())
                
                # Check for missing values
                print(f"\nMissing values per column:")
                missing_counts = df.isnull().sum()
                for col, count in missing_counts.items():
                    if count > 0:
                        print(f"  {col}: {count} missing values")
                    else:
                        print(f"  {col}: No missing values")
                
                # Sample some data to understand structure
                if len(df) > 0:
                    print(f"\nSample data analysis:")
                    for col in df.columns:
                        unique_values = df[col].nunique()
                        print(f"  {col}: {unique_values} unique values")
                        if unique_values <= 10 and unique_values > 0:
                            print(f"    Unique values: {df[col].unique()}")
                        elif unique_values > 0:
                            print(f"    Sample values: {df[col].dropna().head(3).tolist()}")
                
                all_sheets_data[sheet_name] = df
                
            except Exception as e:
                print(f"Error reading sheet '{sheet_name}': {str(e)}")
        
        return all_sheets_data
        
    except Exception as e:
        print(f"Error reading Excel file: {str(e)}")
        return None

def main():
    # Path to the Excel file (Windows path converted to WSL path)
    file_path = "/mnt/c/Users/Happyou2/Documents/emminance/dentalpractice_codes_2025.xlsx"
    
    print("Dental Practice Codes Excel File Analyzer")
    print("="*50)
    
    data = read_dental_excel(file_path)
    
    if data:
        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        print(f"Total sheets analyzed: {len(data)}")
        for sheet_name, df in data.items():
            print(f"  - {sheet_name}: {df.shape[0]} rows, {df.shape[1]} columns")
        
        # Generate CSV exports for easier analysis
        print(f"\nExporting sheets to CSV for easier analysis...")
        for sheet_name, df in data.items():
            safe_sheet_name = sheet_name.replace(" ", "_").replace("/", "_")
            csv_path = f"/home/happy/projects/hpms/dental_codes_{safe_sheet_name}.csv"
            df.to_csv(csv_path, index=False)
            print(f"  Exported {sheet_name} to: {csv_path}")
    else:
        print("Failed to read Excel file")

if __name__ == "__main__":
    main()