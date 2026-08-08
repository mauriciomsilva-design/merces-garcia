@echo off
setlocal
cd /d "%~dp0.."

if not exist "backups" mkdir "backups"

for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set TODAY=%%c-%%b-%%a
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set NOW=%%a%%b
set STAMP=%TODAY%_%NOW%
set STAMP=%STAMP:/=-%
set STAMP=%STAMP::=-%

set "OK=1"
if exist "data\merces-garcia.sqlite" (
  copy /Y "data\merces-garcia.sqlite" "backups\merces-garcia-%STAMP%.sqlite" >nul
  if errorlevel 1 set "OK=0"
)
if exist "biblioteca\data\biblioteca.sqlite" (
  copy /Y "biblioteca\data\biblioteca.sqlite" "backups\biblioteca-%STAMP%.sqlite" >nul
  if errorlevel 1 set "OK=0"
)

rem Keep only the newest 30 backup files per database name.
for /f "skip=30 delims=" %%F in ('dir /b /o-d "backups\merces-garcia-*.sqlite" 2^>nul') do del /q "backups\%%F"
for /f "skip=30 delims=" %%F in ('dir /b /o-d "backups\biblioteca-*.sqlite" 2^>nul') do del /q "backups\%%F"

if "%OK%"=="1" (
  echo Backup concluido em %date% %time%.
  exit /b 0
) else (
  echo AVISO: um ou mais bancos nao foram encontrados ou nao puderam ser copiados.
  exit /b 1
)
