@echo off
echo =============================================
echo  Sistema Matriz Competencias -- Frontend Dev
echo =============================================
cd /d "%~dp0frontend"

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js/npm no encontrado. Instala Node.js 18+
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [1/2] Instalando dependencias npm...
    npm install
) else (
    echo [1/2] Dependencias ya instaladas.
)

echo [2/2] Iniciando Vite en http://localhost:5173
echo.
echo  Asegurate de que el backend este corriendo en http://localhost:8000
echo.
npm run dev
pause
