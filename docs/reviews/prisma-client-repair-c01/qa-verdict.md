# PRISMA-CLIENT-REPAIR-C01 — independent post-action QA verdict

- QA task: `ses_f43885d5dfferykWrteIu52ykn` (agent `atlas-qa-dsflashv4`, model
  `opencode-go/deepseek-v4-flash`)
- Date: 2026-09-20
- Range reviewed: `811aff6f...b63b4a12` (branch `work/prisma-repair-c01`)
- Packet: `docs/prompts/prisma-client-repair-c01-2026-09-20.md` at `584f0699`
- Executor evidence: `docs/reviews/prisma-client-repair-c01/evidence.md` at
  `b63b4a12`
- **Verdict: `ACCEPT_READY` — mandatory 8 passed / 8, blocked 0, unperformed 0.**

This capsule is the durable record of that verdict; the QA session's message is
not otherwise preserved.

## Independently reproduced

- **Range hygiene.** Only `docs/reviews/prisma-client-repair-c01/evidence.md`
  changed in the range; no product or test byte; `AGENTS.md` untouched; worktree
  clean with no untracked residue.
- **Equivalence gate.** Byte-stripped (`0x09 0x0A 0x0B 0x0C 0x0D 0x20`) SHA-256
  `09400d5268a2f1ec4f7a2fc8c723e8a393cef285cc7708cc791e3e91c27b38b8` equal across
  the graft source client, the target client, and the live release's working-tree
  `prisma\schema.prisma`. `prisma` and `@prisma/client` both `6.19.2`;
  `query_engine-windows.dll.node` `263946105F428384D2318DC3241B85B1C3DD98FBB1BFAC62D3E81F513AB35897`
  in both trees; `query_engine_bg.js`, `query_engine_bg.wasm` and `schema.prisma`
  byte-equal.
- **Add-only graft.** All 10 grafted files byte-identical to the source. Target =
  17 pre-existing files (2026-09-18 mtimes, hashes and mtimes unchanged) + 10
  grafted (2026-09-20T01:36:35). Engines and `schema.prisma` retain their
  pre-action mtimes.
- **Load proof.** The packet's exact `node -e` form, run from the live release's
  `atlas-server`, exited 0 with no `MODULE_NOT_FOUND` and no database connection.
- **Isolated restart proof (decisive).** The live release's built server started on
  port `5052` with `ROLLOVER_AUTO_SYNC_ENABLED=false`: `/api/v1/health` 200,
  `/api/v1/health/ready` 200, `/api/v1/subjects?schoolId=1` 200 (19,440 bytes).
  Stopped cleanly; 5052 free; `5001`->63688 and `5174`->12992 unchanged; `5175` no
  listener; supervisor 67028 and the task untouched.
- **Zero write and cleanup.** Table signature map 47/47 and sequence map 48/48
  byte-identical across the action; `%TEMP%\opencode\prisma-repair-c01\` absent;
  stash list, reflog and untracked files show no residue from the action.
- **Adversarial checks.** `require.resolve` from the live release resolves the
  repaired client through the junction, and the fresh start proves it is used
  rather than decorative; every other consumer reaches the same tree; the graft
  source still carries a complete 27-file client.
- **Rollback recipe.** The 10 grafted files are exactly those with graft-time
  mtimes, disjoint from the 17 pre-existing files, so deletion is symmetric and
  would not touch the engine or `schema.prisma`.

## NON_BLOCKING findings recorded by QA

1. "Absent before" rests on the executor-recorded pre-state plus mtime evidence:
   the abort-time capture was deleted by the packet's own cleanup, so it is not
   independently preserved.
2. QA's own row-5 probe read the database outside the executor's signature window;
   bounded by a read-only route, disabled rollover automation, and the executor's
   before/after maps.
3. Graft source `8eb0511baa53-20260917` is a do-not-retire dependency because the
   copied `index.js` embeds its paths (resolved through `__dirname`).

No blocking finding. **The live release's restartability is proven.**
