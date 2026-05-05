@echo off
REM ================================================================
REM  VTV FULL SETUP — One-Click Complete Installation
REM  Right-click → Run as Administrator
REM  Installs: Git repo, Node deps, env vars, Claude skill,
REM  Claude-Mem memory, and opens all dashboards
REM ================================================================
title VTV Full Setup
color 0A
echo.
echo  =============================================
echo   VALUE TO VICTORY — Full System Setup v3.0
echo  =============================================
echo.

REM Check admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Right-click this file and Run as Administrator
    pause
    exit /b 1
)

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [i] Installing Node.js...
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo  [!] Install Node.js manually: https://nodejs.org
        pause
        exit /b 1
    )
    echo  [OK] Node.js installed. Close and re-run this script.
    pause
    exit /b 0
)
echo  [OK] Node.js: & node --version

REM Check Git
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo  [i] Installing Git...
    winget install Git.Git --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo  [!] Install Git manually: https://git-scm.com
        pause
        exit /b 1
    )
    echo  [OK] Git installed. Close and re-run this script.
    pause
    exit /b 0
)
echo  [OK] Git: & git --version

REM Check Claude Code
where claude >nul 2>&1
if %errorlevel% neq 0 (
    echo  [i] Installing Claude Code CLI...
    npm install -g @anthropic-ai/claude-code
    if %errorlevel% neq 0 (
        echo  [!] Claude Code install failed. Install manually:
        echo      npm install -g @anthropic-ai/claude-code
    ) else (
        echo  [OK] Claude Code installed
    )
) else (
    echo  [OK] Claude Code found
)
echo.

REM ========== CLONE OR UPDATE REPO ==========
set REPO_DIR=%USERPROFILE%\vtv-assessment
echo  [i] Project directory: %REPO_DIR%

if exist "%REPO_DIR%\.git" (
    echo  [i] Repo exists — pulling latest...
    cd /d "%REPO_DIR%"
    git pull origin master
    echo  [OK] Updated to latest
) else (
    echo  [i] Cloning repository...
    git clone https://github.com/ShawnDecker/vtv-assessment.git "%REPO_DIR%"
    if %errorlevel% neq 0 (
        echo  [!] Clone failed. Check your GitHub access.
        pause
        exit /b 1
    )
    cd /d "%REPO_DIR%"
    echo  [OK] Repository cloned
)
echo.

REM ========== NPM INSTALL ==========
echo  [i] Installing dependencies...
call npm install --production 2>nul
echo  [OK] Dependencies installed
echo.

REM ========== CREATE .env.local ==========
if exist "%REPO_DIR%\.env.local" (
    echo  [OK] .env.local already exists — preserving
) else (
    echo  [i] Creating .env.local with database credentials...
    (
        echo DATABASE_URL=postgresql://neondb_owner:npg_poly4EmfxG0N@ep-super-snow-amomut57-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require^&sslmode=require
        echo ADMIN_API_KEY=0aec609e52a96c54f978d4b0f4b1b4c00cf5749a55e4c8b0
        echo GMAIL_USER=valuetovictory@gmail.com
        echo PIN_SALT=_vtv_salt_2026
    ) > "%REPO_DIR%\.env.local"
    echo  [OK] .env.local created
    echo.
    echo  !! IMPORTANT: You still need to add these from Vercel:
    echo     JWT_SECRET=
    echo     GMAIL_APP_PASSWORD=
    echo     STRIPE_SECRET_KEY=
    echo     Open: https://vercel.com/dashboard ^> Settings ^> Env Vars
)
echo.

REM ========== VTV SKILL INSTALL ==========
set SKILL_DIR=%USERPROFILE%\.claude\skills\vtv-team
if exist "%SKILL_DIR%\SKILL.md" (
    echo  [OK] VTV Team Skill already installed — upgrading
)
if not exist "%SKILL_DIR%" mkdir "%SKILL_DIR%"
copy /Y "%REPO_DIR%\vtv-team-skill.md" "%SKILL_DIR%\SKILL.md" >nul
echo  [OK] VTV Team Skill installed to %SKILL_DIR%
echo.

REM ========== CLAUDE.md ==========
if not exist "%USERPROFILE%\.claude" mkdir "%USERPROFILE%\.claude"
echo  [OK] Claude config directory ready
echo.

REM ========== CLAUDE-MEM INSTALL ==========
if exist "%USERPROFILE%\.claude-mem" (
    echo  [OK] Claude-Mem already installed — memories preserved
) else (
    echo  [i] Installing Claude-Mem (persistent memory)...
    call npx claude-mem install
    if %errorlevel% equ 0 (
        echo  [OK] Claude-Mem installed
    ) else (
        echo  [!] Claude-Mem had issues. Retry later: npx claude-mem install
    )
)
echo.

REM ========== VTV AGENT FOLDER ==========
set AGENT_DIR=%USERPROFILE%\vtv-agent
if not exist "%AGENT_DIR%" mkdir "%AGENT_DIR%"

REM Download latest health check script
curl -sO https://assessment.valuetovictory.com/vtv-team-installer.js 2>nul
if exist vtv-team-installer.js (
    move /Y vtv-team-installer.js "%AGENT_DIR%\" >nul
)

REM Create/update config
if not exist "%AGENT_DIR%\vtv-config.json" (
    (
        echo {
        echo   "version": "3.0",
        echo   "installed": "%date% %time%",
        echo   "email": "valuetovictory@gmail.com",
        echo   "dashboard": "https://assessment.valuetovictory.com/agent-dashboard",
        echo   "remote": "https://assessment.valuetovictory.com/remote",
        echo   "admin": "https://assessment.valuetovictory.com/admin/contacts",
        echo   "repo": "%REPO_DIR%"
        echo }
    ) > "%AGENT_DIR%\vtv-config.json"
    echo  [OK] VTV Agent config created
) else (
    echo  [OK] VTV Agent config preserved
)
echo.

REM ========== SUMMARY ==========
echo  =============================================
echo   SETUP COMPLETE
echo  =============================================
echo.
echo  Installed:
echo    [x] Git repository      %REPO_DIR%
echo    [x] Node dependencies   npm packages
echo    [x] Environment vars    .env.local
echo    [x] VTV Team Skill      ~/.claude/skills/vtv-team/
echo    [x] Claude-Mem          persistent memory
echo    [x] VTV Agent config    ~/vtv-agent/
echo.
echo  Your Links:
echo    Remote Control:   https://assessment.valuetovictory.com/remote
echo    Admin Dashboard:  https://assessment.valuetovictory.com/admin/contacts
echo    Agent Dashboard:  https://assessment.valuetovictory.com/agent-dashboard
echo    Member Portal:    https://assessment.valuetovictory.com/member
echo.
echo  API Key: 0aec609e52a96c54f978d4b0f4b1b4c00cf5749a55e4c8b0
echo  PIN:     8887
echo.
echo  To start Claude Code:
echo    cd %REPO_DIR%
echo    claude
echo.

REM Open dashboards
set /p OPEN="  Open dashboards in browser? (Y/n): "
if /i not "%OPEN%"=="n" (
    start https://assessment.valuetovictory.com/remote
    start https://assessment.valuetovictory.com/agent-dashboard
)
echo.
pause
