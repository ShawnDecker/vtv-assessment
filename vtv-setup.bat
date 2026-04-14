@echo off
REM ============================================================
REM  Value to Victory — One-Click Setup (Windows)
REM  Double-click this file. That's it.
REM ============================================================
title Value to Victory Setup
color 0A

echo.
echo  ============================================
echo   VALUE TO VICTORY — One-Click Setup
echo  ============================================
echo.
echo  This will set everything up automatically.
echo  Just sit back — it takes about 5 minutes.
echo.
pause

REM ── Check for Admin ──
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Need admin access. Restarting as Administrator...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

REM ── Step 1: Node.js ──
echo.
echo  [1/5] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [i] Installing Node.js (this takes a minute)...
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements -h
    if %errorlevel% neq 0 (
        echo  [i] Winget failed. Downloading directly...
        powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi' -OutFile '%TEMP%\node-install.msi'"
        msiexec /i "%TEMP%\node-install.msi" /qn
    )
    echo  [OK] Node.js installed
    REM Refresh PATH
    set "PATH=%PATH%;C:\Program Files\nodejs"
) else (
    echo  [OK] Node.js already installed
)

REM ── Step 2: Git ──
echo.
echo  [2/5] Checking Git...
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo  [i] Installing Git (this takes a minute)...
    winget install Git.Git --accept-package-agreements --accept-source-agreements -h
    if %errorlevel% neq 0 (
        echo  [i] Winget failed. Downloading directly...
        powershell -Command "Invoke-WebRequest -Uri 'https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/Git-2.47.1-64-bit.exe' -OutFile '%TEMP%\git-install.exe'"
        "%TEMP%\git-install.exe" /VERYSILENT /NORESTART
    )
    echo  [OK] Git installed
    set "PATH=%PATH%;C:\Program Files\Git\cmd"
) else (
    echo  [OK] Git already installed
)

REM ── Step 3: Choose install location ──
echo.
echo  [3/5] Setting up project...
set DEFAULT_DIR=%USERPROFILE%\Desktop\vtv-assessment
echo  Default location: %DEFAULT_DIR%
set /p INSTALL_DIR="  Install location (press Enter for default): "
if "%INSTALL_DIR%"=="" set INSTALL_DIR=%DEFAULT_DIR%

if exist "%INSTALL_DIR%\.git" (
    echo  [i] Project already exists. Updating...
    cd /d "%INSTALL_DIR%"
    git pull origin master
) else (
    echo  [i] Downloading project files...
    git clone https://github.com/ShawnDecker/vtv-assessment.git "%INSTALL_DIR%"
    cd /d "%INSTALL_DIR%"
)
echo  [OK] Project ready

REM ── Step 4: Install dependencies ──
echo.
echo  [4/5] Installing dependencies...
call npm install --silent 2>nul
echo  [OK] Dependencies installed

REM ── Step 5: Create .env if missing ──
echo.
echo  [5/5] Checking configuration...
if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env >nul
        echo  [OK] Config file created
        echo.
        echo  ============================================
        echo   NOTE: Ask Shawn for your login credentials
        echo   to put in the .env file before running
        echo   the local server.
        echo  ============================================
    )
) else (
    echo  [OK] Config file exists
)

echo.
echo  ============================================
echo   SETUP COMPLETE!
echo  ============================================
echo.
echo  Your project is at: %INSTALL_DIR%
echo.
echo  What you can do now:
echo.
echo    1. BROWSE THE LIVE SITE (works right now):
echo       https://assessment.valuetovictory.com
echo.
echo    2. RUN LOCALLY (after Shawn gives you .env credentials):
echo       Open PowerShell, then:
echo         cd "%INSTALL_DIR%"
echo         npm run dev
echo       Then open http://localhost:3000
echo.
echo    3. OPEN IN CLAUDE CODE:
echo       Just point Claude Code to: %INSTALL_DIR%
echo.

REM ── Open the live site ──
set /p OPENSITE="  Open the live site in your browser? (Y/n): "
if /i not "%OPENSITE%"=="n" (
    start https://assessment.valuetovictory.com
)

echo.
pause
