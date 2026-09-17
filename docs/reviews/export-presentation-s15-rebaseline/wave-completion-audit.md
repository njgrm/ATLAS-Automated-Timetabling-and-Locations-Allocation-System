# EXPORT-PRESENTATION-S15-REBASELINE — Wave Completion Audit capsule

Planner-recorded capsule of an independent adversarial audit of the correction
wave that remedied finding B1 of the `MIG-APPLY-0002-0003` audit. The auditor
authored the verdict and findings; this file is a compact transcription.

| Item | Value |
| --- | --- |
| Stream | `EXPORT-PRESENTATION-S15-REBASELINE` (MEDIUM; test + docs) |
| Auditor role | fresh `atlas-wave-auditor` (read-only, adversarial) |
| Auditor task id (planner-captured) | `ses_f50c94a98ffe1S7YZL1jyubbB6` |
| Model / reasoning | `opencode-go/deepseek-v4.1-flash`, reasoning `max` |
| Reviewed `origin/main` | `43341ac7cb908f9ca692dbc93f8da8ef26ec52b0` (verified == `git ls-remote origin refs/heads/main`) |
| Candidate / integration | `0d770e93feff3c189b1dc8b195391f30f2551f0a` / `8fcafe642d69cc0e8ed5bd4ec84a09e530abca34` (base `041847c4`) |
| Verdict | **`CORRECTION_REQUIRED`** |
| Reviewer tally | independent auditor checks 6/5/1/0/0 (check 2, the sibling sweep, produced F-1); wave gates register 12/12/0/0/0 (`MIG-APPLY-0002-0003`) and 5/5/0/0/0 (this stream) |

## What the auditor confirmed (independent reproduction)

- **B1 resolved.** Mechanical normalized-executable-line comparison of the
  corrected C06B test shows the only changed executable lines are the four S15
  lines, replaced by eleven; every other row/assertion is byte-preserved;
  assertion count 58 → 59; no `skip`/`todo`/`only`; the non-vacuity guard is
  load-bearing. It ran the corrected suite itself: **2/2 pass, exit 0**.
- **Live row L1.** Configured database unchanged before and after: registry 4/4
  finished, none rolled back; both new tables present and empty; exactly the two
  pre-existing `atlas_restore_drill_*` databases from 2026-09-11/12; `audit_logs`
  248 rows, max id 799, unchanged by this wave.
- **O1 precondition row accurate and drift-free.** `.gitattributes` genuinely
  omits `prisma/migrations/**`; persisted checksums are **mixed form**
  (`0000` = LF blob digest; `0001`/`0002`/`0003` = CRLF working-byte digests); no
  LF rule was added; the added C10 row is correct and creates no drift. Noted for
  the record: the register/packet migration pins are the LF-blob digests, which
  differ from the persisted CRLF checksums by design — a future `migrate` run
  must not read that difference as tampering.
- **Containment.** Candidate range = exactly the four owned paths, one commit; no
  product source, `prisma/**`, migration, `ops/workflow/**`, or register file; no
  database write, migration command, login, browser, runtime/task/env, or
  companion action; zero audit rows attributable.
- **Register verifies.** `verify-cycle.mjs` exit 0, `errors: 0`;
  `render-register.mjs --check` exit 0.

## Findings

### BLOCKING

- **F-1 — a surviving authoritative "0002 is unapplied" premise.**
  `docs/prompts/term-cache-catchup-apply-2026-09-14.md` is a live
  `HIGH_APPROVAL_REQUIRED` packet that still records `_prisma_migrations` applied
  **2** (line 78 signature table; line 330 post-apply zero-write invariant) and
  states at lines 532–535 that "the normal guarded migration deployment will also
  apply the **pending** `0002_companion_sso_code`". Measured truth is **4**
  applied. Its own §4.0 divergence rule forces **STOP →
  `PLANNER_DECISION_REQUIRED`** on any database pre-state divergence and §8 row 3
  makes the apply unpassable with 4 rows, so the packet cannot be executed as
  written. This is the same defect class the correction wave existed to
  eliminate, in the packet that was next in line for approval.
- **F-8 — register cross-section contradictions (planner-owned).**
  `MIG-APPLY-0002-0003.nextAction`/`awaited` and
  `coordination.globalNextAction` described completed work as pending;
  `EXPORT-PRESENTATION-S15-REBASELINE.blocker.safeWorkRemaining` was `true` with
  completed items; its lease was still `ACTIVE` while the executor had returned.
  **Remedied in the same turn** at revisions 310–313.

### NON_BLOCKING (deterministic documentation reconciliation)

- **F-2** `docs/prompts/export-presentation-schema-guard-c06b-2026-09-16.md:160`
  — the S15 row still reads "Migration 0003 stays unapplied on the configured
  database".
- **F-3** `docs/reference/atlas-teacher-program-output-contract-2026-09-15.md:112`
  — status "REQUIREMENT — source added, NOT applied" is falsified.
- **F-4** `docs/handoffs/companion-sso-live-prep-c02-executor.md:138,152-153` —
  "migrations 2→2 … absent→absent" and "`0002_companion_sso_code` remains
  **unapplied**".
- **F-5** `docs/prompts/companion-sso-runtime-activation-c02-2026-09-15.md:213-216`
  and its header `Dependency:` — still names the retired
  `COMPANION-SSO-MIGRATION-LIVE-C02` packet as the gating precondition.
- **F-6** `docs/handoffs/enrollpro-companion-sso-configuration-2026-09-17.md:97`
  — "the `companion_sso_codes` table does not exist yet" is falsified.
- **F-7** `docs/prompts/mig-apply-0002-0003-2026-09-17.md` — the executed packet
  carries no executed-banner; §9 still reads "NOT GRANTED at packet authoring".
- **F-9** the corrected test's new `console.log` now prints the configured
  database name, while the C06B handoff's S15 evidence cell still says it is
  never printed. Non-secret, but the cell is now inaccurate.

**Still-correct, no action:** the fail-closed diagnostic in
`export-presentation.service.ts:84,117`; the disposable-database premises in the
C06B and postgres suites; `generation-authority-realism-c07-availability.test.ts:95`;
and dated `docs/reviews/**` / evidence records.

## Closure readiness at this verdict

- `MIG-APPLY-0002-0003` **may not** close `COMPLETE`: its gate matrix is complete
  and clean (12/12; SOURCE 4/4; LIVE 8/8; blocked 0; unperformed 0), QA is
  `ACCEPT_READY`, and the live rows are independently corroborated — but the
  latest auditor verdict is not `AUDIT_CLEAR`, and the F-1 sweep and F-8
  reconciliation are outstanding. By the mechanical closure invariant the state
  must not become `COMPLETE`.
- `EXPORT-PRESENTATION-S15-REBASELINE` **may not** close either; the same
  correction → fresh QA → fresh auditor loop applies.
- The consolidated deployment approval **may not** be presented yet; when it is,
  it must carry the verified O1 precondition row.

## State at this commit

Register revision **313**. Both streams are `INTEGRATED` with QA `ACCEPT_READY`
and no ACTIVE lease; coordination is `MANUAL`. The two additive migrations remain
applied and inert; no rollback was performed or indicated. The bounded remedy
`EXPORT-PRESENTATION-PREMISE-SWEEP-C02` is authored and committed as a packet and
an unregistered spec, ready to dispatch.
