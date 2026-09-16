@echo off
REM ============================================================
REM  Apex iRacing - modo REAL (datos de iRacing en vivo)
REM  Arranca los 3 procesos en ventanas separadas:
REM    1. iracing-bridge  -> ws://localhost:8080 (lee iRacing real)
REM    2. dashboard       -> http://localhost:3000
REM    3. apex-mobile     -> http://localhost:3001
REM
REM  REQUISITOS antes de usar este script (ver apps/iracing-bridge/README.md):
REM    - Windows (este script ya asume que corres en Windows).
REM    - iRacing abierto EN ESTA MISMA PC.
REM    - Estar en una sesion activa (practica/qualy/carrera) para
REM      que haya datos que transmitir.
REM
REM  Cerrar cualquiera de las 3 ventanas detiene ese proceso; las
REM  otras dos siguen funcionando (no estan encadenadas).
REM ============================================================

cd /d "%~dp0"

echo Iniciando iRacing_Bridge (datos reales) en ws://localhost:8080 ...
echo Asegurate de tener iRacing abierto y una sesion activa.
start "Apex - iRacing Bridge" cmd /k "cd apps\iracing-bridge && npm run dev"

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
