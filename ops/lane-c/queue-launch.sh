# Usage: queue-launch.sh <name> <agent> <worktree> <prompt-file>. Retries launch.ps1 every 60 s until the planner cap allows it.
S="$(cd "$(dirname "$0")" && pwd)"; H="${LANE_C_HOME:-D:/ATLAS-lane-c}"
until out=$(powershell.exe -NoProfile -File "$(cygpath -w $S/launch.ps1)" -Name "$1" -Agent "$2" -Dir "$(cygpath -w "$3")" -Prompt "$(cat "$4")" 2>&1) && echo "$out" | grep -q "PID"; do sleep 60; done
echo "$out" | tail -1
