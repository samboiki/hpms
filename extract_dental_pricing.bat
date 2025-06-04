@echo off
echo Installing required packages...
pip install -r requirements_dental_extractor.txt

echo.
echo Extracting pricing data from PDF...
python extract_dental_pricing.py "c:\Users\Happyou2\Documents\emminance\2025_Dental Practitioners (All).pdf" --output "c:\Users\Happyou2\Documents\emminance\2025_Dental_Pricing_Table.csv"

echo.
echo Processing complete! Check for output files:
echo - 2025_Dental_Pricing_Table.csv
echo - 2025_Dental_Pricing_Table_summary.txt

pause