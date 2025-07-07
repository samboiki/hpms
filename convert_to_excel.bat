@echo off
echo CSV to Excel Converter
echo ======================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python from https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Install required packages if needed
echo Checking required packages...
pip show pandas >nul 2>&1
if errorlevel 1 (
    echo Installing pandas...
    pip install pandas
)

pip show openpyxl >nul 2>&1
if errorlevel 1 (
    echo Installing openpyxl...
    pip install openpyxl
)

echo.
echo Starting conversion...
echo.

REM Run the converter
python simple_csv_to_excel.py

echo.
pause