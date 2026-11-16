@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1 || (echo Install Node.js LTS from https://nodejs.org/ & pause & exit /b 1)
where npm >nul 2>&1 || (echo npm was not found. & pause & exit /b 1)
if not exist .env (
  copy .env.example .env >nul
  echo Created .env. Set JWT_SECRET to a random 32+ character value before using accounts.
)
echo Installing Node.js packages...
call npm install || (echo Package installation failed. & pause & exit /b 1)
echo Building web frontend...
call npm run web:build || (echo Build failed. & pause & exit /b 1)
echo To use accounts and scan history, start PostgreSQL, then run: npm run db:generate AND npm run db:migrate
pause
