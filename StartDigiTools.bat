@echo off
REM StartDigiTools.bat - launches the Digi Tools dev server on port 5100.
REM Double-click to run; close the window or press Ctrl+C to stop.
title Digi Tools - http://localhost:5100
cd /d "%~dp0"

REM Is anything holding port 5100?
netstat -ano | findstr /C:":5100 " | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
  REM Port held is NOT the same as "working" - a dev server can wedge and keep
  REM the socket open while answering nothing (seen 2026-07-17: a 2-day-old
  REM server, ~160%% CPU, every request hanging). So ask it for a page before
  REM believing it. -m 10 = give a cold-compiling server a fair chance.
  echo.
  echo   Something is already on port 5100 - checking whether it answers...
  curl -s -o nul -m 10 http://localhost:5100/ >nul 2>&1
  if errorlevel 1 goto :wedged

  echo   Digi Tools is already running at http://localhost:5100
  echo   Opening it in your browser. To restart the server instead, close
  echo   the old "Digi Tools" window ^(or end the node process^) and rerun this.
  echo.
  start "" http://localhost:5100
  timeout /t 6 >nul
  exit /b 0
)
goto :start

:wedged
echo.
echo   The server on port 5100 is NOT responding - it looks wedged.
echo.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /C:":5100 " ^| findstr "LISTENING"') do set STALEPID=%%p
echo   Held by process id %STALEPID%.
choice /c YN /m "  End that process and start a fresh server"
if errorlevel 2 (
  echo   Left it alone. Nothing started.
  pause
  exit /b 1
)
taskkill /PID %STALEPID% /T /F >nul 2>&1
timeout /t 2 >nul
echo   Stale server ended.
goto :start

:start

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
