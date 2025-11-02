@echo off
REM ==============================================
REM  Setup del proyecto vinogame (Windows)
REM  - Instala dependencias npm
REM  - Crea carpetas de uploads
REM  - Opcional: copia .env.example -> .env
REM ==============================================

echo [setup] Verificando Node.js y npm...
node --version >nul 2>&1 || (
  echo [setup] ERROR: Node.js no esta instalado o no esta en PATH.
  echo Descarga e instala desde https://nodejs.org/ y vuelve a ejecutar setup.bat
  exit /b 1
)
npm --version >nul 2>&1 || (
  echo [setup] ERROR: npm no esta disponible.
  echo Instala Node.js (incluye npm) y vuelve a ejecutar setup.bat
  exit /b 1
)

echo [setup] Instalando dependencias...
npm install || (
  echo [setup] ERROR: Fallo al ejecutar "npm install".
  exit /b 1
)

echo [setup] Creando carpetas para uploads (public/img/custom)...
if not exist public\img\custom mkdir public\img\custom
if not exist public\img\custom\objects mkdir public\img\custom\objects
if not exist public\img\custom\badItems mkdir public\img\custom\badItems
if not exist public\img\custom\backgrounds mkdir public\img\custom\backgrounds

REM Copiar .env.example a .env si existe y no hay .env
if exist .env (
  echo [setup] .env ya existe, no se copia.
) else (
  if exist .env.example (
    copy /Y .env.example .env >nul
    echo [setup] .env creado a partir de .env.example
  ) else (
    echo [setup] No hay .env.example, omitido.
  )
)

echo [setup] Listo. Usa run.bat para iniciar el servidor.
exit /b 0