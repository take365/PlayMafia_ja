@echo off
REM ===============================
REM PlayMafia 起動スクリプト (Windows)
REM 直下に配置してください
REM ===============================

REM ---- Redis の起動確認 ----
echo Checking Redis status...
tasklist /FI "IMAGENAME eq redis-server.exe" | find /I "redis-server.exe" >nul
if %ERRORLEVEL%==0 (
    echo Redis is already running.
) else (
    echo Starting Redis server...
    REM ※ redis-server.exe のパスを調整してください
    start "" "C:\Program Files\Redis\redis-server.exe"
    timeout /t 5 >nul
)

REM ---- Node.js サーバー起動 ----
echo Starting PlayMafia server...
cd /d "%~dp0trunk\game"
node index.js

pause