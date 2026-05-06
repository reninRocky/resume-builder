@echo off
echo Starting Resume Builder Application...
echo.

REM Get the directory where this batch file is located
cd /d "%~dp0"

REM Start backend server in a new window
echo Starting backend server on port 4000...
start "Resume Builder - Backend" cmd /k "cd /d %~dp0backend && node server.js"

REM Wait a moment for backend to start
timeout /t 2 /nobreak >nul

REM Start frontend server in a new window
echo Starting frontend server on port 3000...
start "Resume Builder - Frontend" cmd /k "cd /d %~dp0frontend && npm start"

echo.
echo Both servers are starting...
echo Backend: http://localhost:4000
echo Frontend: http://localhost:3000
echo.
echo Close the windows to stop the servers.
pause

