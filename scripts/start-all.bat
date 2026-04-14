@echo off
REM ============================================================
REM  Value to Victory — Start All Systems
REM  Launches Docker stack + system agent monitoring
REM  Run from the vtv-assessment directory
REM ============================================================
title VTV System Startup
color 0A
echo.
echo  ============================================
echo   VALUE TO VICTORY - Full System Startup
echo  ============================================
echo.

REM Check Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Docker is not installed or not running.
    echo  [i] Install Docker Desktop: https://docker.com/products/docker-desktop
    pause
    exit /b 1
)
echo  [OK] Docker found

REM Check Docker daemon
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Docker daemon is not running. Start Docker Desktop first.
    pause
    exit /b 1
)
echo  [OK] Docker daemon running
echo.

REM Start Docker stack
echo  [i] Starting Docker services...
docker compose up -d
echo.

REM Wait for services to come up
echo  [i] Waiting 15 seconds for services to initialize...
timeout /t 15 /nobreak >nul

REM Build devotionals from Obsidian (if vault exists)
echo  [i] Checking for Obsidian devotionals...
node scripts\build-devotionals.js
echo.

REM Start system agent
echo  [i] Starting system agent (reports every 5 min)...
start "VTV System Agent" cmd /k "node scripts\system-agent.js --loop"
echo  [OK] System agent running in background
echo.

REM Health check
echo  ============================================
echo   SYSTEM STATUS
echo  ============================================
echo.

REM Check each service
curl -s -o nul -w "  n8n:       %%{http_code}" http://localhost:5678/healthz 2>nul
echo.
curl -s -o nul -w "  Ollama:    %%{http_code}" http://localhost:11434/api/tags 2>nul
echo.
curl -s -o nul -w "  Audiobook: %%{http_code}" http://localhost:8082/ 2>nul
echo.
curl -s -o nul -w "  ComfyUI:   %%{http_code}" http://localhost:8188/ 2>nul
echo.

echo.
echo  ============================================
echo   ALL SYSTEMS LAUNCHED
echo  ============================================
echo.
echo  Services:
echo    n8n:         http://localhost:5678
echo    Ollama:      http://localhost:11434
echo    Audiobook:   http://localhost:8082
echo    ComfyUI:     http://localhost:8188
echo    Assessment:  https://assessment.valuetovictory.com
echo    Dashboard:   https://assessment.valuetovictory.com/agent-dashboard
echo.
echo  System agent is reporting to VTV API every 5 minutes.
echo  Docker containers will auto-restart on failure.
echo.
pause
