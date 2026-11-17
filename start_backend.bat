@echo off
echo ============================================
echo  Sistema Matriz Competencias -- Backend API
echo ============================================
rem Se ejecuta desde la raiz del proyecto: backend usa imports relativos (backend.main:app), igual que en Render.
cd /d "%~dp0"

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python no encontrado. Instala Python 3.10+
    pause
    exit /b 1
)

echo [1/2] Instalando dependencias...
python -m pip install -r backend\requirements.txt -q

echo [2/2] Iniciando FastAPI en http://localhost:8000
echo.
echo  API docs: http://localhost:8000/docs
echo  Health:   http://localhost:8000/health
echo.
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
pause
