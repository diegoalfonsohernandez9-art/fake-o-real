@echo off
cd /d "%~dp0"
start "" http://localhost:3100/host
node server.js
