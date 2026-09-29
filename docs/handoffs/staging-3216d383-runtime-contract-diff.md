# Preserved diff: `ops/runtime/runtime-contract.json` in `E:\ATLAS-staging\3216d383ce033a3447067255bbe554910fb78595`

Captured by Lane A4 on 2026-09-29 immediately before retiring that staging release directory, per the operator
instruction to preserve the one modified file. Train 9 is verified live at `e75d6b8f` (see "A4 LIVE at
`e75d6b8f`"), so this directory is no longer a rollback basis.

**This is a GENERATED artifact, not human work.** `ops/staging/deploy-staging.ps1` installs the staging contract
into every staging release directory; `ops/runtime/cli.mjs` resolves its contract from the deployed source
directory, which is what gives staging its own port pair without touching the live contract. The file's own
`$comment` ends with "Never copy this file into the live release directory." It is reproducible by re-running the
staging deploy, and it is **not** evidence of unreviewed source drift.

The directory was a **registered linked worktree** (detached HEAD `3216d383`), retired with `git worktree remove`
(non-forced) after this diff was captured and the file restored; no branch or ref was deleted.

## Diff (`git diff -- ops/runtime/runtime-contract.json`)
diff --git a/ops/runtime/runtime-contract.json b/ops/runtime/runtime-contract.json
index 1edfd542..732ca514 100644
--- a/ops/runtime/runtime-contract.json
+++ b/ops/runtime/runtime-contract.json
@@ -1,14 +1,14 @@
 {
-  "$comment": "Immutable, reviewed runtime-supervision contract for ATLAS on a Windows host. Contains no secrets, no machine usernames, no database URLs, and no worktree-only transient paths. `productPin` is the reviewed ANCESTOR milestone that the deployed HEAD must descend from; the operator-declared exact installed HEAD is supplied through ATLAS_RUNTIME_RELEASE_SHA. Operators supply durable environment paths through process environment variables referenced below; the supervisor never copies or prints secret values.",
+  "$comment": "STAGING runtime contract (Lane A4, 2026-09-28). This is the reviewed runtime-supervision contract with ONLY the port pair and the stream/label changed, so the staging runtime is structurally identical to live and bound to a disjoint port pair. `ops/runtime/cli.mjs` resolves its contract from the DEPLOYED SOURCE DIRECTORY, so installing this file into a staging release directory gives staging its own contract without any change to the live contract in the live release directory. Product pin, invariants, environment reference, upstream, logs, supervision and the legacy-task inventory are copied verbatim from ops/runtime/runtime-contract.json so staging cannot drift into a weaker supervision model. Never copy this file into the live release directory.",
   "contractVersion": 1,
-  "stream": "RUNTIME-SUPERVISION-C01",
+  "stream": "RUNTIME-SUPERVISION-STAGING-C01",
   "productPin": "d44f29e04d359ad9b18e4443b0fd4fed1daeaecd",
-  "releaseLabel": "atlas-d44f29e0",
+  "releaseLabel": "atlas-staging",
   "serverEntry": "atlas-server/dist/server.js",
   "clientDist": "atlas-client/dist",
   "ports": {
-    "server": 5001,
-    "client": 5174
+    "server": 5101,
+    "client": 5274
   },
   "invariants": {
     "ROLLOVER_AUTO_SYNC_ENABLED": "false",
