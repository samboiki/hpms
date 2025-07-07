#!/usr/bin/env python3
"""
Complete analysis of dental practice codes Excel file
Extracts ALL 179 dental codes with complete column structure
"""

import pandas as pd
import json
from pathlib import Path

def analyze_dental_excel():
    """Read and analyze the complete Excel file"""
    
    # Excel file path
    excel_path = "/mnt/c/Users/Happyou2/Documents/emminance/dentalpractice_codes_2025.xlsx"
    
    try:
        # Read Excel file
        print("Reading Excel file...")
        df = pd.read_excel(excel_path)
        
        print(f"✅ Successfully loaded Excel file")
        print(f"📊 Total rows: {len(df)}")
        print(f"📋 Total columns: {len(df.columns)}")
        
        # Get exact column names
        column_names = list(df.columns)
        print(f"\n📝 EXACT COLUMN NAMES ({len(column_names)} columns):")
        for i, col in enumerate(column_names, 1):
            print(f"  {i:2d}. '{col}'")
        
        # Analyze data types
        print(f"\n🔍 DATA TYPES:")
        for col in df.columns:
            dtype = str(df[col].dtype)
            null_count = df[col].isnull().sum()
            unique_count = df[col].nunique()
            print(f"  {col}: {dtype} (nulls: {null_count}, unique: {unique_count})")
        
        # Sample of first few rows
        print(f"\n📋 FIRST 3 ROWS SAMPLE:")
        print(df.head(3).to_string(index=False))
        
        # Export complete data as JSON for easy analysis
        output_data = {
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'column_names': column_names,
            'data_types': {col: str(df[col].dtype) for col in df.columns},
            'null_counts': {col: int(df[col].isnull().sum()) for col in df.columns},
            'unique_counts': {col: int(df[col].nunique()) for col in df.columns},
            'complete_data': df.to_dict('records')  # All 179 records
        }
        
        # Save complete analysis
        output_file = "/home/happy/projects/hpms/dental_codes_complete_analysis.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, default=str)
        
        print(f"\n💾 Complete data saved to: {output_file}")
        
        # Display summary statistics
        print(f"\n📊 SUMMARY STATISTICS:")
        print(f"  • Total dental codes: {len(df)}")
        print(f"  • Column structure: {len(df.columns)} columns")
        print(f"  • Data completeness: {((df.count().sum()) / (len(df) * len(df.columns)) * 100):.1f}%")
        
        # Show sample of unique values for key columns (first 5 columns)
        print(f"\n🔍 SAMPLE VALUES (first 5 columns):")
        for col in df.columns[:5]:
            unique_vals = df[col].dropna().unique()[:5]  # First 5 unique values
            print(f"  {col}: {list(unique_vals)}")
        
        return output_data
        
    except Exception as e:
        print(f"❌ Error reading Excel file: {e}")
        return None

if __name__ == "__main__":
    result = analyze_dental_excel()
    if result:
        print(f"\n✅ Analysis complete! Found {result['total_rows']} dental codes with {result['total_columns']} columns each.")
    else:
        print("\n❌ Analysis failed!")