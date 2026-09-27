# Planner A2 — overnight handoff, 2026-09-28 (packet c1)

Session: fresh Planner A2, packet `docs/prompts/overnight-a2-timetable-2026-09-28-c1.md`. Operator asleep;
no question was asked and none was needed. Authority: standing authorization (2026-09-20) + the overnight deploy
authorization. **No gate was waived.**

## 1. What the morning must do, in order

1. **Read this file, then `docs/plans/live-state.md` → `## Live release` and `## Lane A2`.** The register was
   **false** when this session started and is now corrected; do not re-derive the live release from a prior
   session's note.
2. **Nothing is blocked on capacity or on a pending decision.** E: has room (measured 32.03 GiB at cutover).
3. **Retire the stale release dirs** `lane-a2-release-0da104f9`, `-b0736007`, `-c5a9e832` — none is live and none
   is the rollback basis. `atlas-worktree-reclaim`, after reading `docs/reference/agent-worktree-lifecycle.md`.
   `lane-a2-release-a56ac86d` is also now superseded by `d31bfacb` and is retirable. **Keep** `d31bfacb` (live),
   `c0d91827` (rollback basis) and `9b28c572` (one step further back).
4. **A3's browser rows are owed and the browser is free.** A3 yielded it at 00:20 and A2 released the lock at the
   end of this session. A3's own c1 items 0, 2, 4, 5 were recorded `BLOCKED(BROWSER_CUSTODY)` because A2 held the
   lock; they are unblocked now, not waived.
5. **Item (d), the older-user UX batch, is the highest-value unfinished work** — it is P0 for the Wednesday demo
   and every finding is already measured (see §5). It is source-only, MEDIUM, and can start immediately.
6. **Item (c) #62 root cause is still open** and is the most valuable unknown on this lane (see §6).
7. **Item (g), a second release, is not required for correctness.** Nothing on `origin/main` above `d31bfacb` is
   a defect fix this lane needs live; A3's `c5cffa72` page-title batch is cosmetic. Release it with the next real
   candidate rather than alone.

## 2. Release 1 — `d31bfacb` — **LIVE**

| | |
|---|---|
| **Live** | **`d31bfacbfeadb8e90bf9cf1f7a8ddcad62ab129a`**, dir `E:\ATLAS-worktrees\lane-a2-release-d31bfacb` |
| **Deployed** | 2026-09-28 00:23–00:24 +08, by `ops/runtime/deploy-runner.ps1` (dry run exit 0, then `-Execute`) |
| **Rollback basis** | **`c0d91827`**, dir retained — one-step supervised reset |
| **Audit** | `C:\ProgramData\ATLAS\release-audit\d31bfacb-20260928-002328` |
| **State** | `state=running`, `releaseSha=d31bfacb…`; 5001 → 55264, 5174 → 5988 |
| **Identity** | all three sources agree: machine scope, task action, listener command lines |
| **Register record** | `docs/plans/live-state.md` (commit `48c24903`, pushed as `f27298b2`) |

**Delta, enumerated from the real incumbent** (`git log c0d91827..d31bfacb --name-only`): 17 commits, 38 unique
paths, **29 non-docs** = A2 **20** + A3 **10** − 1 shared `atlas-client/package.json`. **Two `atlas-server/`
production files** (`notification-inbox.service.ts`, `generation.service.ts`) — this was **not** a client-only
release. Zero `prisma/` paths; both `package.json` changes are `scripts`-only.

**Pre-action review** (`atlas-qa`, one batched dispatch, 10 mandatory rows): `CORRECTION_REQUIRED`, 9 passed /
0 blocked / 0 unperformed / **1 failed** — the seven browser rows named no ATLAS evidence origin, which would
have made them undecidable and would have sent B2 to loopback where the login cookie is not sent. Corrected as a
**wording-only** docs commit `aee63e12` (§11: no second review round, source range and discriminators not
re-reviewed, the full ten-row record preserved in packet §7).

### Acceptance tally — **10 rows PASS, 0 failed, 3 UNPERFORMED, 1 PARTIAL**

| Row | Result |
|---|---|
| D1 server serves new build | **PASS** — `/health/ready` 200 `database:ok`; DB-backed `/subjects?schoolId=1` 200 (19 453 B) |
| D2 client host serves new build | **PASS** — `/__host/live` 200 `application/json`; `/` 200; served entry `index-CIHphcTQ.js` |
| D3 server discriminator | **PASS, non-vacuous** — `metadataChangeIdentity` **0 → 4**; the new-build-only `dist/__tests__/notification-inbox-dedupe-a2.test.js` present |
| D4 client discriminator | **PASS, non-vacuous** — `timetable-plain-language-BYLpdAgL.js` 200 (3 367 B) with the deciding literal present; pre-cutover `-WFjDBxxH`, `-SrCPH0Zz` **and** `-DqO6YBTZ` all 404 |
| D5a migrations | **PASS** — 11 → 11 by the pinned `ls-tree` method; zero `prisma/` paths |
| D5b zero-write (cutover) | **PASS** — window `2026-09-27T16:23:02.874Z` → after: `generation_runs` 9→9, `audit_logs` 451→451 (`max(id)` 1002→1002), `published_schedule_revisions` 6→6, **no audit row inside the window**. The cutover wrote nothing, as predicted |
| D6 public schedule | **PASS** — 09-20→315, 09-25→317, 09-26→319, 09-27/28→320; fallback true/true/true/false/false; `currentPublishedRunId` 320; **no 409** |
| D7 term guard | **PASS** — 400 without `termIndex`, 200 with |
| D8 swap route mounted | **PASS** — 401, not 404 |
| B1 #44/#57 one number | **PASS** (truthfulness) + findings — see §4 |
| B2 batch notification | **PASS — the headline row, decisively.** See §3 |
| B3 no cross-term daily-load sum | **UNPERFORMED** — needs a same-day swap preview; not reached this session |
| B4 #3 Change owner lands right | **UNPERFORMED** — not reached |
| B5 run line + state badge | **PARTIAL** — draft side **PASS**; published-run side **UNPERFORMED** |
| B6 A3's 9 steps | **UNPERFORMED** — A3's own rows, owed to A3; browser now free |
| B7 public page DOM | **PASS** — 20 sections, "40 published classes are shown", TERM 2, **no** "Unable to load public schedule" |

**B5 draft side, measured:** the header reads **`Run: Run 321 · Draft`** and the badge reads **`DRAFT
SCHEDULE`**. So **#41 is fixed and live** and a draft is correctly labelled Draft. **#51 (a *published* run
labelled Draft) is therefore NOT yet disproven** — it needs the run picker, which was not reached. Do not record
#51 as fixed.

## 3. B2 — the previous release's open BLOCKING finding is now closed, with the mechanism visible

The `9b28c572` post-action D10 finding — *a committed swap wrote the schedule, returned 200, and persisted **no**
notification row* (`notifications` 216 → 216) — had **no recorded root cause** when this session started. It has
one now, in the source this release ships:

> `atlas-server/src/services/notification-inbox.service.ts:174-196` — the dedupe identity was per-**slot**
> (`schoolId:schoolYearId:type:resourceType:resourceId:actorId`), with **no change identity at all**, so a second
> edit on the same slot collided and `skipDuplicates` dropped it. A multi-edit batch
> (`commitManualEditBatch`, `manual-edit.service.ts:1609`) hit the same wall. `metadataChangeIdentity` reads
> `editId` first and falls back to the plural `editIds`.

**Measured on live, on the new build** — a swap of `entry-221::t2` ↔ `entry-321::t2` (GR7 · SCI_CHEM ↔ MAPEH,
MONDAY 06:45–07:30 ↔ 07:30–08:15), term 2, on **draft** 321:

- HTTP **200**, `editId` **13**; `generation_runs.version` for 321 **4 → 5**; `manual_schedule_edits` **8 → 9**.
- `notifications` **216 → 218**, `max(id)` **220 → 224**: **two** rows persisted, one to the committing actor 46
  and one to the affected teacher (actor 1) — the same fan-out shape as the pre-fix 2026-09-26 swap.
- **The fix is legible in the stored key:** `1:10:TIMETABLE_EDIT_COMMITTED:timetable:321:46:**13**` — the trailing
  `13` is the change identity. The historical 2026-09-26 revert row reads `…:321:46` with **no** change component.
  That is the whole defect in one string.
- The persisted title names people and times, not ids: *"Manual swap committed: SCI_CHEM and MAPEH exchanged their
  times between MONDAY 06:45-07:30 and MONDAY 07:30-08:15."* — so #61's naming fix is live too.

**Harness honesty:** B2's swap was issued through **the app's own authenticated API from the browser's session**,
not by clicking two grid cells. The row's assertion is about *persistence*, and this exercises the identical
server path, authorization and dedupe code. **The grid-gesture half of the row was not exercised** and is not
claimed. Stated here rather than smoothed over.

**State change disclosure:** draft 321 now carries one authorised swap (`manual_schedule_edits` id 13, run
version 5). It was **not** reverted and must not be. `published_schedule_revisions` is unchanged at 6, so nothing
was published.

## 4. Live findings measured tonight (each with its evidence)

| # | Finding | Grade | Evidence |
|---|---|---|---|
| U1 | Header prints **`Run: Run 321 · Draft`** — the word "Run" twice, and "run" is jargon for a scheduler. Lane C's U1 still open | MEDIUM (older-user UX) | measured on `/timetable`, Tailnet origin |
| U3a | Generate dialog is **155 words** and still carries the multi-sentence disambiguation note, plus engineer-facing labels **"Actor school year"**, **"Term authority: Saved ATLAS data"**, **"Retained draft anchors"** | MEDIUM | dialog text captured in full |
| U3b | Unlabelled **✕** beside a **"Close"** button — a duplicate control | LOW | dialog button list: `["", Cancel, Generate schedule, Close]` |
| U2 | The state badge is a text block, not a distinct icon+colour per state; only the Draft side was observed | MEDIUM | published side unreached |
| N1 | The swap commit response carries the **entire warning list** — a ~75 KB payload for one swap, and the same 12×-repeated sentence Lane C flagged | MEDIUM (perf + wall of text) | response body measured at 75 750 chars |
| N2 | Two console errors on `/timetable` load (contents not captured this session) | LOW | browser console log |

**#44/#57 are fixed and live:** the generate dialog no longer says "unassigned" anywhere. It now says
**"Weekly sessions with no placement yet / 1295 sessions"** and explains that a finished run reports a *different*
count. The two numbers are no longer the same fact with two names — the actual fix, not a reword. **The wording
grade is still not good enough for a demo** (155 words, mixed nouns "session"/"place"), which is item (d).

## 5. Reconcile table — what is live, what is fixed, what is open

**Scope honesty:** this is the subset of `#1–#64` and inventory §16a/§16a-bis rows that this session could
**adjudicate with evidence in hand**. The remaining rows are **NOT classified**, and an unclassified row is not a
closed row — §15 forbids dating a status I did not verify. The full 296-row inventory lives in
`docs/reviews/timetable-control-inventory-2026-09-26.md`; Lane C's rows live in
`docs/reviews/timetable-manual-controls-20260926/findings.md`.

| Row | Status | Proof |
|---|---|---|
| #41 run line on screen | **LIVE_VERIFIED** | `Run: Run 321 · Draft` on the Tailnet origin |
| #44 dialog vs checklist numbers | **LIVE_VERIFIED** (fixed) | no "unassigned" in the dialog; 1295 labelled as weekly demand |
| #51 published run labelled Draft | **OPEN** | only the draft side was observed; the published side needs the run picker |
| #57 dialog "1295 unassigned" vs toast "0" | **LIVE_VERIFIED** (fixed) | same measurement as #44 |
| #61 commit notice names, not ids | **LIVE_VERIFIED** | notification title names SCI_CHEM/MAPEH and both times |
| #64 undone-row wording | `FIXED_NOT_LIVE`? | **not adjudicated this session** — its fix `a33680ae` predates the incumbent `c0d91827`, so it **is** live by ancestry (`merge-base --is-ancestor a33680ae c0d91827`), but no browser row was run. Treat as live-by-ancestry, unverified on screen |
| #62 159 → 68 → 69 warning drift | **OPEN — the most valuable unknown.** See §6 | not reached |
| #3 Change owner lands on the wrong teacher | **OPEN** | the fix shipped; B4 not performed |
| #2 cross-term daily-load sum | **OPEN** | the fix shipped; B3 not performed |
| D10 durable notification on swap | **LIVE_VERIFIED — CLOSED** | §3 above; this was the release's blocking finding |
| #53 room utilisation 0% | `FIXED_NOT_LIVE` → **now live** | A3's `f0602703` is in `d31bfacb`; A3's own browser rows still owed (B6) |
| Inventory `MISLABLED` U+FFFD in `SchedulingPolicyPane.tsx` | **OPEN** | pre-existing; known since 2026-09-26, still queued |
| Inventory `DEAD` 1 / `UNMOUNTED` 5 / `UNTESTED` 149 | **OPEN** | not classified this session |
| Inventory rows 37 / 40 / 46 | **OPEN** — rows 37 and 46 are A3's non-timetable surfaces | ownership: A3 |
| #49 More-menu density, #50, #56, #58, #59 | **OPEN** | item (d), queued with U1–U5 |
| #17 drift banner, #43 dialog density, #55 grid badge | **OPEN** | item (d), queued |
| #64 Redo tooltip → "Nothing to redo." | **OPEN** | item (d); wording only |
| Every other `#1–#64` row | **NOT CLASSIFIED — owed** | needs one pass over `findings.md` + `inventory` with a grep-and-classify executor; see §1 step 5 |
| Every other §16a/§16a-bis row | **NOT CLASSIFIED — owed** | as above |

## 6. #62 — status, and the lead nobody has taken

`159 → 68 → 69` on swap + revert. **A2's committed enumeration harness (`4157f599`) refutes the payload theory**:
`MUTATED BUT NOT NAMED: []` and `RESIDUAL vs PRE-SWAP (0): []` across all five strategies — the payload names
every mutated entry and the revert round-trips the set exactly. So the cause is **not** an unnamed mutation and
**not** an out-of-set residue.

**New lead from tonight, from the source of the fix that just shipped.** The swap response body is the *entire*
warning list, and it repeats the same sentence per violating block
(`FACULTY_CONSECUTIVE_LIMIT_EXCEEDED`, "Faculty 12 teaches 180 consecutive minutes (4 periods) on MONDAY, above
the 135-minute limit", with a distinct `blockEntryIds` set per term). **The candidates are therefore a count that
is not a pure function of entry slots — an aggregated or de-duplicated value, most likely a per-faculty or
per-day aggregate recomputed on read.** Tonight's B2 swap is a fresh, fully-recorded instance with the before and
after counts available in the DB and the response, which is the cheapest reproduction this problem has ever had.
**Recommended next step: capture the warning count for that exact edit (id 13) before and after a revert, from
the response bodies, not from the header.** That is item (c) and it is not done.

## 7. Two corrections to the record made tonight

1. **`published_schedule_revisions.source_run_id` is the column — not `sourceRunId`, not `run_id`.** Both this
   session and the pre-action reviewer wrote the camelCase form from the Prisma model. Executing the check
   against the real database returned `42703 column "sourceRunId" does not exist`. §11's rule applied: the packet
   said to record what was actually run, so the corrected column name is here and in the follow-up commit.
2. **The client discriminator chunk is MODIFIED, not new.** The pre-action reviewer caught that this packet's own
   premise was false (`timetable-plain-language.ts` exists at `c0d91827`, and the live build ships
   `timetable-plain-language-DqO6YBTZ.js`). The row is still valid because the deciding assertion is the
   **literal count**, and the old chunk now 404s — but the packet's rationale was corrected so nobody later
   "simplifies" the proof down to a filename.

## 8. Lane coordination

- **Browser custody:** A2 took the lock at 00:25:37 +08 from A3's explicit yield (00:20:01) and **released it**
  at the end of this session. A3's c1 items 0, 2, 4, 5 were `BLOCKED(BROWSER_CUSTODY)` while A2 held it; they are
  unblocked, **not waived**.
- **A3 in this release:** 10 of the 29 non-docs paths, 6 of them production, all on non-timetable surfaces. Its
  own acceptance rows (B6) are **UNPERFORMED and owed to A3**.
- **`main` push window:** A2 pushed `48c24903` + `aee63e12` (+ merge `f27298b2`) at ~00:20 +08. A3's `c5cffa72`
  was merged in first and the union was clean; A3 touched no live-state file in that range.
- **A3's line for the next release:** `A3 integrated for release at c5cffa72` (page titles, 10 client paths,
  no server, no `prisma/`). A2 has not released a release carrying it; the reason is in §1 step 7.
