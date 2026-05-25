@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Go to your project folder
cd /d "C:\Users\TMK MEDIA SERVICES\algorechartertravel" || (
  echo [ERROR] Could not open project folder.
  pause
  exit /b 1
)

REM Ensure Git is available
where git >nul 2>&1 || (
  echo [ERROR] Git is not installed or not in PATH.
  pause
  exit /b 1
)

REM Stage all changes (tracked + untracked, except ignored)
git add -A
if errorlevel 1 (
  echo [ERROR] git add failed.
  pause
  exit /b 1
)

REM If nothing staged, skip commit/push
git diff --cached --quiet
if not errorlevel 1 (
  echo [INFO] No changes to commit.
  pause
  exit /b 0
)

REM Build safe timestamp for commit message
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm:ss'"`) do set "TS=%%i"

REM Commit changes
git commit -m "Auto commit - !TS!"
if errorlevel 1 (
  echo [ERROR] git commit failed.
  pause
  exit /b 1
)

REM Push current branch
for /f "usebackq delims=" %%b in (`git rev-parse --abbrev-ref HEAD`) do set "BRANCH=%%b"
echo [INFO] Pushing branch !BRANCH! ...
git push origin !BRANCH!
if errorlevel 1 (
  echo [ERROR] git push failed.
  pause
  exit /b 1
)

echo [SUCCESS] Changes committed and pushed to origin/!BRANCH!.
pause
exit /b 0
