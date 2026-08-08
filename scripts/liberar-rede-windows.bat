@echo off
setlocal
cd /d "%~dp0.."

echo ================================================
echo  MERCES GARCIA - LIBERAR ACESSO NA REDE LOCAL
echo ================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Este arquivo precisa ser executado como Administrador.
  echo Clique com o botao direito e escolha "Executar como administrador".
  pause
  exit /b 1
)

netsh advfirewall firewall add rule name="Merces Garcia Presenca Local 3000" dir=in action=allow protocol=TCP localport=3000 profile=private >nul
netsh advfirewall firewall add rule name="Merces Garcia Biblioteca Local 3001" dir=in action=allow protocol=TCP localport=3001 profile=private >nul

echo.
echo Acesso local liberado nas portas 3000 e 3001 para redes privadas.
echo Agora inicie o sistema e use no tablet o endereco IPv4 mostrado no terminal.
echo.
pause
