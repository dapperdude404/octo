@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1 || (echo Node.js is not installed. Install current Node.js LTS from https://nodejs.org/ & pause & exit /b 1)
echo Launching AI Octopus browser preview without database or API keys.
echo Open http://localhost:4173 after this window starts.
node scripts\preview.js
pause
