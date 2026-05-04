#!/usr/bin/env bash
# init.sh — subsystem 5 (lifecycle) health gate.
# Refuses agent work if the harness is incomplete. Spec: _claude/specs/feature-list-scope-lock.md
#
# Exit codes:
#   0 — harness healthy, agent may begin work
#   1 — schema validation failed
#   2 — required harness file missing
#   3 — WIP=1 violated (multiple features in-progress)
#   4 — environment dependency missing (python, jsonschema)
#   5 — cross-field validation failed (tier, id uniqueness)
#
# Override env vars:
#   VTV_HARNESS_WIP_ADVISORY=1   — downgrade WIP=1 hard-fail to warning (multi-track creators)
#   VTV_HARNESS_SPEC=/path/...   — locate the shared schema file

set -u
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# --- locate schema -----------------------------------------------------------
SCHEMA_PATH=""
for candidate in \
  "./_claude/specs/feature_list.schema.json" \
  "${VTV_HARNESS_SPEC:-}/feature_list.schema.json" \
  "../_claude/specs/feature_list.schema.json" \
  "../../_claude/specs/feature_list.schema.json"
do
  if [ -n "$candidate" ] && [ -f "$candidate" ]; then
    SCHEMA_PATH="$candidate"
    break
  fi
done

# --- check required files ----------------------------------------------------
fail=0
warn() { printf '  [WARN] %s\n' "$1" >&2; }
err()  { printf '  [FAIL] %s\n' "$1" >&2; fail=1; }

printf '== %s · init.sh ==\n' "$(basename "$PROJECT_ROOT")"
printf '  [Clock-In] %s — session start\n' "$(date '+%Y-%m-%d %H:%M')"

[ -f AGENTS.md ] || [ -f CLAUDE.md ] || err "neither AGENTS.md nor CLAUDE.md exists (subsystem 1)"
[ -f feature_list.json ] || err "feature_list.json missing (subsystem 4)"
[ -f claude-progress.md ] || warn "claude-progress.md missing (subsystem 2) — creating empty"
[ -f DECISIONS.md ] || warn "DECISIONS.md missing — creating empty (will populate on first decision)"
[ -d _claude/changelog ] || warn "_claude/changelog/ missing (subsystem 2) — creating"

# auto-create non-fatal misses
[ -f claude-progress.md ] || : > claude-progress.md
[ -f DECISIONS.md ] || : > DECISIONS.md
[ -d _claude/changelog ] || mkdir -p _claude/changelog

if [ "$fail" -ne 0 ]; then
  printf '\n[FAIL] required files missing — see _claude/specs/feature-list-scope-lock.md\n' >&2
  exit 2
fi

# --- validate schema ---------------------------------------------------------
if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then
  err "python not on PATH — cannot validate feature_list.json"
  exit 4
fi
PY="$(command -v python3 || command -v python)"

if [ -z "$SCHEMA_PATH" ]; then
  warn "feature_list.schema.json not found in any candidate path — schema validation SKIPPED"
  warn "set VTV_HARNESS_SPEC env var or copy schema to ./_claude/specs/"
else
  printf '  [ ok ] schema:   %s\n' "$SCHEMA_PATH"
  WIP_ADVISORY="${VTV_HARNESS_WIP_ADVISORY:-0}"
  export WIP_ADVISORY SCHEMA_PATH
  "$PY" - <<'PYEOF'
import json, os, sys
try:
    import jsonschema
except ImportError:
    sys.stderr.write("  [FAIL] python jsonschema package not installed (pip install jsonschema)\n")
    sys.exit(4)

schema_path = os.environ["SCHEMA_PATH"]
schema = json.load(open(schema_path))
data = json.load(open("feature_list.json"))

# 1. Schema validation
try:
    jsonschema.validate(data, schema)
    print("  [ ok ] feature_list.json validates against schema")
except jsonschema.ValidationError as e:
    sys.stderr.write(f"  [FAIL] schema violation: {e.message} at {list(e.absolute_path)}\n")
    sys.exit(1)

features = data.get("features", [])
tiers = data.get("tiers", [])

# 2. Cross-field: feature.tier must reference an entry in tiers[]
valid_tier_ids = {t["id"] for t in tiers}
bad_tier = [f["id"] for f in features if f.get("tier") and f["tier"] not in valid_tier_ids]
if bad_tier:
    sys.stderr.write(f"  [FAIL] tier integrity: features reference unknown tier ids: {bad_tier}\n")
    sys.exit(5)
print(f"  [ ok ] tier integrity:   all {len(features)} features reference valid tier ids")

# 3. Cross-field: feature ids must be unique
ids = [f["id"] for f in features]
seen, dupes = set(), []
for fid in ids:
    if fid in seen:
        dupes.append(fid)
    seen.add(fid)
if dupes:
    sys.stderr.write(f"  [FAIL] id uniqueness:    duplicate feature ids: {dupes}\n")
    sys.exit(5)
print(f"  [ ok ] id uniqueness:    no duplicate feature ids")

# 4. acceptance_cmd[] length parity (when present)
parity_bad = []
for f in features:
    if f.get("acceptance_cmd") is not None:
        if len(f["acceptance_cmd"]) != len(f.get("acceptance", [])):
            parity_bad.append(f["id"])
if parity_bad:
    sys.stderr.write(f"  [FAIL] acceptance_cmd[] length must equal acceptance[] for: {parity_bad}\n")
    sys.exit(5)

# 5. Status counts + active scope print (Clock-In)
by_status = {}
for f in features:
    by_status.setdefault(f.get("status", "?"), []).append(f["id"])
print(f"  [ ok ] features: {len(features)} total")
for status in ("in-progress", "not-started", "blocked", "parked", "done"):
    if status in by_status:
        print(f"           {status:14s} {len(by_status[status])}: {', '.join(by_status[status])}")

# 6. WIP=1 enforcement
in_progress = by_status.get("in-progress", [])
advisory = os.environ.get("WIP_ADVISORY", "0") == "1"
if len(in_progress) > 1:
    msg = f"WIP=1 violated — {len(in_progress)} features in-progress: {', '.join(in_progress)}"
    if advisory:
        sys.stderr.write(f"  [WARN] {msg} (advisory mode — multi-track creator)\n")
    else:
        sys.stderr.write(f"  [FAIL] {msg}\n")
        sys.stderr.write(f"           pick one to keep in-progress; flip the others to not-started or blocked\n")
        sys.stderr.write(f"           OR export VTV_HARNESS_WIP_ADVISORY=1 if multi-track is intentional\n")
        sys.exit(3)
elif len(in_progress) == 1:
    print(f"  [ ok ] WIP=1 enforced — 1 feature in-progress")
else:
    print(f"  [ ok ] WIP=1 — no features in-progress (idle harness)")

# 7. VCR (Verified Completion Rate)
done_count = len(by_status.get("done", []))
activated = done_count + len(in_progress) + len(by_status.get("blocked", []))
if activated > 0:
    vcr = (done_count / activated) * 100
    print(f"  [ ok ] VCR: {done_count}/{activated} = {vcr:.0f}% (verified completion rate)")
else:
    print(f"  [ ok ] VCR: 0/0 = n/a (no activated features yet)")
PYEOF
  rc=$?
  if [ "$rc" -ne 0 ]; then exit "$rc"; fi
fi

# --- summary -----------------------------------------------------------------
printf '\n[OK] harness healthy — agent may begin work\n'
exit 0
