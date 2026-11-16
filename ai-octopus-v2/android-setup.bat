@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (echo Run setup-windows.bat first. & pause & exit /b 1)
call npm run web:build || (pause & exit /b 1)
if exist android (
  call npm run android:sync
) else (
  call npm run android:add
)
if errorlevel 1 (echo Capacitor setup failed. & pause & exit /b 1)
echo Open Android Studio with: npm run android:open
echo You need the Android SDK to build an APK. No APK is included in this ZIP.
pause
