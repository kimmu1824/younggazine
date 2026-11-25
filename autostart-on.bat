@echo off
rem Start younggazine studio automatically (minimized) when you log in. No admin needed.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\studio-control.ps1" on
ping -n 4 127.0.0.1 >nul
