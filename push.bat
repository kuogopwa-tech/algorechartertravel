# AutoPush.ps1
# Navigate to your project folder
cd "C:\Users\TMK MEDIA SERVICES\algorechartertravel"

# Stage all changes
git add .

# Commit changes with current date & time as message
$commitMessage = "Auto commit: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git commit -m $commitMessage

# Push to GitHub
git push origin main

# Pause so you can see any messages
Read-Host "Press Enter to exit"
