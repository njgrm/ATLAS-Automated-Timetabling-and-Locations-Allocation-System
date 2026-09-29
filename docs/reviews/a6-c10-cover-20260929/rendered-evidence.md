# A6 c10 — rendered proof on real staging data, 1366x768

**2026-09-29, ~21:20.** Preview `:5200` (pid 7800, killed after capture) against the **staging** API
`http://127.0.0.1:5101/api/v1`, session via `GET /__dev/staging-login`. Viewport asserted `1366x768` and
`window.location.origin === "http://127.0.0.1:5200"` on every row. School year **2023-2024**, the same
data the Codex audit of `e75d6b8f` read.

**The port was the whole blocker.** Staging's CORS allowlist covers `127.0.0.1:5200-5299` and
`localhost:5200-5299` only; I had used `:5301`/`:5302`, which sign in and then CORS-block every call. Lane
C's ruling was right and my earlier "staging's CORS changed" reading was wrong.

## R1 — the audit's BLOCKING finding is closed, and its number is now reconcilable

`/subjects` on `e75d6b8f` read **`MISSING COVERAGE 0`** with a per-row **`Full coverage`** while
`/teaching-load` said 72 classes short. Both were true of the same data: `coverage/summary` counts a
class as covered when a pair exists, and a to-be-hired record owns a pair.

| | before (`e75d6b8f`) | now (`:5200`) |
|---|---|---|
| `Missing coverage` | **0** | **16** |
| rows saying `Full coverage` | every row | **5** of 22 (genuinely covered) |
| rows naming the gap | none | **10** say `N need a real teacher`, **2** say `No real teacher` |

`screenshot: 05-subjects-coverage-truth.png`. The per-row figures now reconcile with Teaching Load:
MAPEH reads **20** here and the class list below reads **MAPEH 20**.

## R2 — `clicks-to-cover-with-real-teacher` is no longer 0

The audit recorded the cover window as unreachable. On `:5200`:

- Header control: **`73% staffed — See who needs a teacher`** (`screenshot: 01`), with the one quiet line
  **`From the saved roster (29 Sept)`** beneath it and **no second copy** of that fact anywhere in the
  header band — the duplicate sentence the c9 follow-up named is gone from the rendered surface.
- Pressing it opens **`Who still needs a teacher`**, `73% staffed. 72 classes need one.`
- **15 subject groups**, and inside them **72 class rows and 72 `Cover this class` controls** — one per
  class, each labelled with its class and grade (`Aguinaldo · Grade 7 :: Cover this class`).
  `screenshot: 02`.

The one action per **subject** is now one action per **class**, which is the difference the audit
measured.

## R3 — `Cover this class` opens on the right class, and tells the truth about the server

Pressing the first class row opens the window with `data-subject-id=6`, `data-section-id=25` and the
header **`Grade 7 – Aguinaldo · MAPEH`**. The hours clause is **absent**, not invented — no read supplied
weekly hours, and `coverClassHeaderLine` drops the clause rather than printing a guess. The to-be-hired
path is the last element, grey and link-shaped. `screenshot: 03`.

**Staging does not carry A8 c4's routes yet.** The window says so, in words:
`ATLAS cannot look up candidates for this class yet. The cover route is not on this server.` That is the
designed degraded state, and it is the proof that the three groups, the greyed over-cap rows and the
Allow prompt are **unrendered** — the cover-assign and permission-grant rows stay **BLOCKED on A8 c4
reaching staging**, and this post does not claim them.

## R4 — the Teachers tile no longer counts to-be-hired records as staff

`/teachers` `With load` renders **`11/11`** (screenshot: 04), over 11 real active teachers. The 14
to-be-hired records on the page (`Temporary teachers 14` chip, 14 rows tagged `Temporary`) are **not** in
that denominator — which is what makes `11/11` differ from the `34/34` the audit saw.

**Unproven rendered:** the tile's help sentence, which names the to-be-hired count. It lives in a
`@/ui` Tooltip behind the `With load help` button, and **no tooltip opened in this headless run** —
repeated hover with 2 s waits produced zero `[role="tooltip"]` nodes. The string itself is asserted
rendered-by-the-test at `a6-c11-teacher-truth.test.tsx` for six shapes, but **I did not see it on
screen**, so it is recorded as unproven rather than as passing.

## UX audit — `scripts/qa/ux-audit.js`, 1366x768, settled state (6 s wait)

| page | mojibake | moreFilters | overflowing | page scrolls sideways | smallText < 12px | **major** |
|---|---|---|---|---|---|---|
| `/teaching-load` | 0 | 0 | 0 | no | 0 | **0** |
| `/teachers` | 0 | **1** | 0 | no | 15 | **16** |
| `/subjects` | 0 | 0 | 0 | no | 20 | **20** |

`/teaching-load` — the surface this change touches most — is **clean**.

**The two non-zero pages are pre-existing and outside this change's diff, and I am not claiming them.**
`/teachers` carries a `More filters` disclosure plus 9.6–10.4px stat labels, grade badges and column
heads; `/subjects` carries the same 9.6px grade badges, `Owned by …` spans and `TERM n` chips. None of
those elements is in `git diff origin/main..HEAD` for this branch. The operator's rule is that a MAJOR
fails the proof, so **these two are reported to Lane C as outstanding on surfaces A3/A5/A7 own**, not
swallowed. A first audit pass taken while Teaching Load was still `Checking source` also flagged one
`overflowing` row (1070px box, 1141px content) on the row-2 band; it **did not reproduce** once the load
settled, and `Include other depts` is not the cause — the settled run reports `overflowing: 0`.

## Gates, on the merged tree

`test:a6-c11-teacher-truth` 6/6 · `test:a6-c10-cover-class` 17/17 · `test:a6-c9-staffing-figure` 7/7 ·
`test:a6-c8-subjects-coverage` 90/90 · `test:client-quality` 34/34 · `test:a6-teachers` 13/13 ·
`test:a6-teaching-load` 33/33 · `test:a6-tl-header-budget` 9/9 · `npm run test:encoding` (root) 1/1 ·
`npx tsc --noEmit` zero new errors. The single `test:a6-c6-calm-tl` failure (11/12) is A5 c4's, proven
red on a base `origin/main` worktree and targeting `SubjectFilterToolbar`, which this branch does not
touch.

## One fix this cycle found in someone else's change

`scripts/dev/start-preview.ps1` at `cc03c6b8` did not parse: `"PORT_OUT_OF_RANGE $Port: staging CORS…"`
— `$Port:` is read as a drive-qualified variable, so **every lane** got a `ParserError` instead of a
preview. Fixed to `${Port}:`. Without it no lane could take a rendered proof at all.
