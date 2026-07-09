@echo off
REM StartDigiTools.bat - launches the Digi Tools dev server on port 5100.
REM Double-click to run; close the window or press Ctrl+C to stop.
title Digi Tools - http://localhost:5100
cd /d "%~dp0"

REM If a server already holds port 5100, don't crash into it - just open it.
netstat -ano | findstr /C:":5100 " | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
  echo.
  echo   Digi Tools is already running at http://localhost:5100
  echo   Opening it in your browser. To restart the server instead, close
  echo   the old "Digi Tools" window ^(or end the node process^) and rerun this.
  echo.
  start "" http://localhost:5100
  timeout /t 6 >nul
  exit /b 0
)

echo.
echo   Starting Digi Tools on http://localhost:5100
echo   (first start compiles - give it a few seconds, then open the URL)
echo.
call npm run dev

REM If the server exits (error or Ctrl+C), keep the window open so any
REM error above stays readable instead of the window vanishing.
echo.
echo   The dev server stopped. If that was unexpected, read the output above.
pause
