@echo off
cd /d "%~dp0"
start "" ngrok http 3100 --config "%LOCALAPPDATA%\ngrok\ngrok.yml" --config "%~dp0ngrok-extra.yml"
timeout /t 4 >nul
start "" http://localhost:3100/host
node server.js
