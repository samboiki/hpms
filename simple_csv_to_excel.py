#!/usr/bin/env python3
"""
Simple CSV to Excel Converter
Converts Complete_List_of_Distinct_Codes.csv to Excel with basic formatting
"""

import pandas as pd
import os

# File paths
csv_path = r'C:\Users\Happyou2\Documents\emminance\History\Complete_List_of_Distinct_Codes.csv'
excel_path = r'C:\Users\Happyou2\Documents\emminance\History\Complete_List_of_Distinct_Codes.xlsx'

try:
    # Check if file exists
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found at {csv_path}")
        print("Please check the file path and try again.")
        exit(1)
    
    # Read CSV
    print("Reading CSV file...")
    df = pd.read_csv(csv_path)
    
    # Display info about the data
    print(f"Found {len(df)} rows and {len(df.columns)} columns")
    print(f"Columns: {', '.join(df.columns.tolist())}")
    
    # Write to Excel with formatting
    print("Converting to Excel...")
    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='Codes', index=False)
        
        # Get the workbook and worksheet for formatting
        workbook = writer.book
        worksheet = writer.sheets['Codes']
        
        # Make headers bold
        from openpyxl.styles import Font, Alignment
        for cell in worksheet[1]:
            cell.font = Font(bold=True)
            cell.alignment = Alignment(horizontal='center')
        
        # Auto-fit columns
        for column in worksheet.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[column_letter].width = adjusted_width
    
    print(f"Successfully created: {excel_path}")
    print("Excel file has been formatted with:")
    print("- Bold headers")
    print("- Auto-fitted column widths")
    print("- Data preserved from CSV")
    
except FileNotFoundError:
    print(f"Error: Could not find the CSV file at {csv_path}")
    print("Please ensure the file exists at the specified location.")
except PermissionError:
    print(f"Error: Permission denied. Cannot write to {excel_path}")
    print("Please ensure you have write permissions to the directory.")
except Exception as e:
    print(f"An error occurred: {str(e)}")
    print("Please check the CSV file format and try again.")