@echo off
cd /d "%~dp0"
echo [1/2] Stopping old backend on port 8080...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"
echo [2/2] Starting backend. Wait until you see: Nest application successfully started
call npm run start:dev
