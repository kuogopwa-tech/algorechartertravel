@echo off
REM Go to your project folder
cd /d "C:\Users\TMK MEDIA SERVICES\algorechartertravel"

REM Stage all changes
git add .

REM Commit with date and time
git commit -m "Auto commit - %date% %time%"

REM Push to GitHub
git push origin main

REM Pause so you can see the messages
pause
