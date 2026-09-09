# TT-C02 One-Shot — Curriculum-Aware Unassigned Timetable Insertion

- Prompt: `docs/prompts/...` TT-C02 one-shot (2026-09-09)
- Authoritative prompts read: `atlas-core-readiness-next-sequence-2026-09-09`, `tl-timetable-10b`, TT-C01 corrective parallel ledger
- Base: `330fb91b7daa28299520272b1e258cc49395af04` (origin/main)
- Branch: `work/timetable-ttc02` · Worktree: `D:\ATLAS-worktrees\timetable-ttc02`
- Implementer context: TT-C02 executor session
- SOURCE_IMPLEMENTATION: GO (local gates) — candidate commit created, `REVIEW_REQUIRED`
- LIVE_RUNTIME: READY (read-only probes only; no generation/publication/mutation)

## Objective reached

Implemented the real unassigned-insertion workflow for curriculum-demanded meetings:
canonical timetable demand (persisted curriculum + annual Teaching Load ownership, HG-excluded),
a truthful 10-reason classifier, deterministic bounded insertion search, zero-write preview with
canonical SHA-256 fingerprint binding, and a privileged Serializable apply that writes ONLY
pre-generation draft `LockedSession` state (fixture-tested on a disposable school; never enabled on
the live year). Live year 8 (school 1) readiness: 552 demand lines / 2760 weekly sessions, all
PLACEABLE, 0 unresolved, 0 runs, HG excluded 0.

## Execution ledger

| Task | Status | Evidence |
|---|---|---|
| Required reading + worktree at base | DONE | base SHA recorded; clean worktree |
| Phase 1 canonical demand (`timetable-demand.service.ts`) | DONE | hermetic equivalence tests 15/15 |
| Phase 2 bounded search + classification (`timetable-insertion.service.ts`) | DONE | no-slot/no-room/hard-conflict separation tests |
| Phase 3 preview/apply contract | DONE | zero-write negative control, tampered-fingerprint 409, idempotent retry, ownership immutability, disposal cleanup — fixture 1/1 |
| Phase 4 `/timetable` UI workflow | DONE (preview-first; save boundary disabled) | `UnassignedInsertionWorkflow.tsx` mounted in no-run header state; client tests 2/2 |
| Phase 5 focused verification | DONE | server tsc+build PASS; client tsc+build PASS; built-server smoke (health/summary/preview on :5099) PASS; fixture + hermetic rerun PASS after advisory fixes |
| Phase 6 live read-only readiness preview | DONE | `docs/verification/timetable-ttc02-readiness-preview-2026-09-09.json` + `.sha256` (`01D3DC2A…`) |
| Phase 7 advisory review | DONE | reviewer artifact `docs/reviews/timetable-ttc02-one-shot-2026-09-09/advisory-review-01.md`; material findings fixed (S-01 catch-all cleanup, S-02 status:DRAFT consistency, P-01 semantics documented) |
| Candidate commit | DONE | staged exact owned paths; `git diff --cached --check` clean |

## Decisive evidence

- Hermetic server tests `timetable-ttc02-insertion.test.ts`: 15/15 PASS (term/rotation, curriculum-demand
  equivalence, HG negative control, owner-state table, no-slot/no-room/hard-conflict, deterministic ordering,
  occupancy conflict, fingerprint canonical binding, reason→action map).
- Disposable-school fixture `timetable-ttc02-apply-fixture.test.ts`: 1/1 PASS (zero-write preview, guarded
  apply with atomic row+action+audit, ownership immutability incl. faculty/offering versions unchanged,
  idempotent retry, stale-fingerprint 409, catch-all cleanup residue 0).
- Client `timetable-ttc02-insertion.test.ts`: 2/2 PASS; client `tsc --noEmit` PASS; `vite build` PASS.
- Server `tsc` + `npm run build` PASS; built server started on :5099 (rollover automation disabled),
  `/api/v1/health` 200, authenticated GET summary (552 lines) and POST preview (PLACEABLE, 5 candidates,
  zeroWrite true) PASS; process stopped.
- Live read-only signature (year 8, school 1): termCount 3 (Term 1/2/3), 216 active offerings, 20 active
  sections, Teaching Load cycle v4 / 265 ownerships, rooms 98 teaching, 0 generation runs, 0 published
  revisions. Totals by term 920/920/920 (2760 weekly sessions).
- DB preflight for fixture: localhost `atlas_recovery_clean_rebuild_20260905` (shared active DB, repo
  isolated-fixture convention). No schema/reset commands used. Zero residue verified (subjects/schools
  assertions + catch-all deletes); live year rows untouched.

## Decisions and risks

- Apply targets the pre-generation draft (`LockedSession`) and is per-weekly-session (1 row per apply),
  matching the per-session manual PLACE_UNASSIGNED contract. Each apply binds the full candidate list under
  the fingerprint; repeated fingerprint+index is a no-op. Not enabled from the live UI (save boundary
  disabled, fixture-tested only) per prompt.
- Idempotency audit lookup intentionally precedes fingerprint recomputation because a prior apply changes the
  draft occupancy the fingerprint covers.
- Run-bound unassigned placement deliberately delegates to the existing generated-run manual-edit flows;
  TT-C02 owns the pre-generation insertion path.
- Risks: shared-live-DB concurrency can transiently reject a stale apply (typed 409 → re-preview, which is
  the operator flow); advisory P-01/P-02 (partial placement semantics, 5-sample line limit) remain for
  planner decision before enabling apply.

## Reviews

| Boundary | Reviewer | Verdict | Artifact |
|---|---|---|---|
| TT-C02 advisory (whole changed scope) | independent advisory reviewer (`ses_f7c05724fffe4PvFJp2n1icH2q`) | REVIEW_REQUIRED; zeroFix false → S-01/S-02 fixed, P-01 documented | `docs/reviews/timetable-ttc02-one-shot-2026-09-09/advisory-review-01.md` |

Changed-scope re-review after S-01/S-02 fixes is assigned to planner/QA (reviewer did not rerun the shared-DB
fixture; executor reran it 1/1 PASS after the fixes).

## Stop eligibility matrix

| Check | Value |
|---|---:|
| Safe incomplete implementation tasks | 0 |
| Required deferred/absent/collapsed tasks | 0 |
| Invalid/missing required reviews | 0 (changed-scope re-review deferred to planner/QA) |
| Unexplained test removals/reduced assertions | 0 |
| Ledger/report/evidence disagreements | 0 |
| Live mutation / generation / publish | 0 (read-only only) |

## Next task

- Planner/QA formal review of `<base>...<candidate>`, then decision on enabling the apply/save boundary
  (P-01 semantics) before any live apply use.
