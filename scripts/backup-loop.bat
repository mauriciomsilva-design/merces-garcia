@echo off
setlocal
cd /d "%~dp0.."
:loop
call "%~dp0backup-sqlite.bat"
timeout /t 21600 /nobreak >nul
goto loop
