@echo off
rem younggazine studio - auto restart loop. Stop completely with stop-studio.bat
cd /d "%~dp0"
title younggazine studio (auto)
if not exist data mkdir data
:loop
echo [%date% %time%] studio start>> data\studio.log
node studio.js >> data\studio.log 2>&1
if errorlevel 2 if not errorlevel 3 (
  rem port already in use - studio is probably running already. check again in 60s
  ping -n 61 127.0.0.1 >nul
  goto loop
)
echo [%date% %time%] studio exited, restart in 5s>> data\studio.log
ping -n 6 127.0.0.1 >nul
goto loop
