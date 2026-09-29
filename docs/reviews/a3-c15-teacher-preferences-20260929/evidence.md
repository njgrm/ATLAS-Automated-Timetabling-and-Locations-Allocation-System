# A3 c15 — rendered + gate evidence (item 45, "Teacher Concerns" → "Teacher Preferences")

Range `8a550b26..cd7a73b4` on `work/a3-c15-teacher-preferences`, plus the evidence correction commit that
carries this file. This artifact exists because QA found the packet-mandated evidence was **not committed**;
the screenshots were only in a temp directory. Everything below is reproduced by commands a reviewer can run.

## 1. Harness identity and pinning

- Preview: `scripts/dev/start-preview.ps1 -ClientDir E:/ATLAS-worktrees/lane-a3-c15-20260929/atlas-client -Port 5267`,
  started detached (PID 2880, listener 49500), `VITE_ATLAS_API=http://127.0.0.1:5101/api/v1` — the **candidate**
  worktree against **STAGING** (`:5101`), never live `:5001`/`:5174`/the Tailnet origin.
- Sign-in: `http://127.0.0.1:5267/__dev/staging-login` (dev-server staging login). The QA credential file was
  never read, printed or typed.
- Viewport **1366x768** for every row.
- `scripts/qa/ux-audit.js` is **NOT in the reviewed range**: it landed on `main` after the candidate's base
  (`8a550b26`) does not contain `scripts/qa/`. Pinned blob:
  `5ba83861e188e2d8b1b7c234cdafcb8aa3aaf250` (`origin/main`, identical in `D:\ATLAS`). The result below is that
  exact blob, evaluated in-page. A reviewer standing at the candidate must fetch that blob (or the current
  `origin/main`) to reproduce the row.

## 2. Rendered rows (real staging data, 1366x768)

| # | Row | Result | Evidence |
|---|---|---|---|
| P1 | Sidebar shows exactly one **Teacher Preferences** → `/faculty/preferences` | PASS | `a3c15-01`, `a3c15-02`; `documentElement.scrollWidth == innerWidth == 1366` |
| P2 | Breadcrumb `Teachers and Rooms › Teacher Preferences`; `h1` **Teacher Preferences** | PASS | `a3c15-01` |
| P3 | Real staging data: `S.Y. 2023-2024 · ACTIVE`, 21-teacher roster, **SANTOS, VINCENT LORENZO** selected → weekly availability grid, chip "Nothing saved yet" | PASS | `a3c15-02` (grid), `a3c15-03` (room-need + "Anything else" + Save) |
| P4 | `/faculty/concerns` → lands on `/faculty/preferences` (real navigation) | PASS | evaluated: `landed=/faculty/preferences`, `h1=Teacher Preferences` |
| P5 | `/faculty/room-preferences` → lands on `/faculty/preferences` (real navigation) | PASS | browser URL after navigation |
| P6 | Simple `More` menu row reads **Teacher preferences** → `href="/faculty/preferences"` | PASS | `a3c15-05` (Tools group, in the open menu) |
| P7 | Expert header link `Teachers you have talked to` → `/faculty/preferences`, tooltip "Open each teacher's preferences — …" | PASS (re-rendered; see §3) | `a3c15-06` |
| P8 | 0 occurrences of "concern" in **rendered text** on both surfaces | PASS | `document.body.innerText` → 0 on `/faculty/preferences` and `/timetable` (expert) |
| P9 | `scripts/qa/ux-audit.js` → `major: 0` | PASS | §4 JSON |
| P10 | Clickable-looks-clickable | PASS | sidebar item is a filled active row; the `More` row and the expert link are `outline` buttons with an icon, matching their neighbours; no read-only figure looks pressable |
| P11 | No error boundary / React error | PASS | console only: one 502 on `/enrollpro-api/settings/public` (staging companion unreachable) and 404s on `…/runs/latest` (staging has no generated run). Pre-existing staging conditions, not this change. |

**P8 wording is exact:** 0 in rendered text; **3 in `data-*` attribute values** — `teacher-concerns-header`,
`concern-save-state`, `concern-no-teacher-empty-state`. Those are stable test hooks, deliberately retained
(packet §3); they are never rendered.

## 3. Correction: the expert-header row WAS renderable

My first report said this row "could not be rendered" and substituted a built-bundle grep. **That was wrong.**
QA falsified it: in the Expert view the `More tools` trigger overflows the 1366 viewport (right edge 1400.7) and
the layout-toggle overlay covers its centre, but a strip at the right edge still resolves to the trigger.
Re-rendered here: `document.elementFromPoint` at `x = 1364, y = 148` → `timetable-advanced-more-tools`;
`page.mouse.click(1360, 148)` opens the panel; then

```
linkPresent: true   linkText: "Teachers you have talked to"   linkHref: "/faculty/preferences"
tooltip: "Open each teacher's preferences — when they can teach, the rooms they need, and your notes"
concernInRenderedText: 0
```

The built-bundle check (`atlas-client/dist/assets/ScheduleReviewWorkspace-*.js` carrying
``to:`/faculty/preferences` ``) is kept only as corroboration, **not** as the row's evidence.

## 4. `ux-audit.js` result (pinned blob `5ba83861`)

`/faculty/preferences` — `major: 0`, `mojibake 0`, `moreFilters 0`, `overflowing 0`,
`pageScrollsSideways false`, nothing under 12px, `tableCellsUnder16px 0`.
`/timetable` with `More` open — `major: 0`, same zeros, `menuItemPresent: true`.

The reported `smallText` entries are all `12px` and are pre-existing app chrome identical on every page
(sidebar rows, group eyebrows, status chip, the `More` trigger, the empty-state sentence). The 12.8px `More`
button and the 32px nav link heights are also pre-existing and unchanged by this rename. `major` counts only
text under 12px, so it is 0.

## 5. Gates — literal commands and tallies

Green, on the candidate (`atlas-client/`):

| Command | Tally |
|---|---|
| `npm run test:scheduler-concern` | 26 tests / 26 pass / 0 fail |
| `npm run test:a3-c6-concerns` | 16 / 16 / 0 |
| `npm run test:a3-c6-route-hygiene` | 11 / 11 / 0 |
| `npm run test:a3-c8-room-preach` | 13 / 13 / 0 (includes the 3 additive `A3C15-*` rows) |
| `npm run test:timetable-ux-rehaul` | 36 / 36 / 0 |
| `npm run test:scheduler-collaboration` | 5 / 5 / 0 |
| `npx tsx --test src/lib/__tests__/timetable-dynamic-workspace-rendered.test.ts` | 18 / 17 / 1 (the 1 is the pre-existing row, §6) |
| `$env:VITE_ENROLLPRO_URL='https://dev-jegs.buru-degree.ts.net'; npm run build` | exit 0, `✓ built in 3.73s` |
| `npm run typecheck` | 5 errors, all in files with **zero delta** from base; 4 are `TS2307 Cannot find module 'playwright'` (the shared `node_modules` donor has no playwright), 1 is a pre-existing `TS2367` in `timetable-truth-labels-a2.test.ts:523` |

**No "all gates green" claim is made — the packet's §5 list was unsatisfiable as written** (three listed
suites are red on `main` for reasons that predate this change). The honest position:

| Suite | base `8a550b26` | candidate | Verdict |
|---|---|---|---|
| `npm run test:client-suite` | 1305 tests / 1266 pass / **39 fail** | 1306 / 1267 / **39 fail** | **no regression** — the 39 failing test *files* are the identical set on both sides (`Compare-Object` of the two `test at src…` lists is empty in both directions) |
| `npm run test:ux-a2-c13-calm-loading` | 12 / 11 / 1 | 12 / 11 / 1 | same file, same class: the golden nav table in `a2-c13-one-place-name.test.tsx:82` is stale for `School Year`, `Room Preferences` and `Room Schedules` (A7 C6 / A3 c13) — nothing to do with this rename |
| `npm run test:timetable-route-keys` | 59 / 57 / 2 | 59 / 57 / 2 | `ux-r03b-center-view-routes.test.ts:509`, `ux-r03e-timetable-runs-setup.test.ts:253` on both sides |
| `npm run test:publish-drift-revision-s4-client` | 28 / 25 / 3 | 28 / 25 / 3 | `timetable-dynamic-workspace-drift.test.ts` only; expected `/formatCheckedAtAge/`, `/data-testid="timetable-simple-regenerate-impact"/`, `/<SimpleDriftBanner/` — S4-client ids, pre-existing |
| `npm run test:a3-page-title-c1` | 14 / 10 / 4 | 14 / 10 / 4 | identical 4 failing names; stale `Faculty Preferences` rows (follow-up, below) |

The `+1` test in `test:client-suite` is `ux-r01-shared-chrome.test.tsx` 8 → 9: the additive row asserting the
retired `/faculty/concerns` alias resolves the page's chrome. Verified by counting `test(` in every changed
test file that this suite reaches (all others are unchanged in count).

## 6. Test-integrity correction made with this evidence

QA found the candidate's added assertion in `timetable-dynamic-workspace-rendered.test.ts` sat **below** the
pre-existing `timetable-simple-regenerate-impact` assertion, which fails on base and on the branch (S4-client
renamed that control). The abort made those rows dead code — a test that never runs is not evidence. The four
href rows were moved **above** it, with a comment saying why. After the move the file is 18 / 17 / 1 and the
surviving failure is the pre-existing `data-testid="timetable-simple-regenerate-impact"` row, byte-identical to
base. No assertion was deleted.

## 7. Follow-up rows (not gates on this rename)

- **F6** `atlas-client/src/components/__tests__/a3-canonical-page-title-c1.test.tsx:274,343` still register
  `['/faculty/preferences', OfficerPreferences, 'Faculty Preferences']` — doubly stale now. File is in a
  pre-existing red suite (14/10/4, identical base and tip). Bounded test-only follow-up.
- **F7** Documents that now describe the opposite of reality, all still functional via the alias:
  `docs/prompts/a4-train-2026-09-29-8.md:16-17` (a **release-train packet** — A4's shipped-vs-claimed check
  could be misled), `docs/prompts/a2-c14-make-timetable-possible-2026-09-29.md:12,21,34,42,51`,
  `docs/prompts/a3-teacher-concerns-one-page-2026-09-29.md`.
- **F8** `atlas-client/src/components/timetable/simple/SimpleMoreMenuContent.tsx:231` — stale comment
  "Teacher concerns · Campus map · Manual edit".
- **F9** `atlas-client/src/components/timetable/TimetableStatusLegend.tsx:17` — the only remaining
  **user-visible** "concern" in the client: the Warning legend's "review the softer concern before saving".
  Generic English about warning severity, does not name this page, zero delta from base. Deliberately out of
  scope; recorded so the sweep is not read as "zero 'concern' anywhere".
- **F10** `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx:794` — the pre-existing header
  defect this rename sits next to: `div.absolute.right-3.top-3 z-20` overflows the 1366 viewport (trigger right
  edge 1400.7) and covers the `More tools` centre, leaving a ~12px hit strip; a neighbouring button is clipped
  mid-word. Zero delta from base. AGENTS.md §8 header-budget miss for whichever lane owns the Expert view.
