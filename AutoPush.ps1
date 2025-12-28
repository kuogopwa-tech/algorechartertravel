# AutoPush.ps1

# Go to project folder
cd "C:\Users\TMK MEDIA SERVICES\algorechartertravel"

# Stage all changes
git add .

# Commit with current date/time
$commitMessage = "Auto commit: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git commit -m $commitMessage

# Push to GitHub
git push origin main

# Pause to see output
Read-Host "Press Enter to exit"
