@echo off
rem Upload younggazine code to GitHub (kimmu1824/younggazine).
rem Safety checks (.env, content, data, output, secrets) live in scripts\github-upload.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\github-upload.ps1"
pause
