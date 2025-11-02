@echo off
REM ==============================================
REM  Ejecutar el proyecto vinogame (Windows)
REM  - Arranca el servidor Express con npm start
REM ==============================================

echo [run] Iniciando servidor...
set PORT=4353
npm start
exit /b %ERRORLEVEL%