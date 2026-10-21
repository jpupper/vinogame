@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ==============================================
echo  VinoGame - Deli ^& Wine 2 (Puerto 4353)
echo ==============================================

echo [run] Verificando si el puerto 4353 esta ocupado...
powershell -NoProfile -Command "$conns = Get-NetTCPConnection -LocalPort 4353 -ErrorAction SilentlyContinue; if ($conns) { $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($p in $pids) { if ($p -gt 0) { Write-Host ('[run] Liberando puerto 4353 (PID ' + $p + ')...'); Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } } }"

if not exist "node_modules\express" (
    echo [run] Instalando dependencias...
    call npm install
)

echo [run] Iniciando servidor en http://localhost:4353 ...
set PORT=4353
node server.js

pause
