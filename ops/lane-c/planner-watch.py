# Planner watcher (Lane C). Args: root session ids to track (optional). Every 60 s poll the :4097 server.
# Exit with one line when: a tracked root's tree is no longer busy (DONE), any busy tree has had no update for
# >= 30 min (STALE), or the server fails 3 times in a row (WATCHER_ERROR). Silent otherwise.
import json, time, urllib.request, sys
BASE = "http://127.0.0.1:4097"
STALE_MIN, PERIOD = 30, 60
tracked = set(sys.argv[1:])
errs = 0
while True:
    try:
        sessions = json.load(urllib.request.urlopen(BASE + "/session", timeout=15))
        busy = json.load(urllib.request.urlopen(BASE + "/session/status", timeout=15))
        errs = 0
        by_id = {s["id"]: s for s in sessions}
        def root(s):
            while s.get("parentID") and s["parentID"] in by_id:
                s = by_id[s["parentID"]]
            return s
        now = time.time() * 1000
        busy_roots = {root(by_id[b])["id"] for b in busy if b in by_id}
        for rid in list(tracked):
            if rid not in busy_roots:
                t = by_id.get(rid, {}).get("title", "?")
                print(f"DONE root={rid} '{t[:60]}'", flush=True)
                sys.exit(0)
        for rid in busy_roots:
            tree = [s for s in sessions if root(s)["id"] == rid]
            last = max(tree, key=lambda s: s["time"]["updated"])
            idle = (now - last["time"]["updated"]) / 60000
            if idle >= STALE_MIN:
                print(f"STALE {int(idle)}min root={rid} '{by_id[rid]['title'][:50]}' "
                      f"last-active={last['id']} '{last['title'][:60]}'", flush=True)
                sys.exit(0)
    except SystemExit:
        raise
    except Exception as e:
        errs += 1
        if errs >= 3:
            print(f"WATCHER_ERROR x3: {e}", flush=True)
            sys.exit(1)
    time.sleep(PERIOD)
