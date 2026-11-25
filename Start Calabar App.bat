@echo off
setlocal
cd /d "%~dp0"
title Calabar Food Marketplace

echo.
echo   Calabar Food Marketplace
echo   ------------------------
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js / npm was not found on PATH.
  echo Install Node.js from https://nodejs.org and run this file again.
  echo.
  pause
  exit /b 1
)

curl -s -o nul -m 2 http://localhost:3000/ >nul 2>&1
if errorlevel 1 (
  echo Starting the local server...
  start "Calabar Food Marketplace - Server" cmd /c "npm run dev"
  echo Waiting for the server to be ready...
  ping -n 7 127.0.0.1 >nul
) else (
  echo The local server is already running.
)

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=chrome"
echo Opening http://localhost:3000/ in Chrome...
start "" "%CHROME%" "http://localhost:3000/"
echo.
echo Keep the "Calabar Food Marketplace - Server" window open while using the app.
echo Close that window to stop the server.
endlocal
