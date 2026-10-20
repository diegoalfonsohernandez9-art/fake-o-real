@echo off
cd /d "%~dp0"
start "" ngrok http 3100
timeout /t 4 >nul
start "" http://localhost:3100/host
node server.js
