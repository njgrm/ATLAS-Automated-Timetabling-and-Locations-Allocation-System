#!/usr/bin/env bash
# Lane C in-session heartbeat: every 15 min run status.sh; EXIT (which notifies Lane C) only on ACTION.
# Replaces reliance on the scheduled task's completion notifications, which ran OK but never reached the session (2026-09-29).
S="$(cd "$(dirname "$0")" && pwd)"; H="${LANE_C_HOME:-D:/ATLAS-lane-c}"
while true; do
  OUT=$(bash $S/status.sh 2>&1); A=""
  echo "$OUT" | grep -q "STUCK-SERVER" && A="$A stuck-server;"
  # Recheck after 60 s before alerting; staging is ignored while an A4 run is RUNNING (it redeploys staging).
  if ! echo "$OUT" | grep -q "live /api/v1/health: 200 · staging: 200"; then sleep 60
    L=$(curl -s -o /dev/null -m 15 -w '%{http_code}' http://127.0.0.1:5001/api/v1/health); G=$(curl -s -o /dev/null -m 15 -w '%{http_code}' http://127.0.0.1:5101/api/v1/health)
    [ "$L" = 200 ] || A="$A live-health-$L;"
    [ "$G" = 200 ] || echo "$OUT" | grep -qE "^a4-[^ ]+ +RUNNING" || A="$A staging-health-$G;"
  fi
  echo "$OUT" | grep -q "ROOT-DIRTY" && A="$A root-checkout-dirty;"
  echo "$OUT" | grep -q "DATA-BAD" && A="$A live-data-invariant;"
  echo "$OUT" | grep -q ":4097 busy: DOWN" && A="$A 4097-down;"
  HG=$(node $S/hungtool.cjs 2>&1 | grep HUNG); [ -n "$HG" ] && A="$A $HG;"
  while read -r N ST _ IDLE _; do
    [ "$ST" = RUNNING ] && [ "${IDLE%min}" -gt 60 ] 2>/dev/null && A="$A $N idle ${IDLE};"
  done < <(echo "$OUT" | grep -E "RUNNING|EXITED" | awk '{print $1, $2, $3, $4, $5}')
  # A run that EXITED with a tool call as its last line ended without a report (A3 c15, 16:30): flag it once.
  for f in $(find $H/runs -name '*.log' -mmin -30 2>/dev/null); do n=$(basename $f .log); grep -q "^$n$" $H/.silent-seen 2>/dev/null && continue
    echo "$OUT" | grep -qE "^$n +EXITED" || continue
    tail -c 400 $f | grep -q "⚙" && { echo $n >> $H/.silent-seen; A="$A $n ended-without-report;"; }
  done
  if [ -n "$A" ]; then echo "$OUT"; echo "MONITOR: ACTION —$A"; exit 0; fi
  sleep 600
done
