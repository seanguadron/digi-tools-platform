@echo off
setlocal

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start Digi Tools.ps1"

if errorlevel 1 (
  echo.
  echo Digi Tools could not be started.
  pause
)
