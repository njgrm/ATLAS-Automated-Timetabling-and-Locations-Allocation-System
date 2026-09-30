#!/usr/bin/env bash
# Lane C planner status: one line per detached run + :4097 busy sessions + live/staging health. Read-only.
S="$(cd "$(dirname "$0")" && pwd)"; H="${LANE_C_HOME:-D:/ATLAS-lane-c}"
RUNS="${LANE_C_HOME:-D:/ATLAS-lane-c}/runs"
echo "== $(date '+%Y-%m-%d %H:%M') planner runs (newest first)"
for L in $(ls -t "$RUNS"/*.log | head -8); do
  N=$(basename "$L" .log); P=$(tr -d '\r\n' < "$RUNS/$N.pid" 2>/dev/null)
  # PID must still be the launcher cmd.exe (Windows reuses PIDs: a4-train3-stg2 read RUNNING for 40 min as a conhost.exe)
  A=$(tasklist //FI "PID eq $P" //FI "IMAGENAME eq cmd.exe" 2>/dev/null | grep -c " $P ")
  AGE=$(( ( $(date +%s) - $(date -r "$L" +%s) ) / 60 ))
  printf '%-10s %-7s log-idle %4smin | %s\n' "$N" "$([ "$A" = 1 ] && echo RUNNING || { [ -s "$L" ] && echo EXITED || echo DIED-EMPTY; })" "$AGE" "$(tail -c 300 "$L" | tr '\n\r' '  ' | sed 's/\x1b\[[0-9;]*m//g' | tail -c 140)"
done
echo "== stuck dev servers (>10 min, not live/staging):"; powershell -NoProfile -ExecutionPolicy Bypass -File "$S/stuck.ps1" 2>/dev/null || true
echo "== :4097 (retired 2026-09-30; releases use ops/runtime/release): $(curl -s -m 5 http://127.0.0.1:4097/session/status >/dev/null && echo "STILL RUNNING - close it" || echo off)"
echo "== root checkout: $(bash $S/rootchk.sh)"
echo "== live data: $(node $S/datainv.cjs 2>&1)"
echo "== live /api/v1/health: $(curl -s -m 10 -o /dev/null -w '%{http_code}' https://njgrm.buru-degree.ts.net/api/v1/health) · staging: $(curl -s -m 10 -o /dev/null -w '%{http_code}' http://127.0.0.1:5101/api/v1/health)"
# 30 Sep 06:50: QA-passed work sat unmerged for hours unnoticed. List pushed work branches not on main (last 12 h).
echo "== unmerged work branches (12h):"; git -C D:/ATLAS for-each-ref --sort=-committerdate --format='%(committerdate:unix) %(committerdate:format:%H:%M) %(refname:short)' refs/remotes/origin/work refs/remotes/origin/fix | while read t h r; do [ $(( $(date +%s) - t )) -lt 43200 ] && ! git -C D:/ATLAS merge-base --is-ancestor $r origin/main && echo "  $h $r"; done
