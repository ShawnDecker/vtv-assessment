@echo off
REM ============================================================
REM  Value to Victory — Uninstaller (Windows)
REM  Right-click this file and select "Run as Administrator"
REM ============================================================
title VTV Uninstaller
color 0C
echo.
echo  ============================================
echo   VALUE TO VICTORY - Uninstaller
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

set VTV_DIR=%USERPROFILE%\vtv-agent

echo  This will remove:
echo.
echo    1. VTV Agent config       (%VTV_DIR%)
echo    2. Claude-Mem plugin      (persistent memory)
echo    3. Claude-Mem database    (~\.claude-mem)
echo.
echo  This will NOT remove:
echo    - Node.js (you may need it for other things)
echo    - Your VTV account or assessment data
echo.

set /p CONFIRM="  Are you sure you want to uninstall? (yes/no): "
if /i not "%CONFIRM%"=="yes" (
    echo.
    echo  Cancelled. Nothing was removed.
    echo.
    pause
    exit /b 0
)

echo.

REM Step 1: Remove VTV Agent directory
if exist "%VTV_DIR%" (
    echo  [i] Removing VTV Agent config...
    rmdir /s /q "%VTV_DIR%"
    echo  [OK] Removed %VTV_DIR%
) else (
    echo  [--] VTV Agent directory not found, skipping
)

REM Step 2: Uninstall Claude-Mem
where npx >nul 2>&1
if %errorlevel% equ 0 (
    echo  [i] Uninstalling Claude-Mem...
    call npx claude-mem uninstall 2>nul
    if %errorlevel% equ 0 (
        echo  [OK] Claude-Mem plugin removed
    ) else (
        echo  [i] Claude-Mem plugin may already be removed
    )
) else (
    echo  [--] npx not found, skipping Claude-Mem uninstall
)

REM Step 3: Remove Claude-Mem database
if exist "%USERPROFILE%\.claude-mem" (
    echo  [i] Removing Claude-Mem database...
    rmdir /s /q "%USERPROFILE%\.claude-mem"
    echo  [OK] Removed Claude-Mem data
) else (
    echo  [--] Claude-Mem data directory not found, skipping
)

REM Step 4: Clean up Claude plugins directory if claude-mem is there
if exist "%USERPROFILE%\.claude\plugins\marketplaces\thedotmack" (
    echo  [i] Removing Claude-Mem plugin files...
    rmdir /s /q "%USERPROFILE%\.claude\plugins\marketplaces\thedotmack"
    echo  [OK] Removed plugin files
)

echo.
echo  ============================================
echo   Uninstall complete
echo  ============================================
echo.
echo  Everything has been removed. Your VTV account
echo  and assessment data are still safe online.
echo.
echo  To reinstall later, download the installer from:
echo    https://assessment.valuetovictory.com/agent-dashboard
echo.
pause
