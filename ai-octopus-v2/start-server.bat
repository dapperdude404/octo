@echo off
setlocal
cd /d "%~dp0"
if not exist .env (echo Missing .env. Run setup-windows.bat first. & pause & exit /b 1)
call npm start
pause
