# ATLAS Live State

Single current-state document. Replaces the retired delivery register
(`docs/plans/atlas-active-delivery-streams.md`, historical only).
Keep this file short; update it only when live facts change.

Last verified: 2026-09-18 19:40 +08

## Objective

Presentable live demo on the active school year (`schoolYearId = 10`,
2031-2032) at `https://njgrm.buru-degree.ts.net`: exports
(class / teacher / room / summary) plus corrected Teaching Load and dynamic
timetable UX, with generation running end to end.

## Deployed runtime (verified)

| Item | Value |
| --- | --- |
| Product pin | `74c1f12a` (`1400bea2` is docs-only above it) |
| Release dir | `D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918` |
| Supervisor | PID 67028, owner `NT AUTHORITY\SYSTEM`, task-launched |
| Task | `ATLAS-Runtime-Supervisor` — ONSTART, SYSTEM, Highest, IgnoreNew, `PT0S` |
| 5001 (server) | PID 63688 — `atlas-server/dist/server.js` |
| 5174 (host) | PID 12992 — `ops/runtime/host.mjs` |
| Health | local health/ready 200, host live 200, Tailnet health 200, DB-backed read 200 |
| Entry chunk | `assets/index-CtOKnF1z.js` |
| Rollover automation | disabled (`ROLLOVER_AUTO_SYNC_ENABLED=false`) |

Machine env (all three are required; the task-launched process resolves the
release from these, **not** from its own directory):

- `ATLAS_RUNTIME_ENV_FILE` = `D:\ATLAS-runtime-config\atlas-server.env` (17 keys)
- `ATLAS_RUNTIME_SOURCE_DIR` = the release dir above
- `ATLAS_RUNTIME_RELEASE_SHA` = `74c1f12a5c06bb025a1a7a13088c1c5da1a76d74`

### Rollback

Set the two env vars back to
`D:\ATLAS-runtime-supervised-f0d65a531e34-20260918` /
`f0d65a531e34ded9d8148a1c3f7bf5ddbf2eec4a`, then stop and start the task.
Retained startable releases on disk: `f0d65a53`, `4ce73d15`, `3c4cc3cd`,
`798cd783`, `0eb3b67f`, `131baab7`, `20f07f59`, `405e5b18`.

## Hard dependencies — do not retire

- **`D:\ATLAS-runtime-supervised-0eb3b67fe94c-20260918`** is the live
  `atlas-server/node_modules` chain root. The live release links to it in a
  single hop:
  `74c1f12a...\atlas-server\node_modules` -> `0eb3b67f...\atlas-server\node_modules`.
  Lockfile identity verified identical (`9332EF25659983DA`) across
  `0eb3b67f`, `f0d65a53`, `74c1f12a`. Treat the target read-only; never run an
  install through the junction.
- `git config --system --add safe.directory "*"` is required. The SYSTEM-owned
  supervisor runs `git -C <releaseDir> rev-parse HEAD`; without it the pin check
  fails closed with `PIN_UNRESOLVED` (dubious ownership) and the task exits 1.

## Data state

- Database `atlas_recovery_clean_rebuild_20260905` @ localhost:5432.
- Active year = upstream `enrollProSchoolYearId` **10** (mirror row 551).
  Data tables key on the upstream id (10), not 551. Archived year = upstream 9.
- `grade_shift_windows` seeded for year 10 (ids 1-20). This was the real
  generation blocker: the client sends `enforceShiftWindows: true` by default
  while the table had 0 rows for year 10.
  Rollback: `delete from grade_shift_windows where id between 1 and 20;`
- Generation verified: run #314 COMPLETED in 7.2 s, 920 assigned / 0
  unassigned / 0 HARD violations, published revision 41, all four exports 200.
- Blocker arc closed: 66 -> 48 -> 110 -> 55 -> 69 -> 30 -> 0 (room, capacity,
  flag, scheduler search).

## Confirmed defects with ready packets

| Packet | Defect (confirmed live) |
| --- | --- |
| `docs/prompts/home-room-auto-assign-c01-2026-09-18.md` | Auto-assign places **all 20 sections of every grade into the Grade 10 Academic Wing**. Captured via `mode: 'preview'`, `overwriteExisting: true` (zero writes). Persisted manual assignment is per-grade correct, so the manual data masks it. Cause: every academic wing has `gradeScope=[]` -> all score any-grade -> tiebreak falls to `buildingName`, and `"Grade 10 Academic Wing"` sorts before `"Grade 7 Academic Wing"`. Needs a source fix **plus** a separate HIGH-gated `gradeScope` apply. |
| `docs/prompts/flag-compensation-slot-c01-2026-09-18.md` | The flag ceremony **occupies** the Monday 12:15-1:00 period and the displaced subject is **relocated to a Monday-only compensation row** (Science at 9:45-10:30 in `grade9STE_Sched.jpg`). `ec2430ab` ("in-period overlay") encodes the opposite and must be replaced. |
| `docs/prompts/export-presentation-c12-2026-09-18.md` | `Total minutes per day` writes one value into all five weekday cells; xlsx class-program renderer lacks borders/alignment/merged header; no grade palette (G7 green, G8 yellow, G9 red, G10 blue); header fields hardcoded empty. |
| `docs/prompts/published-revision-authority-c12-2026-09-18.md` | The published-revision path performs **no hard-constraint validation**, so a revision can introduce a HARD violation. No published-safe swap. `manual-edit.service.ts:461` leaks "Prompt 6". |

## Operator decisions — all resolved (2026-09-18)

1. **Flag interval** — compensation row is `9:15-10:00` (45 min), contiguous
   with `10:00-10:45`. Source's `9:45-10:30` / `60` assumed wrong.
2. **Shift window** — move G9/G10 STE/SPA/SPS to `09:15-18:30` so the
   compensation row does not precede its own section's window. (Data change,
   needs its own approval.)
3. **Flag slot** — HNHS runs **both** a morning and an afternoon shift, with a
   flag ceremony every Monday for **both**. The flag row is derived from the
   section's own shift, never a fixed clock time.
4. **Displacement strategies — three, all real, all required:**
   - **S1** Monday-only compensation row (`grade9STE_Sched.jpg`, G9 STE Science)
   - **S2** cross-day relocation into another day's free slot
     (`GRADE10_REGULAR.jpg`, G10 REGULAR Science -> Friday `11:15-12:15`)
   - **S3** partial occupancy, no relocation (`aral-prog_G7...`, the `6:00-6:45`
     row keeps a real subject for every section)
   Blocking-vs-overlay must be a **per-shift, per-program configuration** exposed
   through the existing `grade_shift_windows` authority. This **corrects** the
   earlier stance: `ec2430ab` is *right* for S3 and *wrong* for S1/S2.
   Deliberately left open: G7/G8 special programs spanning both shifts would
   attend **two** ceremonies and have **two** displacements — the model must be
   able to express that; it must not assume one.
5. **Displaced subject** — data-driven, never hardcoded `TLE`/`Science`.
   Relocation applies to the **special programs**; HNHS's shifting is an edge
   case caused by buildings under construction, and normal schools run whole-day.
6. **Totals semantics** — instructional minutes per weekday, **breaks excluded**,
   computed independently. Flag period counts as occupied.
7. **Export architecture** — DepEd prescribes curriculum and time allotments, not
   layout; division memoranda call the DO 9 s. 2026 samples "illustrative
   references ... not rigid or mandatory templates". Ship a default renderer
   matching the artifacts plus a template-override seam, with the grade palette
   **switchable** (the division blank form uses one accent, `83CAEB`).

## Two distinct class-program export shapes

- **Per-section** — one section per document, `Teacher` column (division
  template `DNO-CLASS-PROGRAM-TEMPLATE-2026-2027.docx`).
- **Grade-level master** — **all sections of a grade side by side as columns**,
  with `ADVISER` and `BLDG/ROOM NO.` rows
  (`aral-prog_G7_Class-Program_SY2026-2027docx.docx`).

Both are required. The master form is not a variant of the per-section form.

## School identity

HNHS — Hinigaran National High School. Masthead chain: *Republic of the
Philippines / Department of Education / NEGROS ISLAND REGION / DIVISION OF
NEGROS OCCIDENTAL / HINIGARAN NATIONAL HIGH SCHOOL*. Footer tagline: *"Tatak
Negrense: Smart, Healthy, Strong, Happy Schools!"*.

## Other open items

4. `DATA-CORRECTION-C01` is mis-targeted at the archived year and has 4 blocking
   findings — rescope onto year 10 or abandon.
5. SSO env activation needs one restart (must not overlap another runtime action).
6. Hygiene: untracked scratch `atlas-server/src/__probe-preflight.ts` in the
   integration worktree.

## Operator log viewing

`ops/runtime/atlas-logs.ps1` tails the merged supervisor log in an interactive
window (`-Stream all|server|client`). Two logon-triggered tasks open one window
per stream. The runtime itself stays SYSTEM-owned in the background: Windows
Session 0 isolation means a SYSTEM process cannot display a window on the
interactive desktop, so visible terminals must be launched in the user session.

## SSO — root cause found (2026-09-18)

The SSO code **is** on `origin/main` and **is** deployed: all three
COMPANION-SSO-C01 commits (`3e0103a3`, `fbb9dc63`, `c989f03d`) are ancestors of
main; server routes live in `atlas-server/src/routes/auth.router.ts` backed by
`services/companion-sso.service.ts`; client surfaces are
`lib/companion-config.ts`, `lib/companion-sso-client.ts`, `pages/SsoCallback.tsx`,
`components/app-shell/IntegratedSystems.tsx`.

**The blocker is client build-time configuration, not the runtime env.**

`lib/companion-config.ts` resolves the EnrollPro origin from
`VITE_ENROLLPRO_URL` — a **Vite build-time** variable:

```ts
export function resolveEnrollProBase(env = viteEnv()): string | null {
  const raw = env.VITE_ENROLLPRO_URL?.trim();
  if (!raw) return null;          // fail-closed: no raw-IP fallback
  return raw.replace(/\/+$/, '');
}
```

Evidence from the **served bundle** (`assets/index-CtOKnF1z.js`, 416,337 bytes):

| Needle | Occurrences |
| --- | --- |
| `dev-jegs` (the EnrollPro origin) | **0** |
| `VITE_ENROLLPRO_URL` (as a literal property name) | 1 |
| `atlas/reverse/start` | 1 |

So the bundle carries the reverse-start *path* but **no EnrollPro origin** — the
value was absent when `atlas-client` was built. `resolveEnrollProBase()` returns
`null`, every companion surface disables or omits its link, and the Integrated
Systems area renders as "not configured". That is exactly the reported symptom.

Contributing detail: `viteEnv()` accesses the env through a cast —
`(import.meta as unknown as { env?: ... }).env` — which can defeat Vite's
**static** `import.meta.env.X` substitution. Both the missing build value and the
cast need to be addressed.

Server-side runtime env already carries the four SSO keys plus the EnrollPro
keys (`ENROLLPRO_SSO_CLIENT_SECRET`, `ATLAS_SSO_REVERSE_CLIENT_SECRET`,
`ENROLLPRO_SSO_CALLBACK_URL`, `ENROLLPRO_BASE_URL`, `ENROLLPRO_API`,
`ENROLLPRO_PROXY_ORIGIN`, `ENROLLPRO_CLIENT_URL`, `ENROLLPRO_SERVICE_TOKEN`) and
they were loaded when the runtime was restarted for the `74c1f12a` deploy.

`SSO-ENV-ACTIVATION-C01` is `PLANNED` but **stale**: it pins live release
`8eb0511b`, which no longer exists. Superseded by `SSO-CLIENT-CONFIG-C01`.

## Program: UX-REHAUL-C01 (adopted 2026-09-18)

Doc set at `origin/docs/ux-audit-c01` @ `48c7ca49` (NOT merged to main):

- `docs/handoffs/ux-rehaul-handoff.md` (operating brief)
- `docs/reviews/ux-audit-c01/atlas-timetable-relaxed-view-audit.md` (F-01..F-18 + Round 2)
- `docs/reviews/ux-audit-c01/smart-ux-convergence-contract.md` (+ `...-DELTA-2026-09-18.md`)
- `docs/reviews/ux-audit-c01/smart-registrar-teacher-ux-identity-audit.md`
- Unintegrated prior art: `work/smart-ux-audit-c01` @ `7d047989`

Objective: rehaul the Timetable UX for older desktop scheduling officers. Build
on the Simple view; **demote Advanced to "Expert"** (do not fix it).

**Corrections to that handoff's stated "immutable state":**

| Handoff said | Actual |
| --- | --- |
| live release `f0d65a53` | **`74c1f12a`** — deployed and verified 2026-09-18 |
| `origin/main` = `1333b7fd` | advancing; `bb13e574` at last reconcile |
| SMART mirror `1bda233` | **stale** — synced to upstream `79b182c` on 2026-09-18 |

### SMART baseline re-pin (2026-09-18)

Upstream `madebyseaan/smart-final-capstone` was **34 commits ahead** of our mirror.
Our fork (`njgrm/Project_Capstone_Smart-Final-Defense`) was 54 behind and had
**zero fork-only commits**, so the sync was a pure fast-forward:

- local mirror `1bda233` -> **`79b182c`** (clean fast-forward)
- fork `1a22ad2` -> **`79b182c`** (fast-forward push, no history rewrite)

**The UX baseline and the delta's §2 corrections were authored against the old
pin and must be re-verified at `79b182c`.** Relevant upstream changes:
`ccd7a63 merge: restore companion SSO onto fixed main`,
`bb07410 feat(auth): enforce per-portal login gate with wrong-portal hint`,
`bb132c8 fix(rollover): RL-10a prefer EnrollPro's ACTIVE year over a pinned label`,
`a26cdca fix(ui): P1-13 sanitize interpolated CSS colors; P0-8 show 404 instead of
bouncing to login`.

## Operator decisions — resolved 2026-09-18

- **D-1 ADOPT.** The SMART convergence contract, **as amended by the delta**, is the
  UX authority — re-verified against the new pin. Carve-outs: it is UX guidance, not
  product authority (publication gates, ordered-term identity, actor-school scope and
  the no-scroll shell outrank any visual preference); the delta overrides the contract
  where they conflict (keep Radix, do not migrate to Base UI; copy SMART's visual
  *language*, not its component *usage* discipline — its own `PageHeader`/`DataTable`/
  `breadcrumb` have zero usage sites); its §15 stream order is superseded by the
  delta's revised order.
- **D-2 CYCLE ON, full program** (Tier 3: through UX-R05), with a standing stop at
  every HIGH boundary. Operator instruction: keep the tracking real but **do not
  reintroduce the ceremony** that previously consumed the budget.
- **D-3 AUTHORIZED.** `UX-P01` (TanStack Query data layer) may proceed. It gates
  `UX-R03` entirely.
- **D-4 already done** — `74c1f12a` deployed and verified by the planner.
- **D-5 covered** by the standing browser-QA authorization (disclose the login delta).
- **D-6 still unverified** — whether any published run shows warnings.

**Operator goal, stated plainly:** ATLAS must feel like the *same system* as SMART.
Today it reads as a distinct, disconnected product. That is the acceptance standard
for the whole UX program, not just token parity.

## Lane queue (single integration owner)

| Lane | Packet | State |
| --- | --- | --- |
| `HOME-ROOM-AUTO-ASSIGN-C01` | `docs/prompts/home-room-auto-assign-c01-2026-09-18.md` | **INTEGRATED** `9a263016` (QA `ACCEPT_READY` 10/10/0/0) |
| `UX-R06` | `docs/handoffs/ux-rehaul-handoff.md` §C | **INTEGRATED** `eff7d507` (round 1 `CORRECTION_REQUIRED` 14/12/2/0; round 2 `ACCEPT_READY` 8/8/0/0) |
| `UX-P01` | delta §3.3 / handoff §D | **INTEGRATED** `d2a94491` (QA `ACCEPT_READY` 15/15/0/0) |
| `SSO-CLIENT-CONFIG-C01` | `docs/prompts/sso-client-config-c01-2026-09-18.md` | **INTEGRATED** `0a06f306` (QA 12/11/1/0, `PLANNER_DECISION_REQUIRED` — see ruling below) |
| `FLAG-COMPENSATION-SLOT-C01` | `docs/prompts/flag-compensation-slot-c01-2026-09-18.md` | decisions resolved; large lane |
| `EXPORT-PRESENTATION-C12` | `docs/prompts/export-presentation-c12-2026-09-18.md` | ready; sequence after flag |
| `UX-R00` | refresh the SMART baseline at the new pin `79b182c` | ready |
| `UX-R01`, `UX-R01a`, `UX-R02` | delta §5 | ready |
| `UX-R03`, `UX-R04`, `UX-R05` | delta §5 | `UX-R03` now unblocked by `UX-P01` |
| `PUBLISHED-REVISION-AUTHORITY-C12` | `docs/prompts/published-revision-authority-c12-2026-09-18.md` | second wave |
| `UX-GUARDRAIL-SUITE-REPAIR-C01` | registered defect, see below | backlog |
| `SECTION-ROUTE-AUTHORITY-C01` | registered defect, see below | backlog |

### CRITICAL — every client build must set `VITE_ENROLLPRO_URL`

`SSO-CLIENT-CONFIG-C01` added a **fail-closed production build guard**. A production
`vite build` without `VITE_ENROLLPRO_URL` now **exits 1** and emits **no bundle**:

```
Error: [atlas-client] Missing required production build configuration: VITE_ENROLLPRO_URL.
```

Verified on the merged tree: without the var → exit 1, no bundle; with
`VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` → `✓ built`, and the emitted
bundle carries the origin (`dev-jegs` x2, previously **0**). A development build and
the Node test runner are unaffected.

**Consequence for the next deploy:** the release build pipeline must export
`VITE_ENROLLPRO_URL` before building `atlas-client`, or the build will fail by design.

### SSO ruling — deferred browser row (planner decision)

QA returned `PLANNER_DECISION_REQUIRED` (12/11/1/0) on
`SSO-CLIENT-CONFIG-C01`. Source, build, security and server-side gates all pass; the
single blocked row is the packet-mandated **live authenticated Tailnet browser
rendered-state** check, which is **unsatisfiable before deployment** — the host still
serves the pre-fix bundle, and no authenticated session is available.

**Ruling: explicitly DEFERRED to post-deploy acceptance**, recorded as a deferral with
its reason — not downgraded to non-blocking. It becomes a mandatory row of the next
client deployment's acceptance, together with the end-to-end EnrollPro cross-system
session. Nothing was deployed by this lane.

### Corrected SSO root cause

The packet's original premise — that `viteEnv()`'s cast defeats Vite's static
substitution — is **FALSE**, disproved by QA on Vite `8.0.3`/rolldown: the base builds
inline the origin correctly when the variable is present. The **sole** reproducible
root cause is the **missing build-time value**. R1 is retained on robustness and
explicitness merits only.

### Runtime identity — only the active state file counts

There is one `supervisor-state.json` **per release directory**. Only the one inside the
**active** `ATLAS_RUNTIME_SOURCE_DIR` is authoritative. A QA note reporting identity
drift (`f0d65a53` / `stopped`) was a false alarm caused by reading the stale file from
the previous release. Verified: machine env, both listeners (PIDs 63688 / 12992) and the
active state file all report `74c1f12a5c06`, `state: running`.

### Registered defect — `test:ux-guardrails` is vacuous (F4)

`atlas-client/package.json` runs `tsx --test` over three files, but
`src/lib/__tests__/ux-guardrails.test.ts` and
`src/lib/__tests__/public-schedule-grade.test.ts` **do not exist** — they were
deleted from `origin/main` by `4794bd9e chore(repo): remove local-only files
from tracking` while the script reference remained. `tsx --test` silently
ignores missing paths when at least one valid path is present, so the script
**exits 0 with 21 tests, all from `useTeachingLoadRouteIntent.test.ts` alone**.
Independently reproduced by both the executor and QA. Consequence: this suite
must **not** be cited as evidence, and the UX program's guardrail gate is
currently empty. Pre-existing; not introduced by any lane.

### Registered defect — sibling section routes lack actor-school enforcement

QA found (pre-existing, outside the integrated range) that
`GET /home-rooms/:schoolYearId` (`section.router.ts:163`),
`PUT /home-rooms/:schoolYearId` (`:185`), and `POST /sync` (`:116`) still accept
a caller-supplied `schoolId` without actor-school enforcement. The
`auto-assign` route gained that check in `HOME-ROOM-AUTO-ASSIGN-C01`; its
siblings did not. Recommend a bounded successor lane.

### Live `gradeScope` apply is still required

The integrated source fix is **not sufficient alone**. With all four wings still
`gradeScope = []`, the corrected ordering routes all 20 sections to the **Grade 7**
wing instead of Grade 10 — better, but still wrong. Per-grade parity needs the
separate config apply `1->[7], 2->[8], 3->[9], 4->[10]`, which remains a
HIGH-gated action with its own preview and approval. **Do not press Apply before
that lands.**

## Live browser QA — authenticated session, 2026-09-19

First authenticated Tailnet QA session. Origin invariant asserted on every page
(`https://njgrm.buru-degree.ts.net`). One `LOCAL_LOGIN_SUCCESS` audit row created
(test account, identifier `1234501`).

### Verified GOOD on the deployed release `74c1f12a`

| Check | Result |
| --- | --- |
| Login + persistent session | works; session survives restarts via `playwright-profile` |
| **Simple header fix is LIVE** | **`Generate` and `Publish schedule` both rendered** |
| **Section dropdown order** | **correct**: Grade 7 -> 8 -> 9 -> 10, Regular then SPA/SPS/STE within each grade (20 options) |
| No-scroll shell | holds on `/timetable` and `/public/schedules` (no global scrollbar) |
| App console errors | 0 from the app itself (the 3 seen were the planner's own 401/422 probe fetches) |
| Active context | `S.Y. 2031-2032 • ACTIVE`, `Active Term: T1` |

### D-6 — ANSWERED (no defect; the mechanism already works)

**Run #315 is the published run** — `isPublished: true`,
`publishedAt 2026-09-18T05:38:27.923Z`, `publishedBy 46`,
`publication.revisionId 42`, `hardViolationCount 0`,
`blockingHardViolationCount 0`, `assigned 920 / unassigned 0`,
`termCounts {t1:920, t2:920, t3:920}`.

It carries **335 soft violations**, but they were explicitly acknowledged at
publication: **`softViolationsAcknowledged: true`**,
**`publishedSoftViolationCount: 335`**. The published-run summary also carries
`isPublished`, `publication`, `publishedAt`, `publishedBy` — keys that the
unpublished run lacks.

**Run #316 is the latest, UNPUBLISHED run** (`publication: null`). It has the same
335 soft violations and no acknowledgement.

So the capstone item 5 concern — "remove warnings once published" — is **already
satisfied**. The warnings the timetable header shows belong to the **unpublished**
latest run, which is correct behaviour.

**Observation (not yet a defect):** the UI header reads **"113 warnings"** while
the API reports **335** soft violations for the same run. Worth investigating
whether the UI is scoping the count to the selected section/term.

Soft-violation breakdown (identical on both runs): `FACULTY_EXCESSIVE_IDLE_GAP`
101, `FACULTY_EXCESSIVE_BUILDING_TRANSITIONS` 93,
`FACULTY_INSUFFICIENT_TRANSITION_BUFFER` 57,
`FACULTY_CONSECUTIVE_LIMIT_EXCEEDED` 51, `FACULTY_FLOOR_TRANSITION` 30,
`ZONE_IMBALANCE_WARNING` 3. All faculty-comfort metrics; zero hard.

### Confirmed visually

- **INTEGRATED SYSTEMS renders AIMS, SMART, ATLAS — but NOT EnrollPro.** This is
  the SSO symptom seen from the operator's side, and it matches the diagnosis:
  the deployed bundle was built without `VITE_ENROLLPRO_URL`.
- Nav still reads **"Timetable"**, not "Class Schedule" — expected deploy lag;
  UX-R06 is integrated in source but not deployed.

### Defects still open from this QA

1. **Term merging in the public schedule** — `/public/schedules` renders every
   cell 3x (2,760 entries = 920 x 3 terms; 720 of 1,320 groups hold 3 entries with
   distinct `termIndex` but identical room/faculty). Violates the ordered-term
   invariant. Real code defect.
2. **Stale published artifact** — Aguinaldo's persisted home room is
   `G7 Room 101 @ Grade 7 Academic Wing` but its published sessions sit in
   `G10 Room 101 @ Grade 10 Academic Wing`. Staleness, not a code defect; needs
   regenerate + republish (HIGH-gated).
3. **No Flag Ceremony/HGP row anywhere** — consistent with that lane being
   unimplemented.

### Accessibility observation

The section dropdown's 20 options carry no `role=group` / `aria-label` semantics,
so the grade grouping is visual only. Order is correct; grouping is not exposed to
assistive tech.

### Warning trustworthiness — audited 2026-09-19

Sample-verified against real schedule data (full detail in
`docs/prompts/warning-readability-c01-2026-09-19.md`):

- **335 API rows = 116 unique issues.** The API returns one row per term for the same
  underlying problem (`entry-523::t1/t2/t3`). The UI silently dedupes to **113**. Two
  screens, same schedule, different numbers.
- **The faculty-comfort math is CORRECT.** `FACULTY_CONSECUTIVE_LIMIT_EXCEEDED`
  verified exactly (4 x 45 = 180 min > 135 limit, `blockEntryIds` match the four
  contiguous entries); `FACULTY_EXCESSIVE_IDLE_GAP` verified exactly (Faculty 39
  Friday `06:00-06:45` -> `08:15-09:00` = the reported 90 min, breaks correctly
  excluded); `FACULTY_EXCESSIVE_BUILDING_TRANSITIONS` verified (6 entries -> 5
  transitions).
- **`ZONE_IMBALANCE_WARNING` is NOT trustworthy.** It fires because **0 of 103 rooms**
  have a zone configured, and reports "zone UNSPECIFIED has 100% of entries (920 of
  920)". A configuration gap presented as a schedule warning, carrying 920 entry ids.
- **`FACULTY_FLOOR_TRANSITION`'s message is broken**: `(14:30->14:30) with only 0 min
  gap` reads as a zero-length transition.
- **Duplicate classes overlap**: `FACULTY_CONSECUTIVE_LIMIT_EXCEEDED` and
  `FACULTY_INSUFFICIENT_TRANSITION_BUFFER` fire on the same faculty/day with
  overlapping entry sets.

### Regenerate / republish — status

**All 20 sections' persisted home rooms are per-grade correct** (verified live:
Grade 7 -> G7 wing, 8 -> G8 wing, 9 -> G9 wing, 10 -> G10 wing, no cross-grade
leakage). Generation consumes persisted home rooms (`homeRoomAssignedCount 2130 /
2130`), so **regeneration would produce correct room assignments**.

**But the auto-assign button is NOT yet fixed in live data.** The source fix is
integrated, yet all four wings still have `gradeScope = []`, so pressing auto-assign
now would move all 20 sections into the **Grade 7** wing. Order of operations must be:

1. the `gradeScope` apply (`1->[7], 2->[8], 3->[9], 4->[10]`) — small, reversible;
2. then regenerate + republish.

Both are `HIGH` and need explicit approval.

## Boundaries

- `D:\ATLAS` is a stale/dirty checkout (~466 behind) and is never an
  integration boundary. Real work happens in `E:/ATLAS-worktrees/*`.
- The harness may inject a stale `D:/ATLAS/AGENTS.md`; read the directive from
  Git bytes (`origin/main:AGENTS.md`).
- Companion repos (EnrollPro, AIMS, SMART) are read-only.
