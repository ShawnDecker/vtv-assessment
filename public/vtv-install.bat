@echo off
REM ============================================================
REM  Value to Victory — Team Agent Installer (Windows) v2.0
REM  Right-click this file and select "Run as Administrator"
REM  No coding experience needed. Zero tokens used.
REM  Upgrade-safe: detects existing installs, never overwrites
REM  your personal files or memories.
REM ============================================================
title VTV Team Agent Installer
color 0A
echo.
echo  ============================================
echo   VALUE TO VICTORY - Team Agent Setup v2.0
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

REM Detect existing installation
set DEFAULT_DIR=%USERPROFILE%\vtv-agent
set IS_UPGRADE=0

if exist "%DEFAULT_DIR%\vtv-config.json" (
    set IS_UPGRADE=1
    echo  ============================================
    echo   EXISTING INSTALL DETECTED - UPGRADE MODE
    echo  ============================================
    echo.
    echo  Your files and memories will be preserved.
    echo  Only VTV system components will be upgraded.
    echo.
    set VTV_DIR=%DEFAULT_DIR%
) else (
    echo  Default install path: %DEFAULT_DIR%
    echo.
    set /p VTV_DIR="  Install path (press Enter for default): "
    if "%VTV_DIR%"=="" set VTV_DIR=%DEFAULT_DIR%
)

if not exist "%VTV_DIR%" mkdir "%VTV_DIR%"
cd /d "%VTV_DIR%"

echo  [i] Working directory: %VTV_DIR%
echo.

REM Download the advanced installer (always get latest)
echo  [i] Downloading latest VTV Team Installer...
curl -sO https://assessment.valuetovictory.com/vtv-team-installer.js
if %errorlevel% neq 0 (
    echo  [!] Download failed. Check your internet connection.
    pause
    exit /b 1
)

echo  [OK] Downloaded installer v2.0
echo.

REM Run the installer (handles upgrade detection internally)
echo  [i] Running setup...
echo  ============================================
echo.
node vtv-team-installer.js

echo.
REM Claude-Mem: install or verify
if exist "%USERPROFILE%\.claude-mem" (
    echo  [OK] Claude-Mem already installed — memories preserved
) else (
    echo  [i] Installing Claude-Mem (persistent memory for Claude Code)...
    echo.
    call npx claude-mem install
    if %errorlevel% equ 0 (
        echo  [OK] Claude-Mem installed
    ) else (
        echo  [!] Claude-Mem install had issues - you can retry later with: npx claude-mem install
    )
)

echo.
echo  ============================================
if "%IS_UPGRADE%"=="1" (
    echo   Upgrade complete!
) else (
    echo   Setup complete!
)
echo  ============================================
echo.
echo  Your team agent is configured at: %VTV_DIR%
echo.
if "%IS_UPGRADE%"=="1" (
    echo  What was upgraded:
    echo    - VTV Team Config        (merged, your data preserved)
    echo    - VTV Team Skill         (latest version)
    echo    - Health check script    (latest version)
    echo.
    echo  What was preserved:
    echo    - Your Claude-Mem memories
    echo    - Your custom skills and files
    echo    - Your config settings
    echo    - Backups of previous files in vtv-agent\backups\
    echo.
    echo  Next: Open Claude Code — type /vtv-team to continue.
) else (
    echo  What was installed:
    echo    - VTV Team Config        (links, health checks, docs)
    echo    - Claude-Mem             (persistent memory across sessions)
    echo    - VTV Team Skill         (type /vtv-team in Claude Code)
    echo.
    echo  Next: Open Claude Code and type /vtv-team to get started.
)
echo.

REM Open dashboard in browser
set /p OPENBROWSER="  Open dashboard in browser? (Y/n): "
if /i not "%OPENBROWSER%"=="n" (
    start https://assessment.valuetovictory.com/agent-dashboard
)
echo.
pause
