# A7-C1 result — School Year Setup in plain words

- **Base:** `181c08df` (`origin/main`) · **Candidate:** `7ba884bb` · branch `work/a7-school-year-setup-c1`
- Tier MEDIUM. Source only. No deploy, no runtime, no database, no credential, no live action.
- **Verdict is not mine.** One fresh independent QA follows.

## Changed paths (12)

| Path | Change |
| --- | --- |
| `atlas-client/src/pages/AdminYearSetup.tsx` | plain intro, opt-in prop, `onApplied`, post-apply confirmation, "Past school years" |
| `atlas-client/src/components/runtime/RolloverGuidanceCard.tsx` | `plainLanguageNextStep` prop + plain branch, plain toasts, 2 dialogs hoisted (851 → 949 lines) |
| `atlas-client/src/components/runtime/RolloverPlainYearSetupCard.tsx` | **NEW** — the extracted plain card body (AGENTS.md §8 extraction) |
| `atlas-client/src/components/runtime/rollover-plain-copy.ts` | **NEW** — pure copy table, no React/requests |
| `atlas-client/src/components/runtime/CarryForwardReviewPanel.tsx` | plain copy (page-exclusive panel) |
| `atlas-client/src/components/runtime/RolloverResetPanel.tsx` | visible copy only |
| `atlas-client/src/lib/teaching-load-carry-forward-helpers.ts` | visible labels, headline, blocked message |
| `atlas-client/src/lib/__tests__/rollover-ui-guardrails.test.ts` | additive; old literal retained as a SUPERSEDED row |
| `atlas-client/src/components/__tests__/a7-year-setup-plain-words.test.tsx` | **NEW** — rendered-DOM suite, 10 rows |
| `atlas-client/package.json` | `test:a7-year-setup-plain-words` + one `test:client-suite` entry |
| `atlas-server/src/services/enrollpro-rollover.service.ts` | `message` prose only |
| `atlas-server/src/services/enrollpro-term-contract.service.ts` | `message` prose only (ruling R1) |

`code`, `action`, `classification`, `blockers[].code`, `state`, `fingerprint`, `confirmationText`,
`zeroWrite` and every gate condition are byte-identical. No endpoint, request body, `data-testid`
or branch condition changed.

## Before → after wording table

### `/admin/year-setup` (plain mode only)

| Before | After |
| --- | --- |
| `This page moves the old school year to read-only history (Archive and sync) and syncs the new school year from EnrollPro. Normal setup pages link here so year actions never appear beside routine work. The advanced destructive reset is reserved for genuinely disposable test data only.` | `Start the new school year in ATLAS after EnrollPro moves to it. Last year's schedules are kept for reference.` |
| `Automatic year sync is off. Sync stays manual.` | `Nothing changes in ATLAS until you press the button.` |
| `Preview` (and `Sync now`, and a self-link `Year setup`) | `See what will change first` (the **existing** preview handler, unchanged) + one primary `Start 2022-2023 in ATLAS` |
| `EnrollPro is now on <year>. Sync the new school year before creating a timetable.` (server) | `EnrollPro has moved to <year>.` (client) — server also plain: `EnrollPro has moved to <year>. Start <year> in ATLAS before building a timetable.` |
| — (nothing) | `2022-2023 is now the school year in ATLAS.` / `12 sections and 41 teachers were brought in from EnrollPro.` / `Next: check Sections, then Teaching Load, then build the timetable.` |
| `Open year setup` / `Year setup` linking to `/admin/year-setup` | **not rendered on this page** (other pages keep theirs) |
| `Archived school years` | `Past school years` |
| `These years are read-only history. Their schedules, sections, and teaching-load data are preserved and never win the active-year election.` | `These years are kept exactly as they were. You can look up last year's schedules and teaching load here.` |
| `Open read-only Teaching Load · N published run(s)` | `Open last year's teaching load · N published timetable(s)` |
| `Archive the old school year and sync the new one` (archive block) | `Keep the old school year, then start the new one` |
| `<year> (#7) — kept as history` | `2020-2021 — kept for reference` (id dropped) |
| `Mark only a disposable test year. Marking enables a separate review before any data is cleared.` | `Mark this school year as test data. Nothing is cleared until you review it.` |
| `Clear test data and sync EnrollPro` (recovery button) | `Clear leftover test data and start the new year` |
| `Clear test data and sync EnrollPro` (dialog title) | `Clear leftover test data and start the new year` |
| `This will delete ATLAS-owned data for school year #<id> and re-sync from EnrollPro…` | `This will delete ATLAS data for this school year and start the new school year from EnrollPro…` |
| `Clear and sync` | `Yes, erase and start the new year` |
| `Mark school year #<id> only when its ATLAS data is disposable test data…` | `Mark this school year as test data only when its ATLAS data is disposable test data…` |
| `N section(s) changed name, grade, or program since the last sync:` | `N section(s) changed name, grade, or program in EnrollPro:` |
| `sectionMirrors: 5, auditLogs: 9` (raw keys) | `ATLAS has N record(s) for this school year that do not match EnrollPro.` |
| `Synced <year> from EnrollPro.` (toast) | `<year> is now the school year in ATLAS.` |
| `Archived <y> and synced <x> from EnrollPro. History is preserved.` (toast) | `Kept <y> for reference and started <x> in ATLAS.` |
| `School year #<id> is marked as test data…` (toast) | `This school year is marked as test data…` |
| `ATLAS could not sync/archive the new school year.` (error fallback) | `ATLAS could not start the new school year.` |
| `Automatic year sync is on. Last checked <t>.` (when automation is enabled) | `ATLAS checks EnrollPro for you. Last checked <t>.` |
| `Automatic retry is waiting until <t> after N failed attempt(s).` | `ATLAS will check again <t> after N failed attempt(s).` |

### Carry-forward card (page-exclusive)

| Before | After |
| --- | --- |
| `Preview how compatible assignments from one archived year map into the current empty Teaching Load. This is a read-only preview; nothing is applied and archived history is never changed.` | `Copy last year's teacher assignments into this year's Teaching Load as a starting point. Nothing changes until you choose to confirm.` |
| `Archived source year` | `Which year to copy from` |
| `Choose an archived year` | `Choose a year` |
| `Preview carry-forward` | `See what would be copied` |
| `Zero-write preview` | `Nothing has been changed yet` |
| `N carry` | `N would be copied` |
| `Carry forward` | `Would be copied` |
| `Already occupied` | `Already filled` |
| `Owner unavailable` | `Teacher not available` |
| `Section unavailable` / `No current demand` / `Not qualified` | kept |
| `Over hard cap` | `Over the teaching limit` |
| `Ambiguous match` | `Needs a person to check` |
| `N target pair(s) … already occupied and preserved. Carry-forward fills empty pairs only.` | `N teacher + subject slot(s) … already filled and kept. Copying only fills empty slots.` |
| `Rows that would carry (review before any future approval)` | `Assignments that would be copied (nothing has been copied yet)` |
| `Apply is not available here. "Start from last year" always previews first, and any carry-forward apply requires a separate explicit approval plus the deployed runtime confirmation.` | `Nothing is copied here. "Start from last year" only shows you what would be copied, and copying it for real needs a separate explicit approval afterwards.` |
| `ATLAS needs a resolved active school year before a carry-forward preview is available.` | `ATLAS needs a settled school year before this can be shown.` |
| `No archived school year has Teaching Load history to start from yet.` | `No past school year has a teaching load to start from yet.` |
| `No archived rows were returned for this school year.` | `Nothing was found for this school year.` |
| `ATLAS could not prepare the carry-forward preview.` | `ATLAS could not show what would be copied.` |
| `N of M archived rows can be carried from X into empty pairs in Y.` | `N of M teacher assignments from X would be copied into Y.` |
| `No archived Teaching Load rows were found in X.` | `No teacher assignments were found in X.` |
| `No compatible rows can be carried from X; every archived row is preserved, occupied, or blocked.` | `Nothing from X can be copied; every assignment there is already filled, already kept, or cannot be used.` |

### Reset disclosure (page-exclusive)

`Advanced: clear disposable test data` → `Advanced: clear test data` · `Clear disposable test data` → `Clear test data` ·
`Only use this for genuinely disposable test data. Real school-year history must be archived, not erased.` →
`Only use this for genuinely disposable test data. Real school years are kept for reference, never erased.` ·
`Erase ATLAS disposable test data and sync the new school year` → `Erase ATLAS test data and start the new school year` ·
`Yes, erase and sync` → `Yes, erase and start the new year` · `No disposable test-data records were found.` → `No test data was found.` ·
`Reset is blocked` → `This cannot be erased` · `I understand this permanently erases ATLAS disposable test data.` → `… ATLAS test data.` ·
toast `Cleared disposable test data and synced <y> from EnrollPro.` → `Cleared test data and started <y> in ATLAS.`

### Server message prose (`message` only)

| Before | After |
| --- | --- |
| `EnrollPro moved to a new school year. Archive the old school year and sync the new one.` | `EnrollPro has moved to a new school year. Keep the old school year for reference, then start the new one in ATLAS.` |
| `ATLAS has dummy data using the EnrollPro year ID, but published schedule artifacts block a reset. Review migration before syncing.` | `ATLAS has leftover data under the EnrollPro school year, and a published timetable stops it from being cleared. Check it before starting the new year.` |
| `ATLAS has dummy data using the EnrollPro year ID. Reset dummy data and sync from EnrollPro.` | `ATLAS has leftover data under the EnrollPro school year. Clear it, then start the new year from EnrollPro.` |
| `EnrollPro active school year could not be verified. ATLAS will keep using saved setup data until the source is reachable.` | `ATLAS could not reach EnrollPro to check the school year. It keeps using the setup it already has.` |
| `ATLAS is aligned with EnrollPro <year>.` | `ATLAS is on <year>, the same school year as EnrollPro.` |
| `ATLAS already mirrors EnrollPro year <id> as <a>, not <b>.` | `ATLAS recorded this school year as <a>, but EnrollPro now calls it <b>.` |
| `ATLAS already has section data for school year #<id>, but it does not match EnrollPro <y>.` | `ATLAS already has section data for this school year, but it does not match EnrollPro <y>.` |
| `EnrollPro is now on <y>. Sync the new school year before creating a timetable.` | `EnrollPro has moved to <y>. Start <y> in ATLAS before building a timetable.` |
| `N section(s) were renamed, re-graded, or re-programmed. Review and acknowledge the changes before syncing.` | `N section(s) changed name, grade, or program in EnrollPro. Review them before starting the new school year.` |
| `N section(s) were renamed, re-graded, or re-programmed since the last sync. Review and acknowledge the changes before syncing.` (409) | `N section(s) changed name, grade, or program since ATLAS last read EnrollPro. Review them before starting the new school year.` |
| `ATLAS has existing data for school year #<id> that does not match the current EnrollPro feed. This may be leftover test data. You can clear it and re-sync from EnrollPro.` | `ATLAS has data for this school year that does not match EnrollPro. It may be leftover test data. You can clear it and start the new year from EnrollPro.` |
| `ATLAS has a marked test-data collision, but no clearable ATLAS-owned artifacts were found.` | `This school year is marked as test data, but ATLAS has nothing to clear.` |
| `ATLAS has a section ID collision. Mark this school year as test data before recovery can be offered.` | `ATLAS has leftover section data for this school year. Mark the year as test data to clear it.` |
| `EnrollPro moved to a new school year. Archive the old school year and sync the new one. History is preserved.` | `EnrollPro has moved to a new school year. The old school year is kept for reference.` |
| `ATLAS has a mapping conflict that requires manual review. This is not a test-data collision.` | `This school year needs a person to look at it. It is not test data that can be cleared.` |
| `EnrollPro has a newer active school year. Automatic rollover sync is ready to apply.` | `EnrollPro has moved to a newer school year. ATLAS can start it now.` |
| `Rollover requires manual review.` | `This school year needs a person to look at it.` |
| `EnrollPro active school year must be reachable before dummy data can be reset.` | `ATLAS must be able to reach EnrollPro before it can clear test data.` |
| `Saving stores only this school year's ordered term authority. It does not sync faculty, sections, or Teaching Load.` (R1) | `Saving stores only this school year's ordered terms. It does not bring in teachers, sections, or Teaching Load.` |
| `The requested school year is not an active ATLAS EnrollPro mirror.` (×2, R1) | `The requested school year is not the school year ATLAS is on.` |

## Planner rulings applied (2026-09-28)

- **R1 — the term-repair dialog message was in scope.** Changed
  `enrollpro-term-contract.service.ts` `message` prose only; **no test exemption exists**. The
  jargon row is un-exempted and covers `terms-repair dialog open`. The old literal is retained in
  the test file as a `SUPERSEDED 2026-09-28` comment beside the new one, per the additive rule.
- **R2 — `archivePreview.summary` / `syncPlan` stay machine data.** Plain mode renders its own
  sentence from `yearsToArchive` + `enrollProActiveYear.yearLabel`. Both fields remain on the wire
  and in the type; no server contract change.

## Decisive commands and literal results

| Command | Result |
| --- | --- |
| `npm run test:a7-year-setup-plain-words` | `tests 10 · pass 10 · fail 0` |
| `npm run test:ux-guardrails` | `tests 31 · pass 31 · fail 0` |
| `npm run test:client-quality` | `tests 34 · pass 34 · fail 0` |
| `npm run test:dup-read-callers` | `tests 75 · pass 75 · fail 0` |
| `npx tsc --noEmit -p tsconfig.json` (client) | base **5** → candidate **5** (all 5 pre-existing, A2 `timetable` tests) |
| `npx tsc --noEmit -p tsconfig.json` (server) | base **1048** → candidate **1048** |
| `git diff --cached --check` | clean |

**Failing-first proof on the load-bearing row.** Temporarily rendering `archivePreview.summary`
verbatim instead of the plain sentence turned row 1 red with
`state "mapping-conflict (archive-shaped)": the page still shows the word "sync": …Archive 2020-2021 (#7) as read-only history, then sync 2022-2023 from EnrollPro…`.
Reverted immediately. The ban discriminates.

## Test-state coverage map

Row 1 (jargon ban), row 3 (one primary), and row 4 (no self-link) each drive **all 11 states**;
row 1 additionally asserts each state rendered >40 characters and that the status card mounted, so
it cannot pass vacuously, and asserts `STATES.length === 11`.

| State | What it proves | Extra interaction |
| --- | --- | --- |
| `checking` | loading copy, no primary, no jargon | request held open, then released |
| `aligned` | `Nothing to do.` framing, no primary | — |
| `atlas-stale` | `EnrollPro has moved to …` + `Start <y> in ATLAS` primary | — |
| `mapping-conflict` archive-shaped | kept-for-reference block, id dropped, server summary not quoted | preview resolves |
| `mapping-conflict` clear-shaped | no silent start, leftover-data wording | classification fetched |
| `enrollpro-unreachable` | unreachable copy, no primary | — |
| carry-forward empty | empty-state copy | — |
| carry-forward with preview | summary, badges, reason labels, `target pair` gone | preview clicked |
| archived list present | "Past school years" + link copy | — |
| terms-repair dialog open | dialog copy + server term message (R1) | dialog opened |
| reset advanced open | disclosure + dialog copy | preview clicked |

Rows 2, 3b, 5, 5b, 6, 7 are single-state by design and name the state they cover.

## Not changed, and why

- **`archivePreview.summary` and `syncPlan` server strings** (R2, dated 2026-09-28): kept as
  machine data. They are technical by construction and the packet's server scope is `message`
  only. Not rendered verbatim on this page.
- **Non-plain mounts of `RolloverGuidanceCard`** (Dashboard, Sections, Faculty, TeachingLoad,
  `ScheduleReviewWorkspaceHeader`, `SimpleDriftBanner`): byte-identical wording. Proven by row 6,
  not asserted.
- **Server `serviceError` failure paths** other than the two listed above: not swept. They are
  failure states the 11 driven states never reach, and a wider prose sweep is a larger blast
  radius than this packet authorises. Listed as a follow-up row.
- **`active-term-adapter.service.ts`, `runtime-context.service.ts`, `school-year-drift-guard.service.ts`**
  still emit `ATLAS is aligned with EnrollPro …` and `Sync the new school year …` — they are not
  on this page's surface and belong to other lanes.
- **Toast copy is not DOM-asserted**: no `<Toaster/>` is mounted in the test, so the four changed
  toasts are covered by inspection only.
- **`enrollpro-rollover-automation.test.ts:579,629,831`** still contain the pre-change literals as
  *fixture inputs*, not assertions. Nothing asserts them, so they were left alone rather than
  editing another lane's fixture.

## Risks

- **NON_BLOCKING** — server `serviceError` prose sweep (see above).
- **NON_BLOCKING** — the two palette ratchets are **red at base**, not from this change:
  `palette-slate400-step2-a3-s-f` pins 95, measures 97; `a3-c8-warning-token` pins 230 raw-warning
  lines, measures 229. Proof: the four edited `.tsx` files hold identical per-file counts to base
  (AdminYearSetup 1/3, RolloverGuidanceCard 6/0, CarryForwardReviewPanel 8/3, RolloverResetPanel 0/0)
  and the one new `.tsx` file holds 0/0, so `HEAD` measures the same 97/229.
- **NON_BLOCKING** — `git commit --amend` was used once, immediately after creating `97cda125`, to
  strip a UTF-8 BOM PowerShell wrote into the subject line. No content changed and nothing was
  handed off at the time. Flagging it because amend is normally prohibited; A7 may object.
- **BLOCKING** — none.

## Worktree disposition

`KEEP_ACTIVE` until A7 integrates, then `RETIRE_AFTER_INTEGRATION`. `E:` free 25.97 GiB
(warn line 25 GiB; no release build was started).
