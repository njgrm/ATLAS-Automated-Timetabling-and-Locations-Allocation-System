#!/usr/bin/env bash
# Lane C dispatch wrapper. Usage: dispatch.sh <elevated|local> "<prompt>"
# Always closes stdin; for elevated (:4097 attach) runs, also watches the new root session so a hung client
# cannot swallow the wake-up. Prints the final text of the root session when it ends.
set -u
MODE=$1; PROMPT=$2; SP="$(cd "$(dirname "$0")" && pwd)"; H="${LANE_C_HOME:-D:/ATLAS-lane-c}"
cd D:/ATLAS && git pull -q --ff-only
if [ "$MODE" = local ]; then
  opencode run --dir 'D:\ATLAS' --agent atlas-planner "$PROMPT" < /dev/null; exit $?
fi
T0=$(python -c "import time;print(int(time.time()*1000))")
env -u OPENCODE_SERVER_PASSWORD opencode run --attach http://127.0.0.1:4097 --dir 'D:\ATLAS' --agent atlas-planner "$PROMPT" < /dev/null > "$H/last-attach.log" 2>&1 &
for i in $(seq 1 60); do
  R=$(curl -s http://127.0.0.1:4097/session | python -c "
import json,sys
s=json.load(sys.stdin); r=[x for x in s if not x.get('parentID') and x['time']['created']>=$T0]
print(r[0]['id'] if r else '')"); [ -n "$R" ] && break; sleep 3; done
[ -z "$R" ] && { echo "DISPATCH_FAILED: no session created"; exit 1; }
echo "ROOT $R"; python "$SP/planner-watch.py" "$R"
cd D:/ATLAS && opencode export "$R" 2>/dev/null | python -c "
import json,sys
d=json.load(sys.stdin); m=[x for x in d['messages'] if x['info']['role']=='assistant'][-1]
print('\n'.join(p.get('text','') for p in m['parts'] if p['type']=='text')[-2500:])"
