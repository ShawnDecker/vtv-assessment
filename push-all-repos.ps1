# Push All Unprotected Repos to Private GitHub Remotes
# Run this on your CURRENT computer (the one with the repos)
# Requires: gh cli (GitHub CLI) — install with: winget install GitHub.cli
# Then authenticate: gh auth login

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Yellow
Write-Host "   PUSH UNPROTECTED REPOS TO GITHUB (PRIVATE)" -ForegroundColor Yellow
Write-Host "  ============================================" -ForegroundColor Yellow
Write-Host ""

# Check gh cli
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "  [!] GitHub CLI not found. Installing..." -ForegroundColor Red
    winget install GitHub.cli --accept-package-agreements --accept-source-agreements
    Write-Host "  [!] Close and reopen PowerShell, then run: gh auth login" -ForegroundColor Red
    Write-Host "  [!] Then re-run this script." -ForegroundColor Red
    pause
    exit 1
}

# Check auth
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [!] Not logged into GitHub. Running: gh auth login" -ForegroundColor Red
    gh auth login
}

$githubUser = (gh api user --jq '.login') 2>$null
if (-not $githubUser) {
    Write-Host "  [!] Could not get GitHub username. Run: gh auth login" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "  [OK] GitHub user: $githubUser" -ForegroundColor Green
Write-Host ""

# Repos to push — update paths to match your machine
$repos = @(
    @{ Path = "$env:USERPROFILE\OneDrive\Desktop\Zillion\ValueToVictory"; Name = "ValueToVictory-vault" },
    @{ Path = "$env:USERPROFILE\OneDrive\Desktop\Zillion\sportseta-pitch"; Name = "sportseta-pitch" },
    @{ Path = "$env:USERPROFILE\OneDrive\Desktop\Zillion\sandi-system-engine"; Name = "sandi-system-engine" },
    @{ Path = "$env:USERPROFILE\OneDrive\Desktop\Zillion\sandi-aldridge-system"; Name = "sandi-aldridge-system" },
    @{ Path = "$env:USERPROFILE\OneDrive\Desktop\Zillion\knotright-pitch"; Name = "knotright-pitch" },
    @{ Path = "$env:USERPROFILE\OneDrive\Desktop\Zillion\my-new-project"; Name = "my-new-project" },
    @{ Path = "$env:USERPROFILE\OneDrive\Desktop\Zillion\carna-toolkit"; Name = "carna-toolkit" },
    @{ Path = "$env:USERPROFILE\OneDrive\Desktop\Zillion\righteous-connections"; Name = "righteous-connections" },
    @{ Path = "$env:USERPROFILE\OneDrive\Desktop\Zillion\shoaf-analysis"; Name = "shoaf-analysis" },
    @{ Path = "$env:USERPROFILE\OneDrive\Desktop\Zillion\value-to-victory"; Name = "value-to-victory" },
    @{ Path = "$env:USERPROFILE\OneDrive\Desktop\Zillion\valuetovictory-saas"; Name = "valuetovictory-saas" }
)

$pushed = 0
$failed = 0
$skipped = 0

foreach ($repo in $repos) {
    $path = $repo.Path
    $name = $repo.Name

    Write-Host "  [$name]" -ForegroundColor Cyan

    # Check if path exists
    if (-not (Test-Path $path)) {
        # Try alternate locations
        $altPaths = @(
            "$env:USERPROFILE\Desktop\Zillion\$name",
            "$env:USERPROFILE\OneDrive\Zillion\$name",
            "$env:USERPROFILE\Documents\Zillion\$name",
            "$env:USERPROFILE\$name"
        )
        $found = $false
        foreach ($alt in $altPaths) {
            if (Test-Path $alt) {
                $path = $alt
                $found = $true
                break
            }
        }
        if (-not $found) {
            Write-Host "    [SKIP] Path not found: $($repo.Path)" -ForegroundColor Yellow
            $skipped++
            continue
        }
    }

    # Check if it's a git repo
    if (-not (Test-Path "$path\.git")) {
        Write-Host "    [SKIP] Not a git repo" -ForegroundColor Yellow
        $skipped++
        continue
    }

    Push-Location $path

    # Check if remote already exists
    $remotes = git remote -v 2>$null
    $hasOrigin = $remotes | Select-String "origin"

    if ($hasOrigin) {
        Write-Host "    [i] Remote already exists — pushing" -ForegroundColor Gray
    } else {
        # Create private repo on GitHub
        Write-Host "    [i] Creating private repo: $githubUser/$name" -ForegroundColor Gray
        gh repo create $name --private --source=. --push 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    [OK] Created and pushed" -ForegroundColor Green
            $pushed++
            Pop-Location
            continue
        } else {
            # Repo might already exist on GitHub, just add remote
            git remote add origin "https://github.com/$githubUser/$name.git" 2>$null
        }
    }

    # Stage all changes
    $dirty = git status --short 2>$null
    if ($dirty) {
        $dirtyCount = ($dirty | Measure-Object).Count
        Write-Host "    [i] Staging $dirtyCount dirty files" -ForegroundColor Gray
        git add -A 2>$null
        git commit -m "Backup: push to GitHub remote before machine migration" 2>$null
    }

    # Get current branch
    $branch = git branch --show-current 2>$null
    if (-not $branch) { $branch = "main" }

    # Push
    git push -u origin $branch 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    [OK] Pushed to github.com/$githubUser/$name ($branch)" -ForegroundColor Green
        $pushed++
    } else {
        # Try force push if branch doesn't exist upstream
        git push -u origin $branch --force 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    [OK] Force-pushed to github.com/$githubUser/$name ($branch)" -ForegroundColor Green
            $pushed++
        } else {
            Write-Host "    [FAIL] Could not push. Check manually." -ForegroundColor Red
            $failed++
        }
    }

    Pop-Location
}

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Yellow
Write-Host "   RESULTS" -ForegroundColor Yellow
Write-Host "  ============================================" -ForegroundColor Yellow
Write-Host "    Pushed:  $pushed" -ForegroundColor Green
Write-Host "    Skipped: $skipped" -ForegroundColor Yellow
Write-Host "    Failed:  $failed" -ForegroundColor Red
Write-Host ""
Write-Host "  All repos are now backed up to private GitHub repos." -ForegroundColor Green
Write-Host "  They are safe even if OneDrive fails." -ForegroundColor Green
Write-Host ""

# Verify
Write-Host "  Your GitHub repos:" -ForegroundColor Cyan
gh repo list --limit 20 --json name,visibility --jq '.[] | "    " + .name + " (" + .visibility + ")"'
Write-Host ""
pause
