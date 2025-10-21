@echo off
echo 🚀 Starting Development Servers for Windows...
echo 📋 Configuration Summary:
echo    • React Practice Portal: http://localhost:7000 (Vite 5.4.2)
echo    • React Admin Portal: http://localhost:8000 (Vite 5.4.2)
echo    • Next.js Marketing + Client Pages: http://localhost:9000 (Next.js 15.4.4)
echo.

echo 🧹 Cleaning build artifacts...
if exist .next\cache rmdir /s /q .next\cache 2>nul
if exist onehealth\.next\cache rmdir /s /q onehealth\.next\cache 2>nul
if exist onehealth-admin\.next\cache rmdir /s /q onehealth-admin\.next\cache 2>nul
if exist dist rmdir /s /q dist 2>nul
if exist onehealth-admin\dist rmdir /s /q onehealth-admin\dist 2>nul

echo 🔌 Checking and clearing conflicting ports...
for %%p in (7000 7001 8000 8001 9000 9001) do (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%%p') do (
        echo    Killing process %%a on port %%p
        taskkill /f /pid %%a >nul 2>&1
    )
)

echo ⏰ Starting servers with 2-second delays...

echo 🏥 Starting React Practice Portal on port 7000...
start /b cmd /c "npm run dev:practice-only > practice.log 2>&1"
timeout /t 2 /nobreak >nul

echo 🎯 Starting React Admin Portal on port 8000...
cd onehealth-admin
start /b cmd /c "npx vite dev --host localhost --port 8000 > admin.log 2>&1"
timeout /t 3 /nobreak >nul

echo 🌐 Starting Next.js Marketing on port 9000...
cd ..\onehealth
start /b cmd /c "npm run dev > marketing.log 2>&1"
timeout /t 2 /nobreak >nul
cd ..

echo ✨ Client Landing Pages integrated into Next.js Marketing on port 9000
echo ✅ All servers started!
echo.
echo 🌐 Access URLs (copy into your browser):
echo    React Practice Portal: http://localhost:7000
echo    React Admin Portal: http://localhost:8000
echo    Next.js Marketing: http://localhost:9000
echo.
echo 🏥 Client Landing Page Quick Access:
echo    NewCharm Dental: http://localhost:9000/?practice=newcharm
echo    Dr. Polina: http://localhost:9000/?practice=polina
echo    CityClinic: http://localhost:9000/?practice=cityclinic
echo    CoastalMed: http://localhost:9000/?practice=coastalmed
echo.
echo 📝 Log files created:
echo    Practice: .\practice.log
echo    Admin: .\onehealth-admin\admin.log
echo    Marketing: .\onehealth\marketing.log
echo.
echo 🔍 To check server status: tasklist | findstr node
echo 🛑 To stop all servers: taskkill /f /im node.exe