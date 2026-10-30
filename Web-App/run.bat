@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed or not in PATH.
  echo Install it from https://nodejs.org then run this file again.
  pause
  exit /b 1
)

echo Freeing port 3000...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { if ($_ -gt 4) { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }"
timeout /t 1 /nobreak >nul

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Opening http://localhost:3000
start "" "http://localhost:3000"
echo Starting Atrium Access...
call npm start
pause
