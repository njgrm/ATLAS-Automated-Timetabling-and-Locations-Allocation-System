# A6 c8 rendered evidence — fix-doc items 39 and 17.1

Loopback vite preview of the candidate worktree, **proxied to the STAGING API on `127.0.0.1:5101`**,
signed in with the STAGING-ONLY QA account, viewport **1366x768**, `window.location.origin` asserted
`http://127.0.0.1:5277` on every row. This is a **preview render against real staging data**, not the
live Tailnet origin and not a mocked surface, so it proves the candidate behaves; it is **not** ATLAS
release acceptance, which is A4's and Lane C's on `https://njgrm.buru-degree.ts.net`.

Product commits `5f1c882f` + `b9ea9004`, base `94daebf7`, on `main` at `ca76a76c`.

## Item 39 — `/teaching-load` had no `More filters` menu left, and the row fits

### BEFORE (`before-teaching-load-1366.png`)

The toolbar is **two rows**, and the second one is the defect:

- line 1: `Search teachers...` / `Status: All` / `Department: All` / `Load: All` / undo, redo, `Discard`, `SAVE CHANGES`
- line 2: `Sort: Load, low` / **`More filters`**

Measured on the row element itself:

```
[data-testid="teaching-load-primary-filters"]  client width 1078
  search div 240 @x272 | Filter by status 208 @x520 | Filter by department 208 @x736
  | Filter by load 208 @x952 | Sort teachers 208 @x272  <- WRAPPED to line 2
  | teaching-load-more-filters 112 @x488 (line 2) | draft group 292 @x1058
```

The cause is arithmetic, not styling: at 1366 the toolbar's whole budget is **1078px** because the
page's left rail is 272px. Four `xl` pickers (4 x 208 = 832) plus the operator's `w-[240px]` search is
1072, and five 8px gaps take it to 1112. The `More filters` menu was not the only problem — the row did
not fit either, and the file's own header comment claimed a ~1326px budget that does not exist.

### AFTER (`after-teaching-load-1366.png`)

- **`More filters` is absent from the document entirely** — not in the body text, not as a test id, in
  any state. The two inclusion switches it used to hide are two direct toggles on the row, inside one
  shared `SWITCH_CHROME` box with a divider: `Cross-subject` and `No subject match`.
- All **seven filter controls are on one row**:

```
line 1 y=194:  search 240 | Status: All 106 | Department: All 137 | Load: All 98
               | Sort: Load, low 134 | switch group 301 @x1027  ->  right edge 1328, 22px slack
line 2 y=238:  draft group 292, right-aligned by ml-auto (undo, redo, Discard, SAVE CHANGES)
row width 1078, "More filters" in body text: false, test-id count 0, secondary row count 0
documentElement.scrollWidth 1366 === clientWidth 1366  (no page scrollbar)
```

The four pickers took the shared `auto` width variant, which is content-sized and therefore cannot
clip a server-supplied department name — the reason the four could fit at all. The search stayed at the
operator's `w-[240px]`.

**Second line, stated honestly:** the 292px draft-action group cannot share line 1 with 1065px of
controls inside a 1078px budget, so it wraps to its own line, right-aligned. It wrapped on the before
screenshot too. **With no saved draft the row is a single line**, and this packet did not and could not
verify that on staging because staging holds a saved draft and clearing it would be a write.

**Data note:** the staging active year rolled from 2022-2023 to 2023-2024 between the before and after
captures, so the teacher rows are not the same data. The toolbar evidence is unaffected; the two
captures are not a like-for-like dataset.

## Item 17.1 — a coverage count that opened nothing now opens the window

Reproduced first, on real staging data, before any code changed:

```
/subjects  [data-testid="subject-coverage-cell-5"]  "ESP/GMRC", text "18/20 covered"
  -> <div slot="badge" aria-label="ESP/GMRC has partial section coverage">18/20 covered</div>
  -> <button>  the AccessibleInfo info icon  </button>
  click that button            -> [data-testid="subject-coverage-dialog"] count 0   (opened NOTHING)
  click "Review teacher coverage for ESP/GMRC" -> count 1                            (worked)
```

After (`after-subjects-coverage-window-open-1366.png`), clicking the coverage count itself:

```
cell aria-label: "20 sections still need a teacher. Click to see which."
click -> [data-testid="subject-coverage-dialog"]  0 before, 1 after
window text: "Subject coverage" / "Assigned teachers and uncovered grade/program scope for
              Araling Panlipunan." / "No teachers assigned to this subject yet." / "Fix in Teaching Load"
              / "Some required sections still need a teacher for this subject." / GR7 GR8 GR9 GR10
              / "Fix coverage in Teaching Load" / Program scope chips
```

Read-only and in plain words: the window's only action is `onRetry` -> `fetchTeacherCoverage`, a GET.
The `Review` action in the row's action cell is unchanged; the count is a second, more discoverable
route to the same window, which is what the operator asked for.

## Reproduction

```
powershell -File scripts/dev/start-preview.ps1 -ClientDir <worktree>\atlas-client -Port 5277
# sign in at http://127.0.0.1:5277/login with the STAGING-ONLY QA account
# open /teaching-load and /subjects at 1366x768
```

`scripts/dev/start-preview.ps1` must pass the `/api/v1` prefix (it now does, see commit `aa2dcfdf`
from A9 c4 and the merge in `b2d7d8a4`), and `atlas-client/vite.config.ts` must allow the worktree
roots in `server.fs.allow` or every `@fontsource` file 403s and the page renders in a fallback font —
which would make the width numbers above meaningless.
