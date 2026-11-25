@echo off
rem Stop younggazine studio (including the auto restart loop)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\studio-control.ps1" stop
ping -n 3 127.0.0.1 >nul
