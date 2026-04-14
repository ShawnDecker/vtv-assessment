@echo off
REM ============================================================
REM  Value to Victory — Team Agent Installer (Windows)
REM  Right-click this file and select "Run as Administrator"
REM  No coding experience needed. Zero tokens used.
REM ============================================================
title VTV Team Agent Installer
color 0A
echo.
echo  ============================================
echo   VALUE TO VICTORY - Team Agent Setup
echo  ============================================
echo.

REM Check for admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Please right-click this file and select
    echo      "Run as Administrator" to continue.
    echo.
    pause
    exit /b 1
)

REM Check for Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Node.js is not installed.
    echo  [i] Installing Node.js via winget...
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo.
        echo  [!] Could not auto-install Node.js.
        echo  [i] Please download it from: https://nodejs.org
        echo.
        pause
        exit /b 1
    )
    echo  [OK] Node.js installed. Please close and re-run this script.
    pause
    exit /b 0
)

echo  [OK] Node.js found:
node --version
echo.

REM Choose install directory
set DEFAULT_DIR=%USERPROFILE%\vtv-agent
echo  Default install path: %DEFAULT_DIR%
echo.
set /p VTV_DIR="  Install path (press Enter for default): "
if "%VTV_DIR%"=="" set VTV_DIR=%DEFAULT_DIR%

if not exist "%VTV_DIR%" mkdir "%VTV_DIR%"
cd /d "%VTV_DIR%"

echo  [i] Working directory: %VTV_DIR%
echo.

REM Download the advanced installer
echo  [i] Downloading VTV Team Installer...
curl -sO https://assessment.valuetovictory.com/vtv-team-installer.js
if %errorlevel% neq 0 (
    echo  [!] Download failed. Check your internet connection.
    pause
    exit /b 1
)

echo  [OK] Downloaded installer
echo.

REM Run the installer
echo  [i] Running setup...
echo  ============================================
echo.
node vtv-team-installer.js

echo.
echo  [i] Installing Claude-Mem (persistent memory for Claude Code)...
echo.
call npx claude-mem install
if %errorlevel% equ 0 (
    echo  [OK] Claude-Mem installed
) else (
    echo  [!] Claude-Mem install had issues - you can retry later with: npx claude-mem install
)

echo.
echo  ============================================
echo   Setup complete!
echo  ============================================
echo.
echo  Your team agent is configured at: %VTV_DIR%
echo.
echo  What was installed:
echo    - VTV Team Config        (links, health checks, docs)
echo    - Claude-Mem             (persistent memory across sessions)
echo.
echo  Next: Open Claude Code and start working. Memory carries over.
echo.

REM Open dashboard in browser
set /p OPENBROWSER="  Open dashboard in browser? (Y/n): "
if /i not "%OPENBROWSER%"=="n" (
    start https://assessment.valuetovictory.com/agent-dashboard
)
echo.
pause
