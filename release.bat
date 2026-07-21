@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js not found - install it from https://nodejs.org then try again. & pause & exit /b 1)
node release.js
pause
