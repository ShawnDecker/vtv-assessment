@echo off
REM ============================================================
REM  Value to Victory — Skill Installer (Windows)
REM  Downloads and installs the VTV team skill for Claude Code
REM  No admin required. Just double-click.
REM ============================================================
title VTV Skill Installer
color 0A
echo.
echo  ============================================
echo   VALUE TO VICTORY - Skill Installer
echo  ============================================
echo.

REM Check for Claude Code
where claude >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Claude Code doesn't appear to be installed.
    echo  [i] Install Claude Code first, then re-run this.
    echo.
    pause
    exit /b 1
)

echo  [OK] Claude Code found
echo.

REM Create skills directory
set SKILL_DIR=%USERPROFILE%\.claude\skills\vtv-team
if not exist "%SKILL_DIR%" (
    mkdir "%SKILL_DIR%"
    echo  [OK] Created skills directory
) else (
    echo  [i] Skills directory already exists, updating...
)

REM Download the skill file
echo  [i] Downloading VTV team skill...
curl -sL "https://assessment.valuetovictory.com/vtv-team-skill.md" -o "%SKILL_DIR%\SKILL.md"
if %errorlevel% neq 0 (
    echo  [!] Download failed. Check your internet connection.
    pause
    exit /b 1
)

echo  [OK] Skill installed to: %SKILL_DIR%\SKILL.md
echo.
echo  ============================================
echo   Done!
echo  ============================================
echo.
echo  The VTV team skill is now installed.
echo  Open Claude Code and type /vtv-team to use it.
echo.
echo  What you can do:
echo    - Take the VTV assessment
echo    - View your results and coaching
echo    - Track your growth over time
echo    - Get help with any VTV feature
echo.
pause
