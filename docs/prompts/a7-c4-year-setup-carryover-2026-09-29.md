# A7-C4 packet — a new school year keeps last year's setup by default (operator 2026-09-29)

Governing packet: `docs/prompts/a7-year-carryover-2026-09-29.md`. Base `269dff02` (`origin/main`). Worktree
`E:/ATLAS-worktrees/lane-a7-school-year-setup`, branch `work/a7-year-carryover-c4`. MEDIUM source that **writes live
data on rollover sync → HIGH tier**: independent pre-merge review is mandatory and the deployment must not execute on
`CORRECTION_REQUIRED`. **A7 never deploys; A4 does.**

## 1. Intent (who, what, how it must feel)

The user is an older, mouse-first school scheduler standing in front of colleagues while starting a new school year.
They said: *"setting that up is a real hassle. It shouldn't reset … policies and grade shifts shouldn't [reset] unless
stated otherwise."* Today, starting a new year hands them an empty year: they re-enter every grade's start and finish
time and re-enter their flag ceremonies and special days, one year at a time, forever. The feeling we are buying is
**"it already remembers"** — they press one button and the new year arrives the way they left it, and if they *do* want
a clean year they turn one switch off and can see that they did.

Two rules govern the whole design:

- **R1 — it must never reset silently.** The default lives **server-side** as *keep*. A stale client, a direct API
  caller, the automation path (`initiatedBy: 'system'`), or a request with the field missing, malformed or `null` all
  get *keep*. The guarantee is a property of the server, not of a checkbox a user may forget to tick.
- **R2 — plain words for older schedulers.** No jargon (the existing guard bans `sync`, `mirror`, `election`, `drift`,
  `archive`, `carry-forward`, bare `carry`, `dummy`, `hard cap`, and any `#<digits>` id). One short line per switch
  saying what it keeps. No helper sentence under a button, no ellipsis, no second status for the same fact.

## 2. Rulings I am making now, so the executor does not stop to ask

**R1 — the switches are per-apply request values, not persisted settings.** There is no per-school settings table and no
JSON column on `School`; adding one is a migration, and a migration is a HIGH surface this packet does not need. The
switches travel in the apply request body and the **server default is keep**. Consequence, stated plainly: the choice
is not remembered *across* rollovers, so a later rollover starts from keep again — which is the operator's stated
default anyway. Persistence is a follow-up row, not this packet.

**R2 — the copy runs in its own Serializable transaction, immediately BEFORE the policy phase.** This is the
load-bearing structural decision. `applyRolloverSync` calls `getOrCreatePolicy(schoolId, activeYear.id)`
(`enrollpro-rollover.service.ts:1742`), which **creates a defaults row** for the new year. If the carry ran after that,
the target would no longer be empty, the fill-empty-only rule would copy nothing, and the new year would silently get
factory-default scheduling rules — the exact defect the operator is complaining about. So the carry must land first;
`getOrCreatePolicy` then finds an existing row and takes its existing normalise-only path, unchanged. Do not move
`getOrCreatePolicy` into the transaction, and do not reorder the phases.

**R3 — fill-empty-only, per part, reusing the hotfix script's SQL logic verbatim.** The rules are already written and
were verified against live data on 2026-09-29
(`atlas-server/src/scripts/copy-year-setup-shift-windows-events.mjs`, receipt
`D:/ATLAS-runtime-config/backups/year-setup-copy-20260929/receipt-year1.json`):
  - **scheduling policy** — copy only when the target year has **no** `scheduling_policies` row at all. Not a
    field-by-field merge; the packet says "only where the new year is empty".
  - **grade time windows** — copy a source window only when the target has no row for the same
    `(grade_level, program_type)`. This matches `uq_grade_shift_window`, so the unique key is the backstop.
  - **flag ceremonies / special events** — copy only when the target year has **zero** `policy_special_events` rows.
  Never update or delete a source row. Never overwrite a target row. Never touch another table.

**R4 — the policy copy is an explicit field map, not a wildcard.** `SchedulingPolicy` has ~45 columns including a
`constraintConfig` Json. Build the create payload from an explicitly enumerated list of the model's data columns
(excluding `id`, `schoolId`, `schoolYearId`, `createdAt`, `updatedAt`), and prove with a test that **every** column of
the copied row equals the source. A wildcard `INSERT ... SELECT` is refused.

**R5 — one audit row, written only when something was actually copied.** Action
`YEAR_SETUP_KEPT_FROM_PREVIOUS_YEAR`, recording the source year, both switches, and the three inserted counts. When the
plan copies nothing (a re-run, or everything already present) the row is **not** written, so the whole operation —
audit included — is idempotent.

**R6 — the source year is the most recent OTHER mirrored year that actually has something to copy.** Not
`getLatestAtlasSchoolYearId` (after activation that returns the new year). Exclude the target year, order by
`enrollProSchoolYearId` descending, pick the first year that has at least one of the three setups. Name it in the result
so the confirmation can say which year was kept from. If there is no such year, copy nothing and say so.

**R7 — the two switches are an overlap the packet resolves with the data model, not a question for the operator.** The
operator's own labels are used **byte for byte** (§4). They overlap on "flag ceremonies", because the feature genuinely
exists in two places. The boundary is: **switch 1 = the scheduling policy row** (school day length, teaching-hour caps,
break and lunch times, and the flag-ceremony times and on/off switches stored on the policy) · **switch 2 = the grade
time windows and the `policy_special_events` rows** (the per-grade start/finish rows and the scheduled ceremony/special
day rows). The one-line helper under each switch must state its own side of that line, so the reader can tell them
apart. Turning switch 1 off means the new year gets default school-day rules and **no** ceremony times; turning switch 2
off means it starts with no per-grade times and no scheduled days.

**R8 — no counts on the status read path.** `getRolloverStatus` is read by six surfaces including four other lanes'
pages. The switches therefore carry **static** one-line descriptions, and the counts appear only in the **apply
response**, on the post-apply confirmation the page already renders. Zero new requests. The plan function must be
zero-write; prove it inserts nothing.

**R9 — rendered proof at 1366×768 is a browser row, and the loopback render is labelled isolated.** jsdom does no
layout. The loopback render this cycle is `isolated` evidence that the copy is present, correct, and inside the header
budget; **acceptance on `https://njgrm.buru-degree.ts.net` after A4 deploys is Lane C's row** (§12).

## 3. Build

### 3.1 Server — `atlas-server/src/services/year-setup-carryover.service.ts` (new)

```ts
export type YearSetupCarryOptions = { keepSchedulingRules: boolean; keepGradeTimeWindows: boolean };
export type YearSetupCarryPlan = {
  sourceYearId: number | null; sourceYearLabel: string | null;
  schedulingPolicy: { source: number; targetExisting: number; toInsert: 0 | 1 };
  gradeShiftWindows: { source: number; targetExisting: number; toInsert: number };
  policySpecialEvents: { source: number; targetExisting: number; toInsert: number };
};
export function resolveYearSetupCarryOptions(input: unknown): YearSetupCarryOptions;  // absent/null/garbage ⇒ BOTH true
export async function planYearSetupCarryover(client, schoolId, toYearId, options): Promise<YearSetupCarryPlan>;
export async function applyYearSetupCarryover(input: {
  schoolId: number; toYearId: number; actorId: number;
  options?: Partial<YearSetupCarryOptions>;
}): Promise<{ plan: YearSetupCarryPlan; applied: boolean; auditLogId: number | null }>;
```

- `resolveYearSetupCarryOptions` is the fail-safe and is exported so it can be tested directly: any value that is not
  literally `false` is treated as `true`.
- One `prisma.$transaction(..., { isolationLevel: 'Serializable' })` computes the plan **inside** the transaction and
  inserts from that same plan. Do not compute the plan outside and insert inside.
- `applied` is true only when at least one row was inserted; `auditLogId` is null when nothing was copied (R5).

### 3.2 Wire into the rollover (the only production call path)

`enrollpro-rollover.service.ts` `applyRolloverSync`:
- `options` gains `yearSetupCarry?: Partial<YearSetupCarryOptions>`.
- Immediately before `failedPhase = 'policy'` / `getOrCreatePolicy(...)`:
  ```ts
  failedPhase = 'year-setup-carryover';
  const yearSetupCarry = await applyYearSetupCarryover({ schoolId, toYearId: activeYear.id, actorId: options?.actorId ?? 0, options: options?.yearSetupCarry });
  ```
- Add `yearSetupCarry` to the returned `sync` object and to the `ROLLOVER_SYNC_APPLIED` audit metadata.
- `resetDummyYearAndApplyRollover` and every other path inherit the same default because the default lives in
  `resolveYearSetupCarryOptions`, not in a caller. **Audit that no caller can turn the default off by omission.**

`runtime.router.ts` `/rollover-sync/apply`: pass the two raw body values straight through, unvalidated, so the
server-side default decides:
```ts
yearSetupCarry: { keepSchedulingRules: req.body?.yearSetupCarry?.keepSchedulingRules,
                  keepGradeTimeWindows: req.body?.yearSetupCarry?.keepGradeTimeWindows },
```

### 3.3 Client — two switches, plain, in the plain card

- `lib/settings.ts` `applyRolloverSync` accepts `yearSetupCarry?: { keepSchedulingRules?: boolean; keepGradeTimeWindows?: boolean }`
  and posts it. `RolloverStatus` gains the carry result on the apply type.
- `RolloverGuidanceCard` holds the switch state, **initialised to both `true`**, and passes it to the request and down
  to `PlainYearSetupCard`.
- `RolloverPlainYearSetupCard` renders the two rows **immediately above the primary action** — that is the moment the
  choice is made, so it belongs there, not on a settings page.
- `rollover-plain-copy.ts` owns every string, exported for the test.

**§8 file-size rule, and it is already breached.** `RolloverGuidanceCard.tsx` is **1008 physical lines today**, over the
1000-line cap. Adding to it is not allowed. Extract the three confirmation dialogs
(`termRepairDialog` / `recoveryConfirmDialog` / `markTestDataConfirmDialog`) into one sibling component so the file ends
at or below 1000, and prove the extracted dialogs still render. A test row pins the count with the literal method
recorded.

**Subtract, don't only add (design gate §11).** The plain card's existing `rollover-automation-line`
("Nothing changes in ATLAS until you press the button") is **removed from the plain card only** — the two switches now
make the pre-press state visible, so the reassurance line is redundant. It stays on the other five mounts, untouched.
This is the packet's stated exception to "add nothing without removing as much": the two switches are four short lines
and the removed line is one.

## 4. Exact copy (operator's own labels, byte for byte)

| Switch | Label | One short line |
| --- | --- | --- |
| 1 | `Keep last year's scheduling rules` | `Your school day, teaching hours and break times stay exactly as you set them last year.` |
| 2 | `Keep last year's grade time windows and flag ceremonies` | `Each grade keeps its own start and finish times, and your flag ceremonies and special days come with it.` |

Turning a switch **off** shows, in place of its line, `The new year starts empty for this.`

Post-apply, added to the confirmation the page already renders
(`plainStartedCopy`, `data-testid="admin-year-setup-started"`), only when something was kept:

- kept: `Kept from {yearLabel}: your school day rules, {windows} grade start and finish times, and {events} flag ceremonies and special days.`
- nothing to keep: `Nothing needed keeping — this year already had all of it.`

Counts are pluralised honestly for 0 and 1. No id, no year id, no banned word, no ellipsis, no second chip.

## 5. Acceptance rows — every row names its harness

**Server, `test:a7-year-setup-carryover` (new script → `node scripts/run-db-suite.mjs`, disposable
`atlas_restore_drill_*` only; it must fail closed if the connected database is not disposable, per §5).** Write these
**failing-first** — each row must be observed red on the base tree before the implementation makes it green, and the
red output is recorded.

| # | Row |
| --- | --- |
| S1 | Carry on an empty target copies the previous year's policy, the missing grade windows and the events — every copied policy column equal to the source |
| S2 | No overwrite: a target that already has a policy row, a window for a given `(grade_level, program_type)`, or any event row keeps its own values byte for byte |
| S3 | Switch off = no copy, per part, and no audit row |
| S4 | Idempotent: a second run copies nothing, inserts no audit row, and leaves every row byte-identical |
| S5 | **The fail-safe**: absent / `null` / `"false"` / `0` / `{}` / garbage in the request options both resolve to **keep** |
| S6 | The source year is never mutated — every source policy / window / event row is byte-identical after a carry |
| S7 | `planYearSetupCarryover` inserts nothing (zero-write) |
| S8 | The default cannot be turned off by omission: a caller that passes no `yearSetupCarry` at all still keeps |

**Client, `test:a7-year-setup-carry-switches` (new script).**

| # | Row |
| --- | --- |
| C1 | Both switches render **on** by default on the plain card |
| C2 | The two labels are byte-identical to §4 and each carries its one short line |
| C3 | Turning one off sends `false` for that part only; the other is still `true` |
| C4 | Every reachable string passes the existing jargon guard (also enforced by `test:a7-year-setup-plain-words`) |
| C5 | The other five `RolloverGuidanceCard` mounts render **byte-identically** to the base tree — the switches appear on `/admin/year-setup` only |
| C6 | `RolloverGuidanceCard.tsx` is ≤ 1000 physical lines and the extracted dialogs still render |

**Preservation (run all, must be unchanged):** `test:a7-year-setup-plain-words` 17/17 · `test:archive-school-year-a7c2`
13/13 · `test:past-year-id-space-c2` 5/5 · `test:ux-guardrails` 31/31 · `test:client-quality` 34/34 ·
`test:dup-read-callers` 75/75 · server `tsc` 0 errors · client `tsc` unchanged at the 1 pre-existing A2
`timetable-truth-labels-a2.test.ts` TS2367, byte-identical at base and outside this range.

**§11 — every new test file must be reachable from a committed `package.json` script in the same commit.** A test no
gate runs is not evidence.

## 6. Out of scope (do not touch)

Deployment, the term-cache apply, Teaching Load apply, generation, publication, any migration, the hotfix script's CLI
(§"do not change its CLI" — it stays the manual fallback until A7 is live), any companion repo, and the four other
lanes' `RolloverGuidanceCard` mounts. `getRolloverStatus` does not change (R8).

## 7. What the executor returns

One immutable candidate commit on `work/a7-year-carryover-c4`, a clean `git status --short`, the exact paths, the
failing-first red output for S1–S8, every gate command with its real result, and the worktree disposition. No
integration, no push to `main`, no deploy, no browser against the live origin.
