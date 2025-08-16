@echo off

REM ---- Redis ----
echo Checking Redis status...
tasklist /FI "IMAGENAME eq redis-server.exe" | find /I "redis-server.exe" >nul
if %ERRORLEVEL%==0 (
    echo Redis is already running.
) else (
    echo Starting Redis server...
    start "" "C:\Program Files\Redis\redis-server.exe"
    timeout /t 5 >nul
)

REM ---- Node.js ----
echo Starting PlayMafia server...
cd /d "%~dp0trunk\game"
node index.js

pause