@echo off
echo Killing process on port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    echo Found process: %%a
    taskkill /F /PID %%a
)
echo Done!
timeout /t 2
