@echo off
title S.I.R Test Launcher
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Could not find npm. Make sure Node.js is installed.
  pause
  exit /b 1
)

echo Starting S.I.R in test mode...
call npm run dev

if errorlevel 1 (
  echo.
  echo S.I.R could not start. See the error above.
  pause
)
