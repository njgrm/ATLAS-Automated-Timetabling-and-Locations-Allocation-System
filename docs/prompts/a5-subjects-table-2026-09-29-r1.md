# A5 C3 — `/subjects` table + one-look-per-control picker sweep (Lane A5, 2026-09-29)

Parent packet: `docs/prompts/a5-subjects-table-2026-09-29.md` (operator, two screenshots).
Routing input: `docs/handoffs/lane-c-to-a2.md` posts 2026-09-29 00:10 and 00:15.
Read first: `AGENTS.md` §2, §8 (**One look per control**, **Header budget**, **No-Scroll**,
**File size**), §10, §11, §16.

- **Base:** `origin/main` = `f02ed64a3e9fa07e4c470a42841b040979ffbfe5`
- **Worktree (yours, sole writer):** `E:\ATLAS-worktrees\lane-a5-c3-20260929`
- **Branch:** `work/a5-c3-20260929`
- **Risk tier:** MEDIUM (client-only, but a shared control primitive + a cross-page sweep;
  no server, no `prisma/`, no `ops/`, no env, no lockfile, no data)
- **Out of scope, do not touch:** `atlas-server/**`, `prisma/**`, `ops/**`, `package-lock.json`,
  `pages/TeachingLoad.tsx` (A6's, 995/1000 lines), `pages/Sections.tsx` and
  `components/sections/**` map components (A3's), the shared runtime, the live database.
  `AdminYearSetup.tsx` is shared with A7 — not in this slice.

---

## 0. Planner adjudications (already made; do not re-open, do not re-ask)

**J1 — the canonical picker is `@/ui/searchable-select` (`SearchableSelect`).**
`AGENTS.md` §8 says every picker is "the same `@/ui` primitive with the same trigger size,
border, placeholder style **and search behaviour**". `/timetable`'s entity picker already uses
`SearchableSelect` (`components/timetable/simple/SimpleHeaderHelpers.tsx:210`, trigger
`h-8 w-full min-w-[9rem] max-w-[18rem] text-xs`, `ariaLabel="Schedule for"`). Every other page
in the sweep uses Radix `@/ui/select` with its own chrome. Measured "before" inventory — this
is the defect, verbatim:

| Page | Control | File | Primitive | Trigger chrome today |
|---|---|---|---|---|
| `/subjects` | 5 filters | `components/subjects/SubjectFilterToolbar.tsx:140-228` | `@/ui/select` | `h-9 … rounded-xl border-slate-200 bg-white px-3 text-xs`, widths `w-40 w-24 w-28 w-36 w-28` |
| `/sections` | 3 filters | `components/sections/SectionsFilterToolbar.tsx:29,40,52` | `@/ui/select` | `h-10 text-sm` |
| `/faculty` | 4 filters | `pages/Faculty.tsx:755-793` | `@/ui/select` | `h-10 w-44 text-sm` / `h-10 w-36 text-sm` |
| `/teaching-load` | 4 filters | `components/faculty-assignments/TeachingLoadFilterBar.tsx:152,167,182,198` | `@/ui/select` | `w-40/w-44 … font-bold uppercase tracking-tight` + local `CONTROL_CHROME` |
| `/teaching-load` | section filter | `components/faculty-assignments/SectionGridMode.tsx:217` | `@/ui/select` | `w-45 h-10 … uppercase tracking-tight` |
| `/teaching-load` | year picker | `components/faculty-assignments/TeachingLoadHistoryView.tsx:166` | `@/ui/select` | `min-h-11` |
| `/timetable` | entity picker | `components/timetable/simple/SimpleHeaderHelpers.tsx:210` | **`@/ui/searchable-select`** | `h-8 w-full min-w-[9rem] max-w-[18rem] text-xs` |

Lane C's own instruction ("same `@/ui` picker as Timetable/Teaching Load") names two different
primitives; §8 settles it. **You change the five Radix rows to `SearchableSelect`, and you do not
change `/timetable`** — it is already the reference.

**J2 — one shared trigger variant, exported from `@/ui`.**
Add ONE exported class string in `atlas-client/src/ui/` (e.g. `picker-trigger.ts` exporting
`PICKER_TRIGGER_CLASS`) and a thin `FilterPicker` wrapper over `SearchableSelect` that renders
`{name}: {value}` and takes an even width. Every control in the table above uses it. §8: "if it
truly needs a new variant, add the variant to `@/ui` so every page gets it. … No page-local
`className` overrides that change a primitive's look." A page that keeps its own width/border/
padding string instead of the shared one **fails the guard in §5**.

**J3 — "even widths" and "same height as search".** All five `/subjects` filters get ONE width
class (the current `w-40/w-24/w-28/w-36/w-28` is the unevenness the operator named) and the same
`h-9` as the search input. The search input and the five triggers must share the height token, not
two hand-matched literals.

**J4 — a `HoverCard` does not exist in this repository.** `@radix-ui/react-hover-card` is not a
dependency, and adding one is a lockfile change outside this slice's authority. Use the existing
`@/ui` `Tooltip` for the full program name; §8 permits `Tooltip` and forbids only raw
`title=`. **Record this substitution in your handoff with the reason.**

**J5 — "add the vitest guard" → the repo's actual harness.** There is **no vitest** in
`atlas-client/package.json`; the committed harness is `tsx --test` (node:test) reached through
`package.json` scripts. Write the guard as a `tsx --test` file and wire it to a committed
`package.json` script in the same commit, so §11's "a test no gate runs is not evidence" holds.
**Record the substitution and the reason in your handoff** (§11: never substitute silently).

**J6 — `OWNER_DEPT:` leaves the page entirely, including the opt-in detail.** The operator's
words are "no raw `OWNER_DEPT:AP` strings **anywhere**". The detail affordance currently prints
`ATLAS records the owning code as OWNER_DEPT:AP, OWNER_DEPT:MAPEH.` Replace that with plain
words naming the **owning codes** (`ATLAS records the owning codes as AP and MAPEH.`). The codes
are the diagnostic; the `OWNER_DEPT:` prefix is storage syntax, so no information is lost.
A3-C4-1c's controls in `a3-subjects` (and any other test) that pin the stored-marker sentence are
**updated to pin the new honest sentence** — never deleted (§16: a correction that removes
evidence fails review).

**J7 — the primary ownership read is a comma list, not a sentence.** `Owned by AP, MAPEH` — not
`Araling Panlipunan and MAPEH departments`. Flatten `ownerDepartmentPhrase`'s output to
comma-joined names, and drop the trailing `department`/`departments` noun from the primary line
(the line already begins `Owned by`). Keep the stored-marker function's behaviour available for
J6's controls. Keep the existing all-or-nothing naming rule in
`subject-feature-presentation.ts` (a code the glossary cannot expand shows its own code — that is
what makes `AP, MAPEH` come out right, and `AGENTS.md` §8's glossary rule is unchanged).

**J8 — push authority.** The parent packet says "push to main after QA". Read with `AGENTS.md`
§14: A5 owns the integration closure for **its own** accepted candidate and pushes that closure to
`main` (the `bf1a7913` precedent, already on `main`), and posts `A5 ready for release at <sha>`.
**A5 does not deploy, does not cut over, and does not touch the shared runtime** — A4 merges the
pinned release. Do not push. Planner does it.

---

## 1. Slice A — `/subjects` (the operator's named offender)

**A1. Filters.** All five are `FilterPicker` (`@/ui`), ONE even width, `h-9` matching the search
input, and **each names itself untruncated**. The trigger's composed accessible name and its
visible label must read e.g. `Grade: All grades`, `Program: All programs`,
`Room type: All room types`, `Status: All statuses`, `Term: All terms` — never a bare
`All…`. Pass the filter's own name as `ariaLabel`; do not rely on the placeholder.

**A2. Drop the subject-code chip from the row.** `components/subjects/SubjectRow.tsx:157-174`
(the `<code>` chip and its `Tooltip`) goes, in the desktop row **and** in
`components/subjects/SubjectMobileCard.tsx:66`. The subject name is the row's title. The
`Archived`/`Active` badge stays. No new `title=` attribute replaces it (§8).

**A3. Program coverage — show the programs, abbreviated.** In `SubjectRow.tsx` the current
`programText` (`:104-109`) is `programFullLabel(code)` for one scope and `"{n} programs"` for
more. Replace it with **one chip per program scope**:
- visible label = the operator's own abbreviation from `PROGRAM_SCOPE_OPTIONS`
  (`subject-constants.ts`: `REGULAR → BEC`, `STE`, `SPA`, `SPS`, `OTHER → Other`); for a code not
  in that list (e.g. `SPJ`, `SPFL`, `SPTVE`) fall back to `programShortLabel` from
  `@/lib/deped-glossary`;
- chip colour = `PROGRAM_SCOPE_BADGE[code]`, with a neutral token for an unmapped code — do not
  invent a palette;
- the full name (`programFullLabel`) is available in the `@/ui` `Tooltip` (J4);
- **never** `"{n} programs"`, **never** the spelled-out full name as the visible label.
Apply the same treatment in `SubjectMobileCard.tsx` (it currently concatenates the program text
onto the grade line — that is two facts on one line; give programs their own line/chips).

**A4. Room need — one line per fact, no stacked sentences.** In `SubjectRow.tsx` col 4 the cell
renders room type, then `Owned by …`, then a feature count. Each fact keeps its own line and no
line carries a joined sentence. The ownership line is `Owned by AP, MAPEH` (J7). Apply J6 to the
`AccessibleInfo`/`Tooltip` detail so the literal `OWNER_DEPT:` appears nowhere in the page.

**A5. Confirm, do not assume, that c2b already covers the cell.** `ac8adf09`/`e73eb203`
(`ownerDepartmentRead`) already replaced the marker on the primary line, and the operator's
screenshot is of a build that predates it. **Prove it in the rendered row (§4) and report the
result honestly** — if it is already correct, say so; J6's detail change is still required.

**A6. No-Scroll at 1366x768.** `AGENTS.md` §8 no-scroll architecture on `/subjects`: no global
browser scrollbar. A live `Dashboard` violation is already open against another lane — do **not**
fix Dashboard; report only what `/subjects` does.

---

## 2. Slice B — the sweep, and the guard

**B1. Before/after picker table.** Produce
`docs/reviews/a5-picker-sweep-2026-09-29/picker-inventory.md`: one row per control — page,
control name, `file:line`, primitive, trigger class, width, height, self-naming label (yes/no),
search behaviour (yes/no) — with a **BEFORE** column (the J1 table above is your starting point;
re-derive it from source, do not copy it) and an **AFTER** column. This is the report the parent
packet asks for; it is evidence, not commentary.

**B2. Convert the five Radix rows in the J1 table to `FilterPicker`.** Same primitive, same
trigger class, same self-naming rule as A1. Existing `data-testid`s
(`teachers-grade-filter`, `teaching-load-history-year-picker`, …) and `aria-label`s are preserved
— the `aria-label` may be re-composed by the primitive, but the control must stay findable by
its current selector. Where a page's own filter vocabulary differs (e.g. `Grade taught`,
`All roster states`, `With teaching load`), keep that vocabulary as the option labels; only the
primitive, the chrome and the self-naming change.

**B3. `pages/Faculty.tsx` is 981 of 1000 lines (§8).** Extract the filter row into a
sub-component under `components/faculty/` **before** converting it, and land the extraction and
the conversion in the same commit. Do not push the file over the cap.

**B4. `components/faculty-assignments/TeachingLoadFilterBar.tsx` currently applies
`uppercase tracking-tight` and a local `CONTROL_CHROME` to its triggers.** That is a
look-changing override on a shared surface; the conversion removes it. `SectionGridMode.tsx:217`
and `TeachingLoadHistoryView.tsx:166` likewise. If a page genuinely needs a different look, add
it to `@/ui` so every page gets it (§8) — do not leave it page-local.

**B5. The guard.** A committed test (see J5) that **fails** when any of these is true:
- a filter control in the swept pages is built from `@/ui/select` instead of the shared
  `FilterPicker`/`SearchableSelect`;
- a trigger in the swept pages passes a `triggerClassName`/`className` that changes the primitive's
  look instead of the shared variant;
- the shared picker variant string is redefined page-locally rather than imported from `@/ui`.
Scope the scan to the swept files (an allowlist of paths), so it is a **guard**, not a
repository-wide style ban, and so it fails for a real violation — prove that by breaking one
control and showing the guard goes red, then restore it byte-exactly.

---

## 3. Failing-first, and what may not be weakened

Every new or changed assertion must be written and run **against this base first** and must fail
for the right reason before the fix. A test that fails only with `ERR_MODULE_NOT_FOUND`, or that
passes on the base, is not a failing-first proof.

Existing suites that pin the chrome you are deliberately changing
(`test:a3-subjects`, `test:a5-subjects-c1`, `test:a3-sections-map`, `test:a3-c10-room-picker-anchor-width-names`,
`test:client-quality`, `test:ux-guardrails`, and any `TeachingLoad`/`faculty` suite) must be
**re-run and, where they pin the old look, updated to pin the new one** — updated, never deleted
or skipped. `pages/TeachingLoad.tsx` is 995/1000 lines; do not add to it.

---

## 4. Rendered evidence — the planner drives the browser, you do not

`AGENTS.md` §11/§12: a user-facing fix is done when it is **seen rendered**, and a source-text
assertion is never acceptance. Custody split for this cycle:

- **You** produce the candidate, the tests, the gates, and a clean `vite build`.
- **The planner** starts the preview and runs the browser rows (you have no browser profile and
  §12 forbids sharing one).

So your handoff must state: the exact command to serve the built client on loopback, and the
`dist` path, so the planner can bring it up without rebuilding. Do not leave a server running, do
not start one in the foreground, and do not create a profile.

The planner will measure, on `http://127.0.0.1:5292/subjects` with `/api/v1` mocked, at **1366x768
and 1920x1080**:
1. each of the five filter triggers' **visible text** and `scrollWidth <= clientWidth` (no
   truncation);
2. all five triggers' measured height, and the search input's height, as equal numbers;
3. the five trigger widths as equal numbers;
4. the rendered `document.body`/table text containing `Owned by AP, MAPEH` (or the true equivalent
   for the mocked fixture) and **no** `OWNER_DEPT` outside an opened detail affordance — and,
   separately, no `OWNER_DEPT` at all with the detail opened;
5. the program cells reading `BEC` / `STE` / `SPA` / … as chips, never `programs` and never
   `Science, Technology, and Engineering`;
6. no subject code chip in the desktop row or the mobile card;
7. `document.documentElement.scrollHeight <= 768` (no global scrollbar) on `/subjects`, and the
   same on `/sections`, `/faculty`, `/teaching-load`;
8. zero console errors and zero error boundaries on each of those four routes.

Tell the planner the **mock fixture shape** your rendered assertions assume, and make the
committed tests use the same fixture (`AGENTS.md` §11: a control's fixture must come from the real
surface — the real `Subject.programScopes`, `requiredFeatures`, `gradeLevels`, `preferredRoomType`).

---

## 5. Gates you must run and report literally

Client only. Record the exact command and the exact tally for each; do not summarise.

- `npm run build` (client) — exit 0
- `npx tsc --noEmit -p atlas-client/tsconfig.json` — record pre-existing errors separately from new ones
- every test script you touch, plus the preservation set in §3
- `git diff --check` clean
- `git status --short` empty except the paths you intend to commit

`atlas-server` needs no gate: this slice changes **zero** server files. Prove it with
`git diff --name-only <base>...HEAD | Select-String "atlas-server|prisma|ops|package-lock"` returning nothing.

---

## 6. Deliverable

Two additive commits on `work/a5-c3-20260929` (slice A, then slice B + guard), then the evidence
files. Conventional commits. One page, no transcripts: base · candidate SHA · exact changed paths ·
what changed and why · decisive commands with results · risks marked `BLOCKING`/`NON_BLOCKING` ·
verdict. List every test you updated and say how it was updated. State J4 and J5 explicitly.
