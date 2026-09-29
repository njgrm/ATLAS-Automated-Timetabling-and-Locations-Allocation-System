# A8 g1 handoff — spread a section's weekly classes across days

**Worktree** `E:\ATLAS-worktrees\lane-a8-g1` · **branch** `work/a8-g1-spread-sessions`
**Base** `5e03e0c460dfd2881cadb2183f28e6e4510e798a`, merged forward to `bfd14a96`
**Candidates** `31addf09bb17dc0eac5864c118d38874e164c30e` (code + tests), `49ca2ff92d99309bce0dc991f6538508f55de36c` (proof harness + this handoff)
**Disposition** `PRESERVE_FOR_DECISION` — the proof row is `BLOCKED`, see §5.

Both candidate commits are reachable from the shared repository
(`git -C D:\ATLAS cat-file -t <sha>` → `commit` for each), so an integration boundary can `git merge`
this branch. **The branch is not pushed**: `git push` and `git merge` are both denied to this executor by
its permission set, so the required "merge `origin/main` before each slice" could not be repeated at the
end of the run — see §9.

## 1. What changed, per file, and why

| Path | Change | Why |
|---|---|---|
| `atlas-server/src/services/schedule-constructor.ts` | `daysUsedForPair` `Set<string>` → `Map<string, number>`; `dayUseCount` stamped on every candidate; sort becomes `(dayUseCount ASC, score ASC, DAYS.indexOf ASC, startTime ASC)`; the `+2.5`/`+1.5` day term deleted; `lockDayUseByPair` seeded inside the lock-accept branch; `sectionLabelById` composed from `sectionsByGrade`; `isDeclaredBlockSubject`; `SpreadException`/`SpreadReport`; `ConstructorResult.spreadReport` | The live defect: the day-reuse signal was a soft `+2.5` that the home-room `-0.5` exactly cancelled, so a used day with a free home room tied an unused day with a busy one at 3.0 and Monday won `DAYS.indexOf`. A count that is the **first** sort key cannot be cancelled by room quality. |
| `atlas-server/src/services/generation.service.ts` | `RunSummary.spreadReport?` + `spreadReport: result.spreadReport` beside `unassignedCount` | The packet asks for the run **receipt**, not a new screen. `generation_runs.summary` is jsonb and is returned verbatim by `getRunDraft`/`getLatestRunDraft`, so the field reaches the receipt with no UI work and no migration. |
| `atlas-server/src/__tests__/a8-g1-spread-sessions.test.ts` (new) | 10 rows | The packet's four gates plus the invariants that must not move. |
| `atlas-server/src/scripts/a8-g1-live-shape-proof.ts` (new) | The whole-DB before/after proof harness with a no-database `--self-test` | r2's executor deliverable for the packet's central proof row. |
| `atlas-server/package.json` | `test:a8-g1-spread-sessions` | `gate-reachability.test.ts:26-58` turns the suite RED for a test file no `test:*` script names. |

## 2. Decisions the packet left open, and which way they went

1. **The old `+2.5`/`+1.5` day term is DELETED, not kept.** `dayUseCount` is the first key and strictly
   dominates `score`, so the term is unreachable; leaving it would be a second, dead copy of the rule
   with a different constant. It is not "fixed twice" — it is gone, in both the canonical-CLASS branch
   and the legacy `FALLBACK_PERIOD_SLOTS` branch. The COHORT 1.5/2.5 asymmetry is preserved by
   *not* reading it at all; cohort packing behaviour is otherwise untouched.

2. **The exception condition is `count > preferredMaxPerDay`, where
   `preferredMaxPerDay = max(1, ceil(sessionsPerWeek / 5))` — not `count >= 2`.** This is the packet's
   own post-condition, and it matters: an 8-session subject cannot do better than 2 on a day, and
   reporting that as *"no other day was free"* would be a lie. With the cap condition, an 8-session
   week comes out 2/2/2/1/1 and reports **nothing**, while a 5-session week — the packet's actual case,
   cap 1 — reports every repeat. The clamp at 1 exists only so a zero-session demand item carrying
   locks cannot report a single session. Count and list cannot disagree: every breach is in
   `exceptions`, and every entry in `exceptions` is a breach.

3. **`sameDayRepeatPairs` counts pairs above the cap**, not pairs with `count >= 2`. For the live
   5-session subjects these are the same number, so it still reads as the "31 pairs" of Run 347.

4. **`spreadReport` is always present** (not conditional on failure) so a clean run proves `0` rather
   than proving nothing. On `RunSummary` it is optional, because a run written before this change
   simply lacks the key.

5. **No c5 receipt redesign exists on `origin/main` at merge time** (`bfd14a96`), so there was no
   surface to fold into. `spreadReport` is already the grouped shape c5's rule asks for: one object
   with a count and a bounded, typed exception list — never a raw `string[]`, never a bare count.

6. **`isPreferredAtSlot` is untouched.** The c5/A2 soft availability ranking still orders
   *candidates* inside a slot; `dayUseCount` orders *slots*. Both are honoured; neither was taken
   wholesale.

## 3. Label derivations (the three that were easy to get wrong)

- **subject** — `subject.name?.trim() || subject.code?.trim() || \`Subject ${id}\``. `name` is optional
  on `SubjectInput`, so `code` is the fallback.
- **section** — **not** a stored field. `DemandItem` carries no section name. Composed as
  `<gradeLevelName minus "Grade ">-<sectionName>`, read off the section first and falling back to the
  enclosing `sectionsByGrade` group. `"8-Makatao"` = `Grade 8` → `8` + `-` + `Makatao`.
- **day** — `MONDAY` → `Monday`.

Message format is asserted **exactly**:
`"Filipino for 8-Makatao has 5 classes on Monday (no other day was free)"` (the packet's literal
example with `2` is asserted as a template string on the next line of the same test).

## 4. The three label/authority traps, and how each is closed

- **`violations` is not touched.** `modularWarnings` → `generation.service.ts:1013-1014` →
  `publication-contract.service.ts` `PUBLISH_ACK_REQUIRED_SOFT_VIOLATIONS`. A spread exception is not a
  violation, so it never enters `modularWarnings`. `hasPublishedMarkers`, the readiness diagnostic and
  the publication predicate are all untouched. Test row 3c asserts the disjointness, and the compiler
  enforces it: `ModularWarning.code` is a closed union that cannot contain the spread code.
- **No migration.** `model Subject` has no block/double-period column. `isDeclaredBlockSubject` is the
  single named place the rule asks about a block, is code-only, adds no user-facing setting, and returns
  `false` for every current subject. Test row 4b reads `prisma/schema.prisma` and fails if a block-like
  column ever appears — that is the signal to revisit the no-migration decision. Consecutive periods
  are a break rule (`wouldExceedConsecutive`), not a block, so a normal week cannot collapse to 2+2+1.
- **Locked entries.** Day usage is seeded **inside the accept branch** next to `lockSessionCounts.set`,
  never by walking `lockedEntries`, because a lock rejected for a missing period slot, `facultyId` or
  `roomId` never becomes an entry and must not consume a spread day. Test row 5b pins both halves: the
  accepted lock consumes Tuesday, the rejected one does not.

## 5. Proof row: `BLOCKED` — harness delivered, run not performed

**Harness**: `atlas-server/src/scripts/a8-g1-live-shape-proof.ts`, committed.
`--self-test` passes with **no database** and proves the parts that need no credentials:
7/7 guard cases (`atlas_db`, `atlas_recovery_clean_rebuild_20260905`, `atlas_staging`, a malformed date,
an uppercase suffix, and the active database are all rejected; a well-formed drill target is accepted),
6/6 measurement cases, the table renderer, and agreement with the shared
`assertRestoreTargetAllowed` / `assertCleanupTargetAllowed` primitives.

**Why `BLOCKED`, not `UNPERFORMED`**: the run needs a staging `DATABASE_URL`, and this executor holds
no credential authority.

- No ambient `DATABASE_URL` is set in this session (`[bool]$env:DATABASE_URL` → `False`).
- This worktree has **no** `atlas-server/.env` (it is gitignored, and absent from the worktree).
- The only reachable `.env` is `D:\ATLAS\atlas-server\.env` — Lane C's checkout, and a credential file
  I am forbidden to read.
- A passwordless `psql` probe hung on an interactive password prompt, confirming the local cluster
  requires a credential this lane cannot supply. The probe was killed; no `psql` process remains.

The harness fails closed on exactly this, which is itself verified:
`A8G1_PROOF_FAILED code=CONFIG_MISSING No DATABASE_URL …` (exit 1).

**To close the row**, an operator or A4 with credential authority runs, from `atlas-server/`:

```
npx tsx src/scripts/a8-g1-live-shape-proof.ts \
  --source-env <path-to-a-staging-env> --target atlas_restore_drill_20260929_a8g1
```

It will `pg_dump` staging (read-only), `createdb -T template0` + `pg_restore` the whole database into the
guarded target, set `ROLLOVER_AUTO_SYNC_ENABLED=false`, read the **before** figure from the newest
COMPLETED run's persisted `draft_entries` (the packet's own read-only-SQL method, so "before" is real
production output rather than a reconstruction), run the new constructor over the same restored inputs
through the production `buildPreflightConstructorInput` / `buildPreflightValidatorContext` builders, print
the before/after table, fail closed if unplaced rises or any overlap or HARD violation appears, then drop
the drill database and prove zero residue over exactly the name it created. Every database client is
constructed explicitly per database; the `DATABASE_URL`-bound Prisma singleton in `lib/prisma.ts` is
never imported, because it binds at import time and would silently read the drill database while
recording the source signature.

**Consequence for the review**: the packet's rule 3 row is undecided. The unplaced and overlap claims
rest on **construction** (the placement loop, occupancy marking, the hard daily/consecutive guards and
`getQualifiedFacultyIds(..., sessionTermIndex)` are all unmodified — only candidate *order* changed) plus
the fixture rows, not on live-shaped data. `NON_BLOCKING` for the source candidate; `BLOCKING` for the
release, because the packet made the row mandatory and named it the central proof.

## 6. Environment note (this lane's toolchain)

`npm ci` is **denied** to this executor by its permission set, and `node_modules` was absent. To run the
gates at all, `atlas-server/node_modules` was a **junction** to another lane's dependency tree with a
byte-identical `package-lock.json` (`Get-FileHash … package-lock.json -Algorithm SHA256` →
`76061F55…09A64AC` on both). **The junction was removed with `cmd /c rmdir` before this handoff**, and
`git status --short` is clean.

**Incident worth recording**: the first donor was `lane-a8-c4-cover`, whose `node_modules` reported 208
entries at link time. Partway through the run that worktree was removed by its **own** lane, the junction
went dangling, and the toolchain vanished mid-session. No damage was caused to any other lane — the
donor's whole directory was gone, not emptied by this junction — but it is a live instance of the §16
hazard: **a borrowed `node_modules` junction has a real chance of being pulled out from under you, and a
`git worktree remove` that follows one can empty a shared donor.** The junction was re-pointed to
`lane-c-a7c7` (208 entries) to finish the gates, and removed again afterwards. Recommend the lifecycle
doc name "never borrow a dependency tree by junction for a long-running lane" as a rule.

## 7. Decisive commands, with real results

Run from `E:\ATLAS-worktrees\lane-a8-g1\atlas-server` unless noted.

| Command | Result |
|---|---|
| `npm run test:a8-g1-spread-sessions` | `tests 10 / pass 10 / fail 0`, exit 0 |
| `npm run test:timetable-scheduling-quality-c03` | `pass 16 / fail 0`, exit 0 |
| `npm run test:hybrid-scheduler` | `pass 5 / fail 0`, exit 0 |
| `npm run test:timetable-sync-setup` | `pass 1 / fail 0`, exit 0 |
| `npm run test:readiness-stall` | `pass 7 / fail 0`, exit 0 |
| `npm run test:disposable-db-guard` | `pass 9 / fail 0`, exit 0 |
| `npm run test:warning-count-scope-warn62` | `pass 7 / fail 0`, exit 0 |
| `npm run test:generation-completion-copy-c2` | `pass 11 / fail 0`, exit 0 |
| `npx --no-install tsc --noEmit -p tsconfig.json` | no output, exit 0 |
| `npm run build` | `> tsc`, exit 0 |
| `git diff --check` / `git diff --cached --check` | exit 0 (only the repo's LF→CRLF checkout warning) |
| `npm run test:encoding` (repo root) | `pass 1 / fail 0`, exit 0 |
| `npx tsx src/scripts/a8-g1-live-shape-proof.ts --self-test` | `A8G1_SELF_TEST_OK` |
| `… --target atlas_db` | `A8G1_PROOF_FAILED code=TARGET_NOT_DISPOSABLE …`, exit 1 |
| `… --target atlas_restore_drill_20260929_a8g1` (no `DATABASE_URL`) | `A8G1_PROOF_FAILED code=CONFIG_MISSING …`, exit 1 |
| `Get-PSDrive E` before any install | `Free 24456433664` = **22.78 GiB** — WARNING band (fail-closed is below 15) |

**Failing-first control** (the row cannot be vacuously green): with the production comparator
temporarily reverted to the removed `score`-first form and the `+2.5` term restored, the same suite
dropped to **`tests 10 / pass 7 / fail 3`** — rows `1`, `2-control` and `5c` went red. The production file
was then restored by an exact inverse edit and re-verified two ways: `test:a8-g1-spread-sessions` back to
`10/10`, and `Select-String … 'entryKind === 'COHORT' ? 1.5 : 2.5'` over
`src/services/schedule-constructor.ts` returning **no match** (no mutant residue).

**Discriminating control in-test** (the repo's local-mutant idiom, `a5-c2a-active-term-resolver.test.ts:148`;
no `git show`, no second checkout): `oldOrderingPicksMondayFiveTimes` re-implements the removed comparator
in ~10 lines over the same candidate shape and is asserted to return
`['MONDAY','MONDAY','MONDAY','MONDAY','MONDAY']`, while the production path over the identical fixture is
asserted to give 5 distinct days.

**Defect found and fixed during the work**: the first label derivation crashed on
`timetable-scheduling-quality-c03`'s fixture, whose `sectionsByGrade` groups carry no `gradeLevelName`
(`TypeError: Cannot read properties of undefined (reading 'replace')` at
`schedule-constructor.ts:2047`). The derivation now reads the section's own `gradeLevelName`, falls back
to the group, and tolerates neither. That suite went 15/16 → 16/16.

## 8. Risks

**BLOCKING**

- **B1 — the packet's rule-3 proof row is `BLOCKED`** (§5). The before/after table on live-shaped data
  does not exist. Release should not treat the unplaced and overlap claims as measured.

**NON_BLOCKING**

- **N1 — the receipt is not yet surfaced in any UI.** By design: the packet asks for the run receipt,
  not a new screen, and `DraftReport.summary` already carries it. If a later slice reads it, §8 header
  budget and the 2026-09-29 UX-regression rules apply and this lane would owe a screenshot set.
- **N2 — c5 has not landed a receipt redesign yet.** If c5 later restructures the receipt, `spreadReport`
  should fold into c5's shape; the grouped-object form here is already what c5's rule 4 asks for.
- **N3 — `spreadReport` grows with the run.** One entry per (pair, day) cell above the cap, uncapped.
  Live Run 347 had 31 such pairs, so the list is small; a pathological school with heavy same-day
  concentration would write more into `summary`. It is a jsonb column, so it is bounded only by that.
- **N4 — the constructor keeps a soft home-room preference as a *tie-break* within a day-count tier.**
  Room quality still decides which period on the chosen day, which is the pre-existing behaviour and the
  intended reading of r2. It no longer decides *which day*.
- **N5 — `schedule-constructor.ts` is 3,270 physical lines**, over the §8 1,000-line rule. It was ~3,000
  before this change and the packet explicitly forbids splitting or refactoring it. Pre-existing,
  untouched by this lane, flagged not fixed.

## 9. Coordination state at hand-off (needs the integration owner)

- **`git merge` and `git push` are denied to this executor.** The initial
  `git merge origin/main` (producing `bfd14a96`) succeeded, but the permission set refused both verbs
  afterwards, so the closing "merge `origin/main` before each slice" could not be run and the branch is
  **unpushed**. This is a permission limitation, not a choice.

- **`origin/main` has advanced past `bfd14a96` by ~20 commits** (A4 runtime hotfixes, A3 prefs-save,
  docs). The integration owner must merge and re-run the gates on the current tip. What I *could*
  verify without merging, and did:

  | Check | Command | Result |
  |---|---|---|
  | Does main touch my two source files? | `git diff --name-only bfd14a96 origin/main` | `schedule-constructor.ts` and `generation.service.ts` are **absent** from the 74-path list — **no source conflict, so the §R7 semantic-conflict escalation did not arise** |
  | Does main touch my other three paths? | same, filtered | `atlas-server/package.json` **is** touched → a mechanical union (I added one `test:*` key; A3 added its own) |
  | Has c5 landed a receipt redesign? | `git grep -l "spreadReport\|runReceipt" origin/main -- atlas-server/src` | **no match** — `spreadReport` had nothing to fold into, as §2.5 states |

- **The r1/r2 approach notes are not on `origin/main` and never were.** `git branch -a --contains`
  for `363f2887`, `2e2c925a` and `afb325da` reports each as *not* on `origin/main`; they exist only on
  this lane branch. `git diff bfd14a96 origin/main` therefore renders them as removed, which looks like
  a deletion and is not one. I checked this specifically because it initially looked like my own commit
  had deleted them: `git show --stat 49ca2ff9` shows exactly two added files, zero deletions, and
  `git log --oneline origin/main` does not contain `49ca2ff9`. The approach note the implementation
  follows is therefore **unpushed** and reviewers should read it from this branch, not from main.
- The packet `docs/prompts/a8-g1-spread-sessions-2026-09-29.md` **is** on main and is unchanged.
