@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

title Mercês Garcia - Servidor Local
color 0A

echo.
echo ================================================================
echo          MERCES GARCIA - SERVIDOR LOCAL
 echo ================================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado.
  echo Instale Node.js 22 ou superior e tente novamente.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias pela primeira vez...
  call npm install
  if errorlevel 1 goto :error
)

if not exist "data" mkdir "data"
if not exist "biblioteca\data" mkdir "biblioteca\data"
if not exist "backups" mkdir "backups"

call "%~dp0backup-sqlite.bat"
if errorlevel 1 echo AVISO: backup inicial nao foi concluido.

where powershell >nul 2>&1
if not errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process PowerShell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0liberar-rede-windows.ps1""'" >nul 2>&1
)

echo.
echo Iniciando Presenca e Biblioteca...
echo.
start "Merces Garcia - Presenca" cmd /k "cd /d "%~dp0.." && npm run start:presenca:rede"
start "Merces Garcia - Biblioteca" cmd /k "cd /d "%~dp0.." && npm run start:biblioteca:rede"

timeout /t 3 /nobreak >nul

for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /R /C:"IPv4.*:"') do (
  set "IP=%%A"
  set "IP=!IP: =!"
)

:menu
cls
echo ================================================================
echo          MERCES GARCIA - SERVIDOR LOCAL
 echo ================================================================
echo.
echo Presenca:   http://localhost:3000
 echo Biblioteca: http://localhost:3001
 echo.
echo Para tablets, use o IP do computador:
echo Presenca:   http://SEU-IP:3000
 echo Biblioteca: http://SEU-IP:3001
 echo.
echo O banco fica somente neste computador.
echo.
echo [1] Abrir Presenca neste computador
 echo [2] Abrir Biblioteca neste computador
 echo [3] Fazer backup agora
 echo [4] Sair
 echo.
choice /c 1234 /n /m "Escolha: "
if errorlevel 4 goto :end
if errorlevel 3 call "%~dp0backup-sqlite.bat" & pause & goto :menu
if errorlevel 2 start "Biblioteca" http://localhost:3001 & goto :menu
if errorlevel 1 start "Presenca" http://localhost:3000 & goto :menu

:error
echo.
echo Ocorreu um erro. Consulte a mensagem acima.
pause
exit /b 1

:end
endlocal
