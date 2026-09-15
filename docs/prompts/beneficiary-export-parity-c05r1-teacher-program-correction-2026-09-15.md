# CYCLE ON — BENEFICIARY-EXPORT-PARITY-C05R1 Teacher Program Correction

## Role and continuity

Act as **PRIMARY PLANNER** for one bounded source cycle. Spawn a bounded executor, freeze its candidate, commission fresh independent QA, return correction work to the same planner/executor context when context is healthy, and commission a Wave Completion Auditor only after source QA is accepted. Do not integrate or push to `main`; return the frozen accepted candidate to the head planner.

Prefer resuming the existing `BENEFICIARY-EXPORT-PARITY-C05` planner because it owns the candidate history and evidence. Start a fresh planner only if that session is unavailable, malformed, context-exhausted, or cannot account for the immutable range. A fresh planner must reconstruct identity from Git and the artifacts below; it must not trust pasted completion prose.

Canonical directive: fetch `origin/main`, read `origin/main:AGENTS.md`, and record LF-normalized SHA-256 `5f9206708a4763376dda1943c1ead28f49427ed1b1f0532ad25661f74ed3ebb5` (or stop and rebind the packet if current `origin/main` has a different directive hash).

## Immutable candidate boundary

- Worktree: `E:/ATLAS-worktrees/beneficiary-export-parity-c05`
- Branch: `work/beneficiary-export-parity-c05`
- Existing frozen candidate: `691a7c4a8e0587d6b9669aa332b764d7bc53b7b9`
- Worktree disposition: `PRESERVE_FOR_DECISION` until head-planner integration; then `RETIRE_AFTER_INTEGRATION`
- Preserve every existing commit. Do not amend, rebase, reset, squash, merge, or push.
- Add correction commits on top. Refresh `origin/main` only to record drift and integration risk; do not merge it into this worktree.
- The planner must verify the worktree is clean at dispatch. If it is dirty, inventory and attribute every byte before assigning ownership; never discard or blanket-stage it.

## Parallel-wave ownership boundary

This source lane may run while `WF-C04` and `TL-OPERATOR-WORKSPACE-C05` run, subject to these hard ownership rules:

- `WF-C04` exclusively owns `ops/workflow/**`, `docs/plans/**`, generated workflow state/register artifacts, workflow receipts, and any `AGENTS.md` workflow-rule change. This lane shall not edit them.
- `TL-OPERATOR-WORKSPACE-C05` exclusively owns `atlas-client/src/types.ts`, `atlas-client/src/pages/TeachingLoad.tsx`, `atlas-client/src/hooks/useTeachingLoad*.ts`, `atlas-client/src/components/faculty-assignments/**`, `atlas-client/src/lib/teaching-load*.ts`, `atlas-client/src/lib/faculty-assignment-helpers.ts`, and `atlas-server/src/services/teaching-load-reconciliation.service.ts`. This lane shall not edit them.
- Define export/signatory API types in dedicated export modules rather than the shared `atlas-client/src/types.ts` while the TL owner is active.
- This lane owns only beneficiary-export services/routes/tests, its new export-presentation settings modules/UI, any narrowly required Prisma model/migration source, and its handoff/review docs.
- The persistent Playwright profile is not required for source or DOCX render QA and shall not be opened by this lane. Use a unique `%TEMP%/opencode/beneficiary-export-parity-c05r1/<role-or-round>` render directory; never reuse an earlier QA directory or claim custody of another role's Word/renderer process.
- If implementation discovers a required edit in another lane's exclusive path, record the dependency and route a bounded request through the head planner. Do not silently widen ownership.

## Governing evidence

- Contract: `docs/reference/atlas-teacher-program-output-contract-2026-09-15.md` from this packet's branch or exact copied content below the executor handoff.
- Stakeholder DOCX: `D:/ATLAS/stakeholderFiles/Teachers-PROGRAM_SPEC-PROG-AFTERNOON.docx`
- Stakeholder image: `D:/ATLAS/stakeholderFiles/teacherSched+LoadActual.png`
- SMART reference mirror: `D:/smart-final-capstone` at `1bda23399204414f8d21c9fddbdf6b41a8e440d4`, **READ_ONLY**.
- SMART implementation leads: `src/pages/admin/SystemSettings.tsx`, `server/src/schemas/admin.ts`, `server/src/routes/admin-sub/system.ts`, and `server/src/lib/schoolSettingsSnapshot.ts`. Learn the editable-setting/year-snapshot pattern; do not copy SMART source or edit the companion repository.

The executor and QA must inspect the DOCX visually using the repository document workflow. They must not infer the visual contract from filenames or prose alone.

## Confirmed defects in candidate `691a7c4a`

1. `teacher-program-export.service.ts` computes `Total Teaching Load = advisory + teaching + ancillary`; the operator decision is that ancillary contributes zero.
2. It models persisted ancillary credits as weekly credited work instead of filling ordinary unoccupied shift periods as `Ancillary Work` for the teacher-program presentation.
3. `docx-export.service.ts` compacts teaching rows only; repeated configured break rows and ancillary rows remain noisy instead of forming truthful merged/weekday-compacted bands.
4. The current generated DOCX is a generic report and does not reproduce the structure, print geometry, header, border, profile, load block, and signature region of the authoritative template.
5. Signatory role labels exist, but the names are blank/hardwired to the selected teacher and there is no actor-scoped editable, year-bound signatory authority with historical snapshot behavior.

## Required one-shot correction

### A. Teacher-day projection

1. Build the teacher-program rows from the selected term's resolved timetable entries plus the canonical shift slots and effective `PolicySpecialEvent` rows.
2. For each canonical shift interval and weekday:
   - assigned class -> teaching row;
   - matching configured lunch/health/special event -> the configured event row;
   - otherwise -> `Ancillary Work`.
3. Never convert an ordinary unassigned interval into `Health Break`.
4. Do not persist ancillary filler rows into the generation run. They are an export/view projection and carry no room occupancy or conflict authority.
5. Compact equivalent teaching, ancillary, lunch, and health-break rows across Monday-Friday. Render day-specific exceptions explicitly.
6. Preserve selected-term subject, teacher, section, room, shift, and ordered-term identity. No all-term fallback and no missing-term-to-T1 fallback.

### B. Workload arithmetic

1. Remove ancillary minutes/roles from teaching-load totals, utilization, capacity, overload, and redistribution semantics in this export path.
2. `Actual Teaching Load` = teaching session minutes only.
3. `Total Teaching Load` = actual teaching minutes + effective adviser credit for a real adviser assignment.
4. Breaks, ancillary filler, HG/HGP, and ARAL contribute zero. AP remains an ordinary subject.
5. If ancillary responsibilities remain useful metadata, render them outside the load arithmetic with an explicit `not counted in teaching load` label; do not add an ancillary subtotal to the load block.
6. The teacher-program `Total minutes per day` or equivalent teaching total must exclude breaks and ancillary filler.

### C. Template reproduction

Rebuild the DOCX around the authoritative afternoon template: portrait print setup, decorative border, DepEd/school logos and identity header, centered title/SY, exact six-column schedule structure, merged break bands, compacted weekdays, load block, photo/profile block, signature hierarchy, and footer treatment. Preserve school-agnostic configuration and selected-term/run/publication identity. Do not emit the candidate's generic `CREDITED NON-TEACHING WORK`, `PROFILE`, or `SIGNATORIES` report sections when the reference expresses those elements through its compact form layout.

The target is recognizable template parity, not pixel-perfect copying of scanned imperfections. QA must compare structure, hierarchy, spacing, pagination, table geometry, merged bands, and content semantics.

### D. Editable signatories

1. Implement an ATLAS-owned, typed, school/year-scoped export presentation profile for School Head, PSDS, CID Chief, and ASDS names and displayed titles. Reuse a suitable existing typed persistence boundary only if it meets all scope/snapshot requirements; do not hide these values inside constraint-warning configuration.
2. Provide a privileged Scheduler Officer/IT Admin editor using shadcn/Radix controls. Place it in the operator's export/settings flow with a clear link from the Simple Timetable download area.
3. Require actor-school equality, active-year authority, optimistic revision/CAS, typed validation, one audit record on a committed change, and idempotent replay/no-change behavior.
4. A passive read, preview, or export shall perform zero writes.
5. Bind draft exports to the current effective profile and bind published/archived exports to an immutable publication snapshot or revision. Later edits must not rewrite historical output identity.
6. Resolve the teacher signatory from the selected teacher. Missing configurable names render blank lines, never invented people.
7. If a Prisma migration source is required, include it and its disposable-PostgreSQL proof, but do not apply it to the shared/live database.

### E. Existing export parity

Do not regress the already accepted selected-term boundaries, actor-school guards, official download duplicate suppression/error visibility, class/summary output paths, room export work, publication readiness, or ARAL-vs-AP semantics. Update the beneficiary contract/handoff to classify each material statement as `REQUIREMENT`, `CURRENT_STATE`, `SUCCESSOR`, or `HISTORICAL`; contradictory current/successor claims fail QA.

## Mandatory failing-first controls

The executor must show the relevant controls fail on `691a7c4a` (or with a byte-restored mutant when the old candidate cannot compile against the test), then pass on the correction:

1. A selected-term teacher fixture with classes, genuine health/lunch events, and ordinary gaps produces class rows, policy break rows, and `Ancillary Work` in the exact intervals.
2. Removing the canonical policy event prevents the break label and produces ancillary work; an ordinary gap never becomes health break.
3. Monday-Friday-equivalent teaching, ancillary, lunch, and health rows compact once; a one-day exception remains day-specific.
4. Ancillary, break, HG/HGP, and ARAL rows contribute zero to actual/total teaching load, overload, utilization, and capacity. An ancillary-in-total mutant must fail.
5. AP remains a teaching row and contributes its true teaching minutes.
6. Adviser credit is included only with effective policy plus real adviser ownership; missing/stale ownership contributes zero.
7. Exact selected-term section/teacher/room/session parity holds and no missing term becomes T1.
8. Signatory write route proves same-school authorized success, missing actor 401, wrong role/cross-school 403, stale revision 409, validation 400, replay/no-change zero additional writes, and one audit on committed change.
9. Passive settings read, preview, draft export, published export, and archived export are instrumented zero-write paths.
10. Changing active-year signatories changes a subsequent draft export but not a previously published/archived revision.
11. Extract the produced DOCX and assert the six headers, ordered schedule rows, merged break bands, teaching-load equation, absence of ancillary/ARAL load components, profile fields, and complete role hierarchy.
12. Render the authoritative DOCX and generated DOCX to PDF/PNG, visually inspect every generated page, and record a side-by-side checklist for border/header/logos/title/table geometry/merged bands/totals/profile/signatures/footer/pagination. A text-only pass is insufficient.
13. The produced DOCX opens successfully in Word/LibreOffice-compatible parsing and stays one page for the canonical reference-sized fixture. If data exceeds the page, repeated headers and non-overlapping continuation pages are required.

## Required gates

- All C03/C03R/C03R2/C03R3 and C05 export suites affected by the range.
- New teacher-program projection, arithmetic, signatory authority, publication-snapshot, route-mount, and render-parity suites.
- Derived-demand, selected-term, publication-readiness, actor-school, and Teaching Load workload-policy regressions.
- Disposable PostgreSQL migration/concurrency/zero-residue proof if persistence changes.
- Server and client `tsc --noEmit`.
- Server and client production builds.
- Built-server ESM import/start check for changed server modules.
- `git diff --check` over the immutable correction and cumulative ranges.
- Fresh independent QA on the frozen candidate with mandatory tally `passed == total`, `blocked = 0`, `unperformed = 0`.
- Wave Completion Auditor after `ACCEPT_READY`, including claim-classification and rendered-artifact verification.

## Forbidden actions

No merge to current main, push, deployment, shared-runtime restart, live login, live or shared database write, migration application, generation, publication, term-cache apply, Teaching Load apply, rollover, or companion-repository edit. Do not touch ports 5001/5174, the supervisor task, durable environment, port 5175, or unrelated processes.

## Return contract

Return `REVIEW_REQUIRED` to the head planner with:

- exact base, prior candidate, correction commits, final source candidate, and cumulative range;
- exact changed paths and clean status;
- source and rendered-artifact evidence identifying both stakeholder inputs by path and SHA-256;
- canonical per-day row matrix and teaching-load arithmetic;
- signatory persistence/snapshot authority and mounted permission matrix;
- failing-first/mutant evidence and full mandatory QA/audit tallies;
- schema/migration source status and explicit confirmation that no migration was applied;
- all residuals classified BLOCKING/NON_BLOCKING/EXTERNALLY_BLOCKED;
- current `origin/main` drift and predicted integration conflicts;
- integration/push/deployment status;
- worktree disposition and a single next action.

Suggested product commit:

```text
fix(exports): align teacher program with beneficiary schedule authority

Project teacher free periods as ancillary work without teaching-load credit,
render only policy-owned breaks, reproduce the official teacher-program form,
and bind editable year-scoped signatories to historical export revisions.
```
