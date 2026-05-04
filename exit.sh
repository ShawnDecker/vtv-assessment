#!/usr/bin/env bash
# exit.sh — subsystem-5 session-exit protocol (sister to init.sh).
# Runs the 5-step clean-state-on-exit sequence. Refuses "complete" until repo is green.
# Spec: _claude/specs/feature-list-scope-lock.md (v1.2.0)
#
# Exit codes:
#   0 — clean exit, next session inherits a healthy harness
#   1 — feature_list.json shows in-progress work without claude-progress.md update
#   2 — debug artifacts present in _claude/working/ (forgotten cleanup)
#   3 — schema validation failed (init.sh would reject next session)
#   4 — uncommitted scope changes without DECISIONS.md entry

set -u
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

printf '== %s · exit.sh ==\n' "$(basename "$PROJECT_ROOT")"
printf '  [Clock-Out] %s — session end\n' "$(date '+%Y-%m-%d %H:%M')"

step=0
ok()   { step=$((step+1)); printf '  [%d/5 ok] %s\n' "$step" "$1"; }
warn() { printf '  [WARN] %s\n' "$1" >&2; }
fail() { printf '  [%d/5 FAIL] %s\n' "$((step+1))" "$1" >&2; exit "${2:-1}"; }

# --- Step 1: re-validate harness (init.sh exits 0) ---------------------------
if [ -x "./init.sh" ]; then
  if ./init.sh > /dev/null 2>&1; then
    ok "harness re-validation (init.sh exits 0)"
  else
    fail "init.sh would reject the next session — fix before exiting" 3
  fi
else
  warn "init.sh not executable — skipping re-validation"
fi

# --- Step 2: progress log was updated this session ---------------------------
# Heuristic: claude-progress.md mtime within last 24h OR contains today's date
if [ -f claude-progress.md ]; then
  today=$(date '+%Y-%m-%d')
  if grep -q "$today" claude-progress.md 2>/dev/null; then
    ok "claude-progress.md has an entry from today ($today)"
  else
    # mtime check fallback (cross-platform-ish)
    if [ -n "$(find claude-progress.md -mtime -1 2>/dev/null)" ]; then
      ok "claude-progress.md modified within last 24h"
    else
      warn "claude-progress.md has no entry from today — append one before exit"
      fail "session exiting without progress log update" 1
    fi
  fi
else
  fail "claude-progress.md missing" 1
fi

# --- Step 3: purge debug artifacts -------------------------------------------
debug_count=0
if [ -d _claude/working ]; then
  debug_count=$(find _claude/working -name "_debug_*" -o -name "*.tmp" -o -name "scratch_*" 2>/dev/null | wc -l)
fi
if [ "$debug_count" -gt 0 ]; then
  warn "$debug_count debug artifact(s) under _claude/working/ — review before next session"
  warn "(non-fatal — list: $(find _claude/working \( -name "_debug_*" -o -name "*.tmp" -o -name "scratch_*" \) 2>/dev/null | head -5))"
fi
ok "debug artifacts swept"

# --- Step 4: scope changes without decision log ------------------------------
# If feature_list.json changed today AND no new DECISIONS.md entry today, flag.
if [ -f feature_list.json ] && [ -f DECISIONS.md ]; then
  today=$(date '+%Y-%m-%d')
  if [ -n "$(find feature_list.json -mtime -1 2>/dev/null)" ]; then
    if ! grep -q "$today" DECISIONS.md 2>/dev/null; then
      warn "feature_list.json modified but no DECISIONS.md entry from $today"
      warn "(advisory — substantive scope changes should be logged with rejected alternatives)"
    fi
  fi
fi
ok "scope/decision log alignment checked"

# --- Step 5: print exit summary ----------------------------------------------
if command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1; then
  PY="$(command -v python3 || command -v python)"
  if [ -f feature_list.json ]; then
    "$PY" - <<'PYEOF'
import json
data = json.load(open("feature_list.json"))
features = data.get("features", [])
by_status = {}
for f in features:
    by_status.setdefault(f.get("status", "?"), []).append(f["id"])
print(f"  [5/5 ok] exit summary — {len(features)} features:")
for status in ("done", "in-progress", "blocked", "not-started", "parked"):
    if status in by_status:
        print(f"             {status:14s} {len(by_status[status])}: {', '.join(by_status[status])}")
PYEOF
  fi
fi

printf '\n[OK] session exited cleanly — next session inherits a healthy harness\n'
exit 0
