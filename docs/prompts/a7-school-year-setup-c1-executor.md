# Packet A7-C1-EXEC — School Year Setup in plain words (executor packet)

Issued by Planner A7, 2026-09-28. Parent packet: `docs/prompts/a7-school-year-setup-2026-09-28-c1.md`.

- **Worktree (your ONLY writable surface):** `E:/ATLAS-worktrees/lane-a7-school-year-setup`
- **Branch:** `work/a7-school-year-setup-c1` · **Base:** `181c08df` (`origin/main`) · confirm clean before editing.
- **Tier: MEDIUM** (server message strings are production source; one control is removed; the post-click
  confirmation makes new claims). You implement; **one fresh independent QA follows** — do not self-accept.
- `npm ci` is already running in `atlas-client/` and `atlas-server/`. Wait for it (`…\a7-client-npmci.log`).
  Then run `npx prisma generate --schema ../prisma/schema.prisma` from `atlas-server/` if a server build needs it.

## Why

The Wednesday 2026-09-30 demo runs four live EnrollPro rollovers through THIS page, in front of older school
schedulers. Operator, 2026-09-28: *"we really need to improve school year setup in both UX/UI and clarity of words
used/layman's terms. We don't need to get technical."* Screenshot:
`docs/reviews/operator-school-year-setup-20260928/school-year-setup-live.png`.

**The bar is the operator's sentence, not mine.** Fewer words, one verb per action, one primary button per card,
nothing technical on screen. A test that only asserts source text is not acceptance evidence for a user-facing
change; the rendered rows are what QA grades.

## Scope — yours, and only yours

| In scope | Out of scope |
|---|---|
| `atlas-client/src/pages/AdminYearSetup.tsx` | any other page (`Dashboard`, `Sections`, `Faculty`, `TeachingLoad`) |
| `atlas-client/src/components/runtime/RolloverGuidanceCard.tsx` (Year-Setup-only treatment, see §3) | EnrollPro adapters / timeouts (**A5 owns those**), `@/lib/api`, anything under `components/timetable/**` |
| `atlas-client/src/components/runtime/CarryForwardReviewPanel.tsx` | `atlas-server/src/**` except the `message` prose named in §6 |
| `atlas-client/src/components/runtime/RolloverResetPanel.tsx` (visible copy only) | routes, endpoints, auth, roles, gates, schemas, `prisma/`, `ops/` |
| `atlas-client/src/lib/teaching-load-carry-forward-helpers.ts` visible labels **only if** you prove the panel is the only importer | |
| `atlas-server/src/services/enrollpro-rollover.service.ts` — `message` strings only | |
| tests + one new `test:a7-year-setup-plain-words` script in `atlas-client/package.json` | |

**Behaviour must not change.** Same endpoints, same request bodies, same gates, same typed-confirmation phrases,
same confirmations, same `data-testid`s, same branch conditions. Copy and layout only. If you think a behaviour
change is required, stop and report it — do not make it.

## 1. The six defects, with the target words

Grade your own work against the operator's sentence, not against this list.

1. **Intro paragraph** (`data-testid="admin-year-setup-intro"`) is system talk. Replace the whole paragraph with
   **one** sentence pair, no more:
   > Start the new school year in ATLAS after EnrollPro moves to it. Last year's schedules are kept for reference.
2. **Status card → one next step.** Today it renders two badges + a heading + two helper lines + the
   `Automatic year sync is off. Sync stays manual.` line + three buttons (`Preview` / `Sync now` / `Year setup`).
   On `/admin/year-setup` it must render **what happened, what to do, ONE primary button, ONE plain secondary**:
   - what happened: `EnrollPro has moved to 2022-2023.`
   - what to do: `Start 2022-2023 in ATLAS.`
   - primary button label: `Start 2022-2023 in ATLAS` (year interpolated; when no year label is available,
     `Start the new school year in ATLAS`)
   - plain secondary: `See what will change first` — this is the **existing preview handler**, unchanged. Calm
     colour: no crimson, no destructive tone, on a safe read-only preview.
   - `Automatic year sync is off. Sync stays manual.` → `Nothing changes in ATLAS until you press the button.`
3. **Remove the circular link.** On this page, `Open year setup` / `Year setup` links back to
   `/admin/year-setup` — the page you are already on. Do not render a self-link here. Other pages keep theirs.
4. **After the click, a plain confirmation** of what changed and what to do next, in visible text (not only a
   toast): the year(s) that changed, how many sections and how many teachers were brought in, and the next step
   — `Next: check Sections, then Teaching Load, then build the timetable.` No ids, no codes, no `sync`/`mirror`/
   `election`/`drift`/`archive`. Counts come from the same `status.counts` the page already reads
   (`sectionCount`, `facultyCount`, `RolloverStatus.counts` in `@/lib/settings`) — the post-apply `loadStatus(true)`
   already populates them, so **do not add a request**. If counts are absent, say so in plain words
   (`Sections and teachers were brought in.`) — never invent a number.
5. **Carry-forward card in plain words.** `Start from last year (optional)` (keep) with
   > Copy last year's teacher assignments into this year's Teaching Load as a starting point. Nothing changes until
   > you choose to confirm.

   `Preview how compatible assignments from one archived year map into the current empty Teaching Load. This is a
   read-only preview; nothing is applied and archived history is never changed.` → the two sentences above.
   `Archived source year` → `Which year to copy from`. `Preview carry-forward` → `See what would be copied`.
   `Zero-write preview` badge → `Nothing has been changed yet`. Any visible `carry-forward` wording →
   `would be copied` / `copied`. Keep the machine reason **codes** (`ALREADY_OCCUPIED`, `UNQUALIFIED`, …) as
   `data-testid`/values, but the human labels under them must be plain
   (`Carry forward` → `Would be copied`; `Owner unavailable`, `Not qualified`, `Over hard cap`,
   `No current demand` → keep or simplify to layman's words; `target pair` → `teacher + subject`).
6. **"Archived school years" → "Past school years"**, and its helper line loses the election sentence entirely:
   > These years are kept exactly as they were. You can look up last year's schedules and teaching load here.

   `Open read-only Teaching Load` → `Open last year's teaching load`. The `(#123)` id in the archive flow list
   goes away.
7. **Server message strings this page renders** must read the same plain way. `enrollpro-rollover.service.ts`
   `message` prose only — at minimum: `EnrollPro moved to a new school year. Archive the old school year and sync
   the new one.`, `EnrollPro is now on <year>. Sync the new school year before creating a timetable.`,
   `ATLAS is aligned with EnrollPro <year>.`, the drift/sync/reset/recovery messages, and the
   `yearLabel (#id)` forms. **`code`, `action`, `classification`, `blockers[].code` and every gate condition stay
   byte-identical** — those are the machine contract. A server test asserting message text must be updated
   additively (retain the old row marked superseded with the authority + date beside the new one — never delete
   an assertion).

## 2. Layout rules (`AGENTS.md` §8 — mandatory)

- No global scrollbar. The page's scrolling region stays `flex-1 min-h-0 overflow-auto`; the **main step must be
  readable at 1366×768 without scrolling**.
- **One primary action per card** — exactly one `bg-primary`-style primary per card; the rest `outline`/`ghost`.
- No raw `<select>`, no raw unstyled `<button>`, no `<details>`, no `title=` attributes. `@/ui` primitives only.
- Inline stat lines, not metric cards, for the brought-in counts.
- Mouse-first targets: `min-h-11` on interactive controls.
- No React file above **1000 physical lines**. `RolloverGuidanceCard.tsx` is at 851 — **extract a
  sub-component before you add net lines to it** (the Year-Setup "next step" block and the term-repair dialog are
  the natural extractions).

## 3. Blast-radius control — the one design decision that matters

`RolloverGuidanceCard` is also mounted on `Dashboard`, `Sections`, `Faculty` and `TeachingLoad`, which **other
lanes own**. Therefore:

- The new plain-language treatment is **opt-in**, e.g. a new boolean prop `plainLanguageNextStep` (name it
  clearly) that `AdminYearSetup` passes. **Default it to the current behaviour** so the other four pages render
  byte-identical wording.
- Prove it, do not assert it: one test that renders the card in **both** modes and asserts the non-plain mode
  still produces today's strings.
- Exception, authorised: the shared automation line and the shared archive-flow block are reached from this page
  only in plain mode; leave their default wording untouched.
- `CarryForwardReviewPanel` and `RolloverResetPanel` are only mounted here, so change their copy directly. Before
  touching `teaching-load-carry-forward-helpers.ts`, **enumerate its importers** (`git grep`) and report them in
  your handoff; if another page renders those labels, gate the change behind a prop instead.

## 4. Tests

- **Update** `src/lib/__tests__/rollover-ui-guardrails.test.ts` for the new words (it asserts
  `Advanced: clear disposable test data` and one `<RolloverGuidanceCard` in `AdminYearSetup.tsx`). Keep the
  intent of every row; change the literal, not the claim. Additive only.
- **New** `src/components/__tests__/a7-year-setup-plain-words.test.tsx` — a **rendered-DOM** test (follow the
  existing jsdom pattern, e.g. `a3-c8-audit-calm.test.tsx`; run it with
  `node --experimental-test-module-mocks --import tsx --test`). Required rows:
  1. **The jargon ban**, over the *rendered text* of the page, in **every reachable state** you can drive:
     `checking` · `aligned` · `atlas-stale` (new year needs setup) · `mapping-conflict` (archive-shaped) ·
     `mapping-conflict` (clear-shaped) · `enrollpro-unreachable` · carry-forward empty · carry-forward with
     preview · archived list present · terms-repair dialog open · reset advanced open. Forbid, case-insensitively:
     `sync`, `synced`, `mirror`, `election`, `drift`, `archive`, `archived`, `carry-forward`, `dummy`, and any
     raw id of the form `#<digits>`. **`EnrollPro` is allowed** — the operator's own sentence uses it.
  2. The intro paragraph is at most two sentences and contains none of the removed system phrasing
     (`read-only history`, `Normal setup pages link here`, `advanced destructive reset`, `disposable test data`).
  3. Exactly one primary action per card, and the primary label names the year when one is known.
  4. The self-link row: no anchor whose `href` is `/admin/year-setup` renders on the page, in every state above.
  5. The post-click confirmation row: driving the primary action resolves to visible text naming the year and the
     brought-in counts, plus the `Next: check Sections, then Teaching Load, then build the timetable.` sentence —
     and issues **no new request** beyond the ones the page already makes (assert the request list).
  6. The non-plain mode row from §3: `RolloverGuidanceCard` without the new prop still renders today's strings.
  7. Carry-forward safety row: the panel's copy states that nothing changes until confirmation.
- **Reachable** (`AGENTS.md` §11): add a committed script
  `"test:a7-year-setup-plain-words": "node --experimental-test-module-mocks --import tsx --test src/components/__tests__/a7-year-setup-plain-words.test.tsx"`
  in the **same commit**, and add the file to `test:client-suite` if that suite is your regression surface.
  A test no gate runs is not evidence.
- **Gates to run and report, with literal commands and results:**
  `npm run test:a7-year-setup-plain-words` · `npm run test:ux-guardrails` · `npm run test:client-quality` ·
  `npm run test:dup-read-callers` (rollover-status dedup is in its blast radius) · `npx tsc --noEmit -p tsconfig.json`
  in `atlas-client` (record the pre-existing error count at base `181c08df` and at your candidate; a rise is yours) ·
  server `tsc` + build if you touch the server · `git diff --check` · `git status --short` empty.
  Report **the base and candidate tallies**, not just "green".

## 5. Handoff (one page, no transcripts)

`docs/handoffs/a7-c1-result.md` (in your worktree) with: base SHA, candidate SHA, exact changed paths, the
**before → after wording table** for every string you changed, the decisive commands with results, risks marked
`BLOCKING`/`NON_BLOCKING`, and a worktree disposition line (`KEEP_ACTIVE` until A7 integrates, then
`RETIRE_AFTER_INTEGRATION`).

**Zero residue:** clean `git status --short`, no stash, no untracked scratch, `E:` free space reported (it was
28.31 GiB at your start — report the final reading; below 25 GiB is the §3 warn line and you must say so).

## 6. What is NOT yours

A4 owns every deploy and every elevated action; you never build a release, never cut over, never touch the
supervisor, the database, generation or publication. A5 owns EnrollPro adapters and timeouts. A2/A3/A6 own their
pages and their accepted wording — if a change would alter what another page renders, gate it behind the §3 prop
and record it as a follow-up row instead of making it.
