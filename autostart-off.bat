@echo off
rem Turn off auto start at login
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\studio-control.ps1" off
ping -n 4 127.0.0.1 >nul
