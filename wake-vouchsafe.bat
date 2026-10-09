@echo off
setlocal enabledelayedexpansion
title Wake Vouchsafe server
echo.
echo === Waking the Vouchsafe server (Render free tier sleeps when idle) ===
echo Run this about 5 minutes before the demo.
echo.

set URL=https://credobounty.vercel.app/api/health/ready
set TRIES=0

:loop
set /a TRIES+=1
set CODE=000
for /f %%A in ('curl.exe -s -o NUL -m 30 -w "%%{http_code}" %URL%') do set CODE=%%A
echo [try !TRIES!/12] health/ready -^> HTTP !CODE!
if "!CODE!"=="200" goto ready
if !TRIES! GEQ 12 goto fail
timeout /t 10 /nobreak >NUL
goto loop

:ready
echo.
echo Warming up the main pages...
curl.exe -s -o NUL -m 30 https://credobounty.vercel.app/
curl.exe -s -o NUL -m 30 https://credobounty.vercel.app/api/bounties
curl.exe -s -o NUL -m 30 https://credobounty.vercel.app/api/community/posts
echo.
echo ==========================================
echo   SERVER IS READY - you can start the demo
echo ==========================================
goto end

:fail
echo.
echo Server did not answer in time. Wait 1 minute and run this file again.
echo If it still fails, check the Render dashboard (credobounty-api) for errors.

:end
echo.
pause
