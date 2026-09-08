# Advisory Review 07 — TL-C01R4A F-01 Delta Check (Fresh Changed-Scope Review)

- Reviewer: FRESH advisory reviewer context (did NOT implement TL-C01R4A or the F-01 fix; no shared
  state with the implementer). No reviewer spawn ID was supplied by the parent for this review
  (same caveat as review-06); independence basis is recorded instead: this reviewer implemented
  nothing, did NOT re-audit the full pass (review-06 stands for everything else), and verified every
  claim below from source with an independently rerun command.
- Date (UTC): 2026-09-08. Scope: F-01 delta ONLY — the added E9/E10 assertions in
  `atlas-server/src/__tests__/department-authority-gates.test.ts`.
- Authority: advisory only. This artifact does NOT mark formal GO and does NOT unlock any successor.
  The reviewer edited NO source files and wrote NO database rows except the suite's own disposable
  fixture cycle (created id=23 and removed by the suite itself, zero-residue proven).

## Delta identity

| Item | Value |
|---|---|
| Gates file full SHA-256 (reviewer recomputed) | `228BE876A074FE7F2143DC21E583C414CCFE2C6CCD5AB347A68C6908FBC47FE5` |
| Expected prefix | `228BE876` — MATCH |
| Review-06 hash of same file | `EB2893B6…` — differs, as expected (this IS the delta) |
| File size | 383 lines (review-06: 352; +31 lines, E9+E10 sections only) |

## Change isolation (nothing else moved vs review-06)

Reviewer recomputed SHA-256 for every other review-06 file — all identical:

| File | Review-06 hash | Current hash | Match |
|---|---|---|---|
| `atlas-server/src/services/department-authority.service.ts` | `27495D68…F930` | `27495D68…F930` | YES |
| `atlas-server/src/routes/faculty-assignment.router.ts` | `129BF3C6…B6491` | `129BF3C6…B6491` | YES |
| `atlas-server/src/__tests__/department-authority-apply.test.ts` | `488C3B54…190C1` | `488C3B54…190C1` | YES |
| `docs/verification/department-authority-apply-r4a.json` | `D1D8E74E…BBCF` | `D1D8E74E…BBCF` | YES |

- SCA-03E untouched: reviewer made zero edits of any kind; worktree `M`/`??` entries
  (client timetable surfaces, `curriculum-requirements.router.ts`,
  `curriculum-decision-candidates.service.ts`, decision-workspace files, `tmp/`, etc.) are the
  pre-existing concurrent-stream state already recorded in review-06 O-03, byte-identical in the
  TL-owned files per the table above.
- Git-visibility note: `atlas-server/src/__tests__/` is git-ignored (`.gitignore:65`
  `**/__tests__/`), so `git status` is blind to the gates file by design; hash comparison above is
  the operative change-detection method. Nothing staged/committed/stashed by this reviewer.

## E9 verification (from source read, lines 245–257)

- (a) Reads BOTH `docs/verification/department-authority-apply-r4a.json` and
  `department-authority-apply-r4a.sha256` from disk via `readFileSync` — YES (`:248-249`).
- (b) Recomputes `sha256(raw utf8 bytes)` → uppercase hex and asserts `sidecar.includes(byteSha)` —
  YES (`:253,:255`). Exact-match semantics: the recomputed digest must appear verbatim in the sidecar.
- (c) Asserts the artifact file contains no self-referential byte hash
  (`!raw.includes('"byteSha256"')`) — YES (`:256`).
- Both E9 assertions executed and PASS in the rerun below.

## E10 verification (from source read, lines 259–274)

- (a) Recomputes the fingerprint via the PRODUCTION `buildDepartmentAuthorityFingerprint`
  (imported from `department-authority.service.js`, `:264`), called with the artifact's own
  `scope.schoolId`, `proposedLabels` (code/label pairs), and `sourceRevision` — YES (`:265-270`).
  No duplicated hash logic; the service function is the authority.
- (b) Asserts `recomputed === payload.previewFingerprint` — YES (`:271`).
- (c) Asserts the approval sentence binds the fingerprint (`.includes(previewFingerprint)`) and
  `authorizesMutation === false` — YES (`:272-273`).
- All three E10 assertions executed and PASS in the rerun below.

## Independently rerun result (exact brief command, workdir `D:\ATLAS\atlas-server`)

`npx tsx src/__tests__/department-authority-gates.test.ts` → **59/59 PASS, Failed: 0**
(fixture school id=23; ephemeral route server started and closed; zero-residue assertion
`aliases=0, labels=0, school=0` PASS). Prior suite was 54/54; the +5 are exactly the 2 E9 + 3 E10
assertions, each visible as `[PASS]` lines naming the E9/E10 sections.

## Findings

- F-01 is CLOSED: the ledger's claim that the gates suite covers E9/E10 is now true by execution,
  not aspiration. The assertions are real (disk reads, production-function recompute, sidecar
  byte-SHA equality, no-self-hash, approval binding, no-mutation) — not tautologies and not
  hardcoded to pass.
- No new material defect introduced by the delta: the added sections perform only filesystem reads
  and a pure-function fingerprint recompute; they create no fixture rows, touch no live tables, and
  the full suite (E1–E8, recorder sensitivity, route gates, residue proof) remains green at 59/59.

## Verdict

- `zeroFix: true` — for this delta scope only. F-01 closed, zero new findings.
- Advisory only: no formal GO is marked by this artifact. Review-06's product verdict plus this
  delta closure are submitted to the parent/formal QA for the GO decision.
