# GENERATION-AUTHORITY-REALISM-C07R1 — Wave Completion Audit capsule

- Wave: `GENERATION-AUTHORITY-REALISM-C07R1` (correction-cycle closure of `GENERATION-AUTHORITY-REALISM-C07`; the historical INTEGRATED round and its CORRECTION_REQUIRED capsule are preserved)
- Auditor role: `ROLE: WAVE_COMPLETION_AUDITOR` (fresh, read-only, adversarial)
- Auditor task/session ID: `ses_f57457fe4ffeZ4UhGZkOQG6yVR` (harness-returned; recorded by the primary planner)
- Model / variant: `opencode-go/deepseek-v4.1-flash`, high-class adversarial audit; disclosed substitution (no separately selectable variant exposed); no `max` justification (MEDIUM source wave, no HIGH runtime/data action)
- Reviewed `origin/main`: `a8a27448551704e86d84759690821dd6ccf06745`
- Candidate: `c12c28ed4afaef059c3a9564693339fdfe0d8f42` (base `750cafcb`, 26 attributed paths)
- Integration merge: `be2d99a9698f6c1793c96643dd23a6fd98f58a1b` (merge of `45adf651` + `c12c28ed`)
- Mandatory tally: `MANDATORY_SOURCE 30/30/0/0/0`, `MANDATORY_LIVE 3/3/0/0/0`, `DEFERRED_EXTERNAL 0/0/0/0/0`; blocked 0; unperformed 0
- **Verdict: `AUDIT_CLEAR`**

## New checks run
Term-authority suite 7/7 (mirror-223-shaped unchanged cache => no TERM_AUTHORITY_STALE; zeroed upstream revision mutant; 6-key reorder; changed-between-reads stale; malformed/missing/foreign-school/wrong-year/duplicate/out-of-order stale with zero writes); trigger suite 16/16 (B1 F1a/F1b, B2 F2, room contract); primary 22/22; availability disposable-PostgreSQL 1/1; an auditor-authored pure-helper probe (5/5, incl. recursive JSON-key permutations and a JSON text round-trip); an auditor-authored **real disposable-PostgreSQL** probe (4/4) that toggled one `policy_special_events` row enabled true->false with `updated_at` held identical, defeating the count/max-id/max-updated signals, and still observed the `policy` exact-digest/fingerprint move to `STALE` with `policy` in `changedDomains` and byte-identical restoration on re-enable, cleanup residue 0; machine state `verify-cycle` exit 0 (rev 168, stateSha256 f9921df8), `render-register --check` exit 0; live preconditions local health/ready 200 and Tailnet health 200 with the settled CLASSROOM subject authority.

## Reused evidence
Round-1 capsule `docs/reviews/generation-authority-realism-c07/wave-completion-audit.md`; QA `ses_f57593b13ffeEM8Q8iUAkv0z0J` (22/22/0/0/0), re-executed on the frozen tree by the auditor.

## Findings
Blocking: none. Non-blocking: R1 stale `coordination.globalNextAction` pointer to TERM-AUTHORITY-STALE-C07 (reconciled in this closure turn); R2 `TERM-CACHE-CATCHUP-APPLY` row prose cannot be reopened by any transition (apply executed at main ancestor `818439c2`; write retained; mirror 223 holds the reviewed T1/T2/T3 authority; no second apply/replay/rollback/login authorized); R3 `--awaited` flag defect on `lease-update`/`record-audit` (zero mutation); R4 `corrections[0]` base/candidate bookkeeping only; R5 raw persisted window when a shape has zero canonical CLASS rows (unreachable: CANONICAL_SLOTS_MISSING blocks first); R6 label-aware predicate breadth (intended per N2; revisit with the schema decision); R7 remote observation is the integration-time tip (allowed by contract A1).

## Live precondition snapshot
Local 5001 health/ready 200 (database ok), Tailnet health 200, unauthenticated subjects probe 200. Deployed runtime untouched. `LIVE-GENERATION` and `LIVE-PUBLICATION` remain BLOCKED; C07R1 has no approval requirement, no successors, no ACTIVE lease. **No live/HIGH action is unlocked or implied.**

## Required planner action
Commit this capsule, reconcile the stale coordination next-action (docs-only), record `AUDIT_CLEAR`, close the cycle with its receipt, record the post-push remote observation, and retire the eligible worktrees non-forced. No deployment, generation, publication, mutation, migration, or login.