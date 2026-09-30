#!/usr/bin/env bash
# Wait for a detached launch to exit (by its cmd.exe PID), then print the log tail. Re-arm after any Claude crash.
RUNS="${LANE_C_HOME:-D:/ATLAS-lane-c}/runs"
for N in "$@"; do :; done
while :; do
  alive=0
  for N in "$@"; do [ -s "$RUNS/$N.pid" ] || { alive=1; continue; }; P=$(tr -d '\r\n' < "$RUNS/$N.pid"); tasklist //FI "PID eq $P" //FI "IMAGENAME eq cmd.exe" 2>/dev/null | grep -q " $P " && alive=1 || { echo "EXITED $N"; tail -c 2500 "$RUNS/$N.log"; exit 0; }; done
  sleep 60
done
