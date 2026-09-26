# A2 initiation brief — 2026-09-26

**For a fresh Planner A2 session taking timetable custody from Lane A.** Read with `AGENTS.md`,
`docs/plans/live-state.md`, and Lane A's own checkpoint
`docs/handoffs/lane-a-session-checkpoint-2026-09-26.md` (`46c698f5`). This file does not restate those; it
records **verified state at handover** and the **findings Lane A could not record because they happened after
it finished**. Every figure below was measured — the command is named.

## Custody

**Timetable custody is A2's** (operator instruction, 2026-09-26). Lane A retains non-timetable items and must
not write timetable files or A2's live-state section without a new instruction.

**Lane A retains, and A2 must not absorb:** rotating the **exposed dev DB credential**; capacity/reclaim
policy; the cross-lane worktree disposition backlog; the `4893cbde` preserve-for-decision call. The credential
item is a **live security incident** — see "Open item 0" — and its record is **not yet on `main`**.

## Verified state at handover (2026-09-26 ~13:40 +08)

| Fact | Value | How verified |
|---|---|---|
| Live release | **`26f7c907`**, dir `E:\ATLAS-runtime-supervised-26f7c907-20260926` | `schtasks /query /tn ATLAS-Runtime-Supervisor /fo LIST /v` → task action; Last Run `13:09:14` |
| Live health | health 200, `/health/ready` 200 `database:"ok"`, 5174 200 | `Invoke-WebRequest` |
| Rollback basis | `116a7658` (dir present, never executed as rollback) | release dirs on E: |
| `origin/main` | **`46c698f5`** | `git fetch origin --prune` |
| main ahead of live | **49 commits** | `git rev-list --count 26f7c907..origin/main` |
| Live vs main | `26f7c907` **is** an ancestor of main; main is **not** an ancestor of live | `git merge-base --is-ancestor` (exit 0 / exit 1) |
| C: free | **46.33 GiB (20.5%)** — recovered, healthy | `Get-PSDrive C` |
| E: free | 54.69 GiB — above the 50 GiB warning, no reclaim owed | `Get-PSDrive E` |

**Two accepted cycles on `main` are NOT live:** `2f86ffee` (§8 cap) and `9b1ec14a` (lunch-window label — closes
a live-walk finding where **100 of 194 warnings rendered a raw engine code**). The deployment packet is
**withdrawn at `CORRECTION_REQUIRED` 6/13**; `docs/prompts/deploy-5152bff0-client-delta-2026-09-26.md` needs R2
against the five blocking findings in live-state, then a re-review. **Acceptance is 9/13 and NOT closed** —
A6 and A12(b) are unperformed (the Review-issues panel is run-level, the section draft is empty, A12(b) needs a
placed session). A browser session exists again (`atlas_local_token`).

## What changed after Lane A's checkpoint — A2 does not know these

1. **The J2/J2J3 plain-language collision was reconciled, and the reconciliation lost information.**
   `996b1b8b fix(timetable): reconcile the J2 and J2J3 plain-language maps onto main` merged both lanes onto
   `main`. The shared `timetable-plain-language.ts` now exports **both** lanes' accessors. Measured call-site
   references outside the module:

   | Export | Call sites | Carries |
   |---|---|---|
   | `roomRequestDecisionState` | **0** | `{ label, next }` — label **plus** a verified "what happens next" |
   | `plainRoomDecisionStatus` | 1 | bare label only |
   | `roomRequestAppealState` | **0** | `{ label, next }` |
   | `plainRoomAppealStatus` | 1 | bare label only |
   | `generationRunStateLabel` | **0** | `{ label, next }` |
   | `plainGenerationRunStatus` | 1 | bare label only |

   So the live surfaces now show **"Waiting for a decision"** with **no explanation of what happens next**,
   and the three richer accessors are **dead exports**. Independent QA had verified those `next` sentences as
   *true* against `room-preference.service.ts`. **This is a deliberate-looking choice nobody recorded**: either
   wire the richer accessors back up, or delete the dead exports and accept the terser wording on the record.
   Do not leave three dead exports and a silent information loss. *This is A2's first decision.*

2. **The credential-incident record is not on `main`.** `0393ec64` and `127662b7` (13:25 and 13:36 — "the dev
   DB credential is committed, not just transcribed", then "public AND Tailnet-reachable — measure the blast
   radius, and refuse the history purge") live only on
   `docs/lane-a-register-reconcile-20260926` @ `127662b7`. `merge-base --is-ancestor 127662b7 origin/main`
   → **exit 1**. An open security incident is recorded off-`main`. Land it or re-record it in Lane A's section.

3. **The J2/J2J3 integration record is also not on `main`.** `c9c51307` (and `16468f85`, `ba714131`) on
   `integration/plain-language-j2j3-c01-20260726` → `merge-base --is-ancestor c9c51307 origin/main` → **exit 1**.

4. **The earlier J2/J3 QA capsule is still owed.** Lane A recorded that the verdict on candidate `98289573`
   existed only in-session. It is now partly superseded by the reconciliation above, but the verdict still needs
   writing down.

5. **C: ran to 3.29 GiB and opencode crashed** (13:14–13:27) — cause was mine, not a repo defect, recorded here
   so it is not mistaken for one. Writing to `opencode.db` while opencode ran filled a 19.3 GiB WAL; a
   `VACUUM` against the locked file took the app down. **Now 46.33 GiB free.** The root defect is upstream:
   **1,489,192 of 1,533,808 `event` rows are orphans** (18.08 GiB) because session deletion does not cascade,
   and the event log grows ~2.6 GiB/week. If C: climbs back toward full, the fix is upstream retention, not
   manual pruning.

## Open items for A2, in priority order

- **0 (Lane A's, visible to A2): exposed dev DB credential.** Committed, public, Tailnet-reachable. Lane A owns
  the rotation. A2 must not paste, echo, or re-transcribe the value anywhere, and must not run a history purge —
  the recorded decision is to **refuse** it.
- **1.** Decide the `plain-language` accessor question in finding 1 above.
- **2.** Land the two off-`main` records (findings 2 and 3) so the incident and the integration verdict are on
  `main`.
- **3.** R2 the withdrawn client-delta packet `deploy-5152bff0-client-delta-2026-09-26.md` against its five
  blocking findings, then re-review. **A "client-only delta" is not a client-only build** — the release still
  needs `atlas-server/dist/server.js`.
- **4.** Close acceptance 9/13 → 13/13: A6 and A12(b) are the unperformed rows; a browser session exists.
- **5.** The hard open problem Lane A documented, unchanged: constraint severity on the manual-edit write path
  is client-influenced, and the fix is **not** a deletion. `manual-edit.service.ts:692` copies client
  `proposal.metadata` (reachable from six body routes); `commitManualEditBatch:1478-1487` auto-defers room type
  across the whole draft and `deferredRoomTypePreference` is written only there, so `/commit` and
  `/batch/commit` disagree. R1–R3 all failed pre-action; deleting the blanket deferral breaks Quick Place and
  TL-repair into 422s (probe-proven). **Three questions gate any fix and are not planner calls:** may a
  server-derived solver trial forgive a feature shortfall; is the modular-pool exemption legitimate; may the
  repair path carry client metadata at all. `manual_schedule_edits` is **0 rows**, so no data repair is needed.
- **6.** §7 timetable invariants: the fail-closed term guard (`C2-term.1` / `C2-term.2` in
  `generation-blockers-c02.test.tsx`) is still **owed and unguarded** — no test covers the term clause.

## Standing cautions Lane A earned (inherit them)

- **Never assert a value you have not just derived.** This lane's reviews caught, in artifacts written with
  confidence: a fabricated SHA, invented worktree dispositions, a subtractive "correction", two miscounts, a
  misread ignore rule, a stale code citation, and data figures asserted rather than measured. **Every SHA,
  path, count, disposition and hash ships with the command that produced it.**
- **A deployment packet must build what the runtime executes.**
- **Two executor stops on one change means it needs a design decision, not another packet.**
- **Enumerate every *writer* of a field, not just its consumers**, before proposing to remove it.
- **`temporarily measure` is not measuring** — `if(git merge-base --is-ancestor …)` tests stdout, not
  `$LASTEXITCODE`.
- A recorded verdict belongs in `live-state.md` with its tally, not only in a transcript.
- **Confirm the live release from the scheduled-task action**, never from a release directory existing.
  (Cost: this lane reported a live release as `861d89a2` for several cycles after Lane A had already cut over
  to `116a7658`, because it checked that the old directory was still intact.)

## Environment facts a successor will otherwise re-derive

- `origin/main` moves continuously — other lanes push. **Re-derive the target immediately before any pin.**
- `D:\ATLAS` cannot run client `typecheck` (no `@types/node`); measure in a worktree.
- `atlas-server` has **no** `typecheck` script — use `npx tsc --noEmit -p tsconfig.json`.
- The shared exclude rule `/ops/runtime/logs/` in `D:\ATLAS\.git\info\exclude` keeps release worktrees
  runner-eligible; file tools are **refused** for that path, so it was appended via the shell.
- **Dependency trees: copy the frozen donor as real directories. Never junction `node_modules` to the live
  release** — a test run wrote `.vite/deps` into production through such a junction and the live supervisor
  logged event-loop stalls. Remove a junction link-only (`cmd /c rmdir`, no `/s`) and verify the target's
  entry count before and after.
- `D:/ATLAS` is read-only for edits (directive §14) — a session correctly refused an edit there.
- Never run `Get-Content | Set-Content` on a repository file; it has already stripped newlines and mangled
  non-ASCII once.
- Write commit messages with `git commit -m` flags, not `Out-File`/heredoc — `Out-File -Encoding utf8` has twice
  left a UTF-8 BOM in a commit subject, and amend is forbidden so it cannot be corrected.
