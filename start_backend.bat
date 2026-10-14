@echo off
echo ============================================
echo  Sistema Matriz Competencias -- Backend API
echo ============================================
cd /d "%~dp0backend"

where pip >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python/pip no encontrado. Instala Python 3.10+
    pause
    exit /b 1
)

echo [1/2] Instalando dependencias...
pip install -r requirements.txt -q

echo [2/2] Iniciando FastAPI en http://localhost:8000
echo.
echo  API docs: http://localhost:8000/docs
echo  Health:   http://localhost:8000/health
echo.
uvicorn main:app --reload --host 0.0.0.0 --port 8000
pause
