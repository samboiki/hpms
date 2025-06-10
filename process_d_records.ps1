# PowerShell script to process D records and create CSV
# Run this on your Windows machine

$directoryPath = "c:\Users\Happyou2\Documents\emminance\History\x"
$outputCsv = Join-Path $directoryPath "d_records_output.csv"

# Initialize results array
$results = @()

# Add CSV header
$results += [PSCustomObject]@{
    Filename = "Filename"
    Data = "Data"
}

# Get all files in the directory
$files = Get-ChildItem -Path $directoryPath -File

Write-Host "Processing $($files.Count) files in $directoryPath"

foreach ($file in $files) {
    Write-Host "Processing: $($file.Name)"
    
    try {
        # Read file content
        $content = Get-Content -Path $file.FullName -ErrorAction Stop
        
        # Filter lines that start with 'D'
        $dRecords = $content | Where-Object { $_.StartsWith('D') }
        
        if ($dRecords.Count -eq 0) {
            Write-Host "  No D records found in $($file.Name)"
            continue
        }
        
        Write-Host "  Found $($dRecords.Count) D records"
        
        # Add header row with 'D'
        $results += [PSCustomObject]@{
            Filename = $file.Name
            Data = "D"
        }
        
        # Select first 2 and last 2 records
        $selectedRecords = @()
        
        if ($dRecords.Count -le 4) {
            $selectedRecords = $dRecords
        } else {
            # First 2
            $selectedRecords += $dRecords[0..1]
            # Last 2
            $selectedRecords += $dRecords[($dRecords.Count-2)..($dRecords.Count-1)]
        }
        
        # Add selected records to results
        foreach ($record in $selectedRecords) {
            # Remove 'D' prefix to get just the data
            $recordData = $record.Substring(1)
            $results += [PSCustomObject]@{
                Filename = $file.Name
                Data = $recordData
            }
        }
        
        Write-Host "  Added $($selectedRecords.Count) records"
        
    } catch {
        Write-Host "  Error processing $($file.Name): $($_.Exception.Message)"
    }
}

# Export to CSV
try {
    $results | Export-Csv -Path $outputCsv -NoTypeInformation -Encoding UTF8
    Write-Host "`nCSV created successfully: $outputCsv"
    Write-Host "Total rows: $($results.Count)"
} catch {
    Write-Host "Error creating CSV: $($_.Exception.Message)"
}

Write-Host "Done!"