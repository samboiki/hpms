# Set console encoding for Unicode support
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
# Set output encoding with error handling
try {
    $Host.UI.RawUI.OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
    # Fallback for older PowerShell versions
    chcp 65001 | Out-Null
}

Write-Host "[*] Starting Development Servers for Windows..." -ForegroundColor Green
Write-Host "[i] Configuration Summary:" -ForegroundColor Yellow
Write-Host "   • React Practice Portal: http://localhost:7000 (Vite 5.4.2)" -ForegroundColor White
Write-Host "   • React Admin Portal: http://localhost:8000 (Vite 5.4.2)" -ForegroundColor White
Write-Host "   • Next.js Marketing + Client Pages: http://localhost:9000 (Next.js 15.4.4)" -ForegroundColor White
Write-Host ""

Write-Host "[~] Cleaning build artifacts..." -ForegroundColor Cyan
if (Test-Path ".next\cache") { Remove-Item ".next\cache" -Recurse -Force -ErrorAction SilentlyContinue }
if (Test-Path "onehealth\.next\cache") { Remove-Item "onehealth\.next\cache" -Recurse -Force -ErrorAction SilentlyContinue }
if (Test-Path "onehealth-admin\.next\cache") { Remove-Item "onehealth-admin\.next\cache" -Recurse -Force -ErrorAction SilentlyContinue }
if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force -ErrorAction SilentlyContinue }
if (Test-Path "onehealth-admin\dist") { Remove-Item "onehealth-admin\dist" -Recurse -Force -ErrorAction SilentlyContinue }

Write-Host "[>] Checking and clearing conflicting ports..." -ForegroundColor Cyan
$ports = @(7000, 7001, 8000, 8001, 9000, 9001)
foreach ($port in $ports) {
    $processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $processes) {
        if ($processId) {
            Write-Host "   Killing process $processId on port $port" -ForegroundColor Yellow
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "[.] Starting servers with 2-second delays..." -ForegroundColor Cyan

Write-Host "[+] Starting React Practice Portal on port 7000..." -ForegroundColor Green
Start-Process -FilePath "cmd" -ArgumentList "/c", "npm run dev:practice-only > practice.log 2>&1" -WindowStyle Hidden
Start-Sleep -Seconds 2

Write-Host "[+] Starting React Admin Portal on port 8000..." -ForegroundColor Green
Set-Location "onehealth-admin"
Start-Process -FilePath "cmd" -ArgumentList "/c", "npx vite dev --host localhost --port 8000 > admin.log 2>&1" -WindowStyle Hidden
Start-Sleep -Seconds 3

Write-Host "[+] Starting Next.js Marketing on port 9000..." -ForegroundColor Green
Set-Location "..\onehealth"
Start-Process -FilePath "cmd" -ArgumentList "/c", "npm run dev > marketing.log 2>&1" -WindowStyle Hidden
Start-Sleep -Seconds 2
Set-Location ".."

Write-Host "[*] Client Landing Pages integrated into Next.js Marketing on port 9000" -ForegroundColor Magenta
Write-Host "[!] All servers started!" -ForegroundColor Green
Write-Host ""

Write-Host "[i] Access URLs (copy into your browser):" -ForegroundColor Yellow
Write-Host "   React Practice Portal: http://localhost:7000" -ForegroundColor White
Write-Host "   React Admin Portal: http://localhost:8000" -ForegroundColor White
Write-Host "   Next.js Marketing: http://localhost:9000" -ForegroundColor White
Write-Host ""

Write-Host "[i] Client Landing Page Quick Access:" -ForegroundColor Yellow
Write-Host "   NewCharm Dental: http://localhost:9000/?practice=newcharm" -ForegroundColor White
Write-Host "   Dr. Polina: http://localhost:9000/?practice=polina" -ForegroundColor White
Write-Host "   CityClinic: http://localhost:9000/?practice=cityclinic" -ForegroundColor White
Write-Host "   CoastalMed: http://localhost:9000/?practice=coastalmed" -ForegroundColor White
Write-Host ""

Write-Host "[i] Log files created:" -ForegroundColor Yellow
Write-Host "   Practice: .\practice.log" -ForegroundColor White
Write-Host "   Admin: .\onehealth-admin\admin.log" -ForegroundColor White
Write-Host "   Marketing: .\onehealth\marketing.log" -ForegroundColor White
Write-Host ""

Write-Host "[?] To check server status: Get-Process node" -ForegroundColor Cyan
Write-Host "[X] To stop all servers: Stop-Process -Name node -Force" -ForegroundColor Red