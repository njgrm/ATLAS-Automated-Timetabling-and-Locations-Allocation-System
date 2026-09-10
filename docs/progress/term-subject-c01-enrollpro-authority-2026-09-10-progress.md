# TERM-SUBJ-C01 — EnrollPro Term and Subject Scheduling Authority

Status: `REVIEW_REQUIRED`

## Boundary

- Managed worktree: `C:\Users\njgro\.codex\worktrees\7dcd\ATLAS`
- Branch: `work/term-subject-c01`
- Clean base: `e39da52013c78013a2ac7c0dd96b00f774014acd`
- Candidate: the single commit carrying this ledger; use `git rev-parse HEAD`.
- Companion inspection was read-only. No live migration, generation, demand
  materialization, Teaching Load apply, publication, merge, rebase, amend, or
  push was performed.

## Delivered contract

- EnrollPro school-year plus active-term responses normalize into a single
  school/year-bound contract with format, ordered identities, preserved labels,
  optional dates, active term, verification state, and SHA-256 semantic revision.
- `TRIMESTER` and `QUARTERS` are supported without a T1–T3 ceiling. Unsupported
  formats, duplicate identities, school/year mismatch, and an active term outside
  the ordered contract return typed blocked outcomes.
- Only a verified live contract is cached on the exact
  `EnrollProSchoolYearMirror`. A matching cache is visibly degraded; wrong-year,
  wrong-school, tampered, missing, or unreadable cache state blocks.
- `Subject.schedulingDisposition` explicitly separates `SCHEDULED_TEACHING`
  from `REFERENCE_ONLY`. The migration defaults existing rows to scheduled and
  changes only subject code `HG` to reference-only.
- Subject create/patch may edit disposition and reject EnrollPro-owned term
  count, format, identities, labels, and dates. Bootstrap-only fields remain
  protected.
- Rotation families resolve their explicit order against the verified terms.
  Missing family/order, duplicate order, and out-of-range order are returned as
  actionable Subject issues; no term label is inferred while authority blocks.
- The mounted Subject scheduling view exposes the term authority, each subject's
  disposition, resolved term, issues, and pure demand projection. Reference-only
  rows remain visible and advertise no timetable or Teaching Load demand.

## Contract examples

- Three-term fixture: `TRIMESTER`, `T1/T2/T3`, preserved labels “First/Second/
  Third Trimester”, date ranges, active `T2`.
- Four-term fixture: `QUARTERS`, `T1/T2/T3/T4`, derived quarter labels when the
  flat upstream shape omits labels, date ranges, active `T4`.
- Production endpoint: authenticated
  `GET /api/v1/subjects/scheduling-authority?schoolYearId=<EnrollPro year id>`.

## Disposable PostgreSQL proof

The configured source database was inspected read-only first: local PostgreSQL
at `::1:5432`, database `atlas_recovery_clean_rebuild_20260905`, one school,
one migration. All schema/write proof used only
`atlas_term_subj_c01_proof_20260910`.

1. Applied `0000_clean_baseline`, inserted four synthetic active subjects, then
   applied `0001_term_subject_authority`.
2. Result: `HG=REFERENCE_ONLY`; `ALT_HG`, `MATH`, and `SCI` all remained
   `SCHEDULED_TEACHING`; both cache columns existed.
3. Executed the documented rollback: all three added columns and the enum had
   zero remaining catalog entries.
4. Dropped/recreated the disposable database and repeated baseline plus candidate
   migration successfully.
5. The compiled mounted-route smoke created isolated school `9100041`, verified
   live fixture terms, persisted the exact-year cache, exercised create/patch and
   protected-term validation, then removed all isolated rows.

The disposable database was dropped after the final proof. The configured source
database and all live/Tailnet data remained untouched.

## Verification

- `npm exec -- tsx src/__tests__/term-subject-authority.test.ts` — 11/11 pass.
- Existing disposable Subject catalog truth suite — 106/106 pass after updating
  the expected protected-term outcome.
- `npm exec -- tsx --test src/lib/__tests__/subject-create-payload.test.ts` —
  8/8 pass.
- Client UX guardrails — 21/21 pass.
- Compiled `dist/__tests__/term-subject-authority-http.test.js` against the
  disposable PostgreSQL database — 1/1 pass through the mounted production route.
- `prisma validate` with a non-live validation URL — pass.
- Server `npm run build` (`tsc`) — pass.
- Client `npm run build` (`vite build`) — pass.
- `git diff --check` — pass before candidate commit.

## Known risks and follow-up

- The read-only EnrollPro checkout at
  `d1f0aa1c4b02d86ece67c0a1e284e3859743bfef` currently returns only school-year
  id/label on its integration route, and no matching active-term integration
  route was found. Until EnrollPro supplies this contract, ATLAS will correctly
  show blocked authority unless an exact previously verified cache exists.
- This replacement authority is now available to the Subject scheduling view,
  but this cycle intentionally does not switch generation, timetable demand,
  Teaching Load consumers, or remove the legacy Curriculum Requirements pages.
- The migration is a review candidate only and has not been applied to any live
  database.

## Collision check

- Compared this candidate's paths with the two active sibling Wave 1 worktrees
  from the same planning boundary: `work/rollover-rrux01` had no changes;
  `work/generation-zw01` had no overlapping production source or migration path.
- Expected documentation collisions exist on `CHANGELOG.md` and
  `docs/reference/atlas-runtime-source-of-truth-map.md`; integrators must combine
  the independent appended entries. No source-code collision was found.
