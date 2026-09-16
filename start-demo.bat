@echo off
REM ============================================================
REM  Apex iRacing - modo DEMO (datos sinteticos)
REM  Arranca los 3 procesos en ventanas separadas:
REM    1. generador-demo  -> ws://localhost:8080
REM    2. dashboard       -> http://localhost:3000
REM    3. apex-mobile     -> http://localhost:3001
REM
REM  Cerrar cualquiera de las 3 ventanas detiene ese proceso; las
REM  otras dos siguen funcionando (no estan encadenadas).
REM ============================================================

cd /d "%~dp0"

echo Iniciando Generador_Demo (datos sinteticos) en ws://localhost:8080 ...
start "Apex - Generador Demo" cmd /k "cd apps\generador-demo && npm run dev"

echo Iniciando Dashboard en http://localhost:3000 ...
start "Apex - Dashboard" cmd /k "cd apps\dashboard && npm run dev -- -p 3000"

echo Iniciando Apex Mobile en http://localhost:3001 ...
start "Apex - Mobile" cmd /k "cd apps\apex-mobile && npm run dev -- -p 3001"

echo.
echo Los 3 procesos se estan iniciando en ventanas separadas.
echo Dashboard:   http://localhost:3000
echo Apex Mobile: http://localhost:3001
echo.
pause
