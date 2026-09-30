#!/usr/bin/env bash
# Every 2 min: reap planner shell calls older than 20 min. Runs forever; never exits on its own.
S="$(cd "$(dirname "$0")" && pwd)"; H="${LANE_C_HOME:-D:/ATLAS-lane-c}"
while true; do powershell -NoProfile -ExecutionPolicy Bypass -File "$S/reaper.ps1" -Min 20 2>&1 | tail -5; sleep 120; done
