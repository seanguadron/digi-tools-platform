@echo off
REM StartDigiTools.bat - launches the Digi Tools dev server on port 5100.
REM Double-click to run; close the window or press Ctrl+C to stop.
title Digi Tools - http://localhost:5100
cd /d "%~dp0"
echo.
echo   Starting Digi Tools on http://localhost:5100
echo   (first start compiles - give it a few seconds, then open the URL)
echo.
call npm run dev
