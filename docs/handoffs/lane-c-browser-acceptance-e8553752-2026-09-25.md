# Browser acceptance: C1–C3 on live `e8553752` (Lane C, 2026-09-25)

- **Harness:** Claude in Chrome, operator's Chrome profile with the seeded "remember me" session (no credential
  typed). Origin asserted `https://njgrm.buru-degree.ts.net`; served entry `assets/index-CqO3DnVa.js` and CSS
  `index-BBttqTpl.css` = the `e8553752` build. Machine `ATLAS_RUNTIME_RELEASE_SHA` = `e8553752df97…`.
  Viewport ~1536x730 (desktop only; no responsive rows were required).
- **Mutations:** none. Only preview POSTs were sent; nothing was saved, scheduled, generated or published.
- **Tally: passed 10 / blocked 1 / unperformed 0 / NEEDS_SESSION 0.** Console: no errors on the checked pages.

## Rows

| Row | Result | Evidence |
| --- | --- | --- |
| C1 teacher leaving, Tolentino → Villanueva (Jonathan), Step 4 names the 1:45 PM Tulip/Orchid clash | PASS | "20 clashes found. Nothing has been saved."; "Villanueva, Jonathan would teach GR9 - Tulip (SCIENCE, Term 2) and GR9 - Orchid (SCIENCE, Term 2) at the same time, Monday 1:45 PM–2:30 PM" |
| C1 Step 5 unreachable without a clean check | PASS | Step 4 `Next` disabled; "Choose a different teacher" offered |
| C1 authenticated zero-write (deployment QA row 5d) | PASS (API level) | Only `POST …/runs/317/published-revisions/preview` 200 was sent. SHA-256 (first 8 bytes) of the GET bodies before 05:48:02Z / after 05:51:23Z: `published-revisions` 69935 B `85a43b290d47e56e` = same, revision id list identical; `runs?limit=20` 1364 B `76bae6588d744537` = same; `runs/317/manual-edits` 22 B `125b8b4260073264` = same; `effective-identity` differs **only** in `asOf` (two consecutive reads 1.5 s apart differ the same way). `audit_log` not read directly (no DB credential in reach); the structural proof from the deployment QA covers it. |
| C1 published swap uses the revision preview, never `/swap` | PASS | Wed MATH ↔ Thu ENG (GR7 Luna): only `POST …/published-revisions/swap/preview` 200; clash named (Aquino double-booked with GR7 Bonifacio · STE, Thu 10:45); `Schedule swap` disabled |
| C3-1 choose a new time on a free slot | BLOCKED (data) | Placement mode shows only the section's own window, and every slot in it is occupied (GR7 Luna: 40/40 slots in Term 2; all sections are 40 or 50 of 40/50). No free slot exists. The hover on a blocked cell explains why; no API path appears anywhere. |
| C3-2 swap from a selected class | PASS | Banner "Class A selected. Choose Class B on the grid."; cell outlined; grid scrollTop 211.2 before and after |
| C3-3 Draft: no published chip, no swap prompt | PASS on clean entry | `/timetable/pre-generation`: no chip, no swap prompt, one "Generate when ready". See F2 |
| C3-4 More → Schedule history shows its reason | PASS | "Nothing to show yet: no class has been moved, swapped or given a new room in this schedule." |
| C3-5 teacher leaving: type a name, press Enter | PASS | Typing "Tolentino" + Enter selected "Tolentino, Karen" and advanced to Step 2 |
| C2 Tolentino shows 3 sections | PASS | Row: 7.5h · 25%, 3 sections (5 classes across Mabini, Sampaguita, Tulip) |
| C2 labels | PASS | "School hard cap 40h", "30h max for this teacher", "(busiest term)", subject names with term labels, "Subjects that rotate by term count once" |

## Findings (all NON_BLOCKING for the release, dated 2026-09-25)

- **F1 — suspect swap-preview clashes.** Tue MATH ↔ Thu ENG in GR7 Luna (Term 2 view) is refused with "Section
  double-booked: GR7 - Luna would have ENG and MATH at the same time, Tuesday 10:00" and Room 3 clashes naming
  **Term 1** rows. An exchange of two classes cannot double-book its own section. Wed MATH ↔ Thu ENG did not show
  this. Likely rotating-family/term handling in the swap preview's merged validation. Needs a failing-first test.
- **F2 — placement prompt leaks into Draft.** After "Choose a new time" on the published view, opening Draft keeps
  "Select an available slot… Because this schedule is published, you will choose a start date next." (visible
  status, still there after 8 s). A clean entry into Draft is fine.
- **F3 — swap side panel stays open after Cancel.** The top prompt clears; the right "Swap class times" panel remains
  until closed.
- **F4 — EnrollPro unreachable during QA.** `runtime/context?verifyUpstream=true` took **4031 ms** and returned
  `source: atlas-persisted, stale: true`; Teaching Load shows "EnrollPro could not be reached". This confirms the
  ~4 s load is the 4000 ms upstream timeout, not ATLAS work. Whether EnrollPro itself is down is not checked here.
- Known, unchanged: A3 class advisers 0 / adviser credit 0h.

## Safe to show in the demo

- Teacher leaving through Step 4 (Tolentino → Villanueva): named clash, "Nothing has been saved", Step 5 locked.
- Teaching Load: Tolentino's workload panel (3 sections, busiest-term counting). Expect the EnrollPro banner unless
  EnrollPro is up.
- Published schedule: Schedule history reason; swap Class A selection; swap preview on **Wed MATH ↔ Thu ENG**.
- **Avoid:** "Choose a new time" (no free slot, every cell is Blocked); switching to Draft mid-move (F2); the
  Tue MATH ↔ Thu ENG swap (F1); clicking any Save/Schedule/Generate/Publish.

**Worktree disposition:** `E:/ATLAS-worktrees/lane-c-server-stall-c01` `KEEP_ACTIVE` (carries SERVER-STALL-C01).
