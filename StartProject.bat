@echo off
setlocal
cd /d "%~dp0"

echo [Algore Charter Travels] Starting local development server...
echo [INFO] Server will run at http://localhost:3000
echo [INFO] Press Ctrl+C to stop the server at any time.
echo.

npm run dev

pause
