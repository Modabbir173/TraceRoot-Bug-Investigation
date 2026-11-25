@echo off
setlocal

set "ROOT=E:\Practice Programming\TraeRoot\TraceRoot-Bug-Investigation\TraceRoot-Bug-Investigation"
set "BACKEND=%ROOT%\artifacts\api-server"

echo.
echo ==========================================
echo          TraceRoot One-Click Launcher
echo ==========================================
echo.

if not exist "%BACKEND%\app.py" (
    echo ERROR: Backend app.py was not found:
    echo "%BACKEND%\app.py"
    echo.
    pause
    exit /b 1
)

if not exist "%ROOT%\package.json" (
    echo ERROR: Root package.json was not found:
    echo "%ROOT%\package.json"
    echo.
    pause
    exit /b 1
)

echo Checking PostgreSQL service...
sc query postgresql-x64-18 | findstr /I "RUNNING" >nul
if errorlevel 1 (
    echo WARNING: PostgreSQL service postgresql-x64-18 is not running.
    echo Start it from Windows Services, then run this launcher again.
    echo.
    pause
    exit /b 1
)
echo PostgreSQL service is running.
echo.

where uvicorn >nul 2>nul
if errorlevel 1 (
    echo ERROR: uvicorn was not found in PATH.
    echo Activate your Python virtual environment or add its Scripts folder to PATH.
    echo.
    pause
    exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
    echo ERROR: pnpm was not found in PATH.
    echo Install/enable pnpm, then run this launcher again.
    echo.
    pause
    exit /b 1
)

echo Starting FastAPI backend in a new window...
start "TraceRoot Backend" cmd /k "cd /d ""%BACKEND%"" && uvicorn app:app --reload --port 8080"

echo Starting React frontend in a new window...
start "TraceRoot Frontend" cmd /k "cd /d ""%ROOT%"" && set ""PORT=5173"" && set ""BASE_PATH=/"" && pnpm --filter @workspace/traceroot dev"

echo.
echo Launcher commands sent.
echo Backend:  http://127.0.0.1:8080
echo API Docs: http://127.0.0.1:8080/docs
echo Frontend: http://localhost:5173
echo.
echo Keep both terminal windows open while using TraceRoot.
echo Close those windows to stop the corresponding servers.
echo.
pause
