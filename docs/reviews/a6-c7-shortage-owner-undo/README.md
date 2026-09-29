# A6 c7 — rendered evidence, 1366×768, `ISOLATED_LOCAL_BROWSER`

**Origin asserted on every capture:** `http://127.0.0.1:5290` — an isolated loopback
preview of the candidate worktree, `/api/v1` fully mocked, `VITE_ATLAS_API` pinned to
staging `127.0.0.1:5101` with **no** mocked request reaching a real server. This is not
ATLAS acceptance; the live-origin rows are owed to the next staging walk.

Candidate `fc7f4424` (product range `4244cd3e..fc7f4424`); before = base sources
`4244cd3e`, restored afterwards (`git checkout HEAD -- <paths>`).

| capture | state | what it shows |
|---|---|---|
| `before-base-cached-shortage.png` | base, `cached` + shortage | **The staging defect verbatim:** the amber degraded pill alone — no shortage line, no `Cover these classes`, header 6 controls — and the chip carrying the stacked `Next step · Last saved data — Assign teachers to open classes · …` |
| `before-base-live-shortage.png` | base, `live` + shortage | **Byte-identical to `a6c7-live-shortage.png`** (SHA-256 `79107C33…`) — the correct expectation, since the base defect only manifested while degraded. That identity also corroborates the before really was captured at base. |
| `a6c7-cached-shortage.png` | candidate, `cached` + shortage | `17 classes short: MAPEH 9, English 4, Fil 2 · 12 Sept roster`, `+2 more`, `Cover these classes` present and enabled; row 2 carries **one** claim |
| `a6c7-live-shortage.png` | candidate, `live` + shortage | same line and action, verified source |
| `a6c7-cached-clean.png` | candidate, `cached`, no shortage | the degraded pill alone, with c6's copy and its technical `Tooltip` |
| `a6c7-live-clean.png` | candidate, `live`, no shortage | `82% staffed · 17 classes need a teacher` |

Measured, not projected: the shortage text node is 330px wide with `scrollWidth` 330 and a
16px ink height — **one line** in both states. The band's 66–67px is the line member plus
the 28px `stateLineSlot` on a second flex row, a **pre-existing** arrangement present
identically in the base capture (a failed revert would have made the cached pair identical;
they are not). Header control count: 8 with the line, 6 without. First teacher row: 58px,
unchanged.

Not captured, and owed to the next staging walk as a named row: the **Sections view**'s
`Undo` and its `Assign teacher` / `Change teacher` labels (covered by `A6C7-5`/`A6C7-6` in
source only), and the live-origin acceptance of `Cover these classes`.
