@echo off
TITLE AgroTalk Full Stack Application
echo ===================================================
echo   Starting AgroTalk Application (Frontend + Backend)
echo ===================================================

echo [INFO] Starting Frontend (Vite)...
start cmd /k "npm run dev"

echo [INFO] Starting Node.js Backend...
start cmd /k "npm run dev:backend"

echo [INFO] Starting Backend (FastAPI)...
cd /d "%~dp0backend_py"

:: Check for root .venv first, then local venv
if exist "..\.venv\Scripts\activate.bat" (
    echo [INFO] Found root virtual environment. Activating...
    call "..\.venv\Scripts\activate.bat"
) else if exist "venv\Scripts\activate.bat" (
    echo [INFO] Found local virtual environment. Activating...
    call venv\Scripts\activate.bat
) else (
    echo [WARNING] No virtual environment found. Running with system python...
)

echo.
echo [INFO] Launching FastAPI Server...
echo [LINK] http://localhost:8000
echo.

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

if errorlevel 1 (
    echo.
    echo [ERROR] Backend server failed to start.
    pause
)

