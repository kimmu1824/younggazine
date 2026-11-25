@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 영거진 스튜디오
node studio.js
pause
