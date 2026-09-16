# GENERATION-AUTHORITY-REALISM-C07 — Wave Completion Audit capsule

- **Wave:** `GENERATION-AUTHORITY-REALISM-C07` (bounded source correction; objective in the cycle
  register and packet §1)
- **Governing packet:** `docs/prompts/generation-authority-realism-c07-2026-09-16.md` (§1–§15)
- **Auditor role:** `ROLE: WAVE_COMPLETION_AUDITOR` (fresh, read-only, adversarial second-planner check)
- **Auditor task/session ID:** `ses_f5783f732ffeyGMZfEuQ9Qrf5Y` (harness-returned; recorded by the
  primary planner per `AGENTS.md` — the auditor could not self-discover it)
- **Model / variant:** `opencode-go/deepseek-v4.1-flash`; `high`-class adversarial audit. Disclosed
  substitution: the harness exposed no separately selectable reasoning variant, so the nearest
  supported variant was used. No `max` justification existed (no HIGH runtime/data action; no
  ambiguous cross-stream result).
- **Reviewed `origin/main`:** `d9233b3c33e54dd606a57c515419d22de0fcb81e` (refreshed by the auditor)
- **Candidate (QA-reviewed):** `63275527292faeaf92ef1f800ecfdf848f69febb`
- **Integration merge:** `43399182b434338dcb2dc37a231a55144e054224`
- **Reused QA evidence:** `ses_f578ef442ffe8IEwQnYwr7sEUq` — `ACCEPT_READY`, classes
  `MANDATORY_SOURCE 14/14/0/0/0`, `MANDATORY_LIVE 1/1/0/0/0`, `DEFERRED_EXTERNAL 0/0/0/0/0`,
  blocked 0, unperformed 0.
- **Auditor-adjudicated tally:** `MANDATORY_SOURCE` 14 total — 13 independently supported,
  1 (`C07-S04`) verified only against a producer-impossible fixture; `MANDATORY_LIVE` 1/1
  independently re-observed; blocked 0; unperformed 0.
- **Verdict:** `CORRECTION_REQUIRED`

## New checks actually run (read-only)

1. Git identity and per-path byte parity: base→candidate ancestry (11/0), integration contains the
   candidate, merge parents `818439c2` + `6460e5fa`, all 21 non-docs paths byte-identical across
   candidate → merge → `d9233b3c`; only `docs/plans/**` differs and equals merge parent 1 (resolved
   toward concurrent main). No conflict residue.
2. Live preconditions (zero write, no browser): `/api/v1/health` 200; unauthenticated
   `GET /api/v1/subjects?schoolId=1` 200, 22 subjects, `SCI_BIO`/`SCI_CHEM`/`SCI_ES` =
   `CLASSROOM`, empty `requiredFeatures`; only `TLE_ICT_EXP` = `COMPUTER_LAB`. `C07-L01` holds;
   `PRIMARY_ROOM_POLICY_MISMATCH` not triggered.
3. Directive identity re-materialized byte-exact: 171055 bytes, raw Git-blob SHA-256
   `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`, git blob `051ad26a…`.
4. Machine register: `verify-cycle` exit 0 (21 streams); `render-register --check` exit 0; C07 row
   `INTEGRATED`, candidate `63275527`, integration `43399182`, QA `ACCEPT_READY`, gates 15/15,
   plan/classes `14/1/0`, `approval.required false`, no successors; coordination `MANUAL`.
5. Independent test-declaration counts (no reduction); only assertion-count change is a `c02`
   addition.
6. F10 assertion-change accounting: exactly the two disclosed sites, each mapped to C07-R3 with
   replacement coverage.
7. Freshness contract: version mismatch ⇒ `STALE` + `SNAPSHOT_VERSION_MISMATCH` (never `FRESH`);
   missing required domain rejected; availability digest school/year-scoped and deterministically
   ordered; all comparison consumers enumerated — `publication-contract.service.ts` blocks on
   `!== 'FRESH'` (fail-closed).
8. Single authority for the constructor/shape: one `toConstructorSpecialEvents` source feeds both the
   shape policy and the constructor input; dry run and trigger share the builders; the R2d
   availability guard is applied to both the availability filter and the relaxation.
9. Merged-tree interaction: the concurrent AUTHZ/EXPORT wave's only `generation.router.ts` change is
   a teacher-program export 503 mapping; no other branch touches any C07 path.

## Findings

### Blocking

- **B1 — the persisted special-event authority is now an operative generation input but is not bound
  to the freshness snapshot.** `policy-special-event.service.ts:109-189` writes only
  `policy_special_events`; `generation-input-snapshot.service.ts:266-269` covers only
  `scheduling_policies` + `grade_shift_windows`. Those rows now drive persisted output
  (`generation-preflight.service.ts:925-936`, `:1259-1261` → `schedule-constructor.ts:249-265`,
  `:331-347`, `:588-611`). Consequence: a special-event edit after a completed run leaves
  `getRunDraft().inputState.status === 'FRESH'` (`generation.service.ts:1547`) and
  `publication-contract.service.ts:286-291` can publish against changed authority. Violates the
  bind-output-to-source-snapshot rule for the newly consumed inputs.
- **B2 — `C07-S04`'s explicit non-Monday Flag/HGP rejection has no reachable production path.**
  `prisma/schema.prisma` `PolicySpecialEvent` has no `day_of_week` column; `SpecialEventInput`
  (`policy-special-event.service.ts:31-40`) has no day field; `toConstructorSpecialEvents`
  (`generation-preflight.service.ts:180-199`) therefore always yields `dayOfWeek: null`. The
  rejection loop, constructor guards, and both read-projection filters are inert for real rows, and
  the acceptance evidence is a fixture carrying a property the producer cannot emit
  (`generation-authority-realism-c07.test.ts:90-94`). Production-shape equivalence gate items 2 and
  6. A reachable substitute exists: the D-C containment rejection
  (`generation-preflight.service.ts:976-1000`) needs only persisted-shaped fields and yields
  `FLAG_CEREMONY_SCOPE_INVALID` + `GENERATION_PREFLIGHT_BLOCKED` + zero writes.

### Non-blocking

- **N1** An availability-caused exclusion surfaces as `WORKLOAD_POLICY_BLOCK` ("workload/slot
  limit") rather than the availability authority. Still typed, HARD, and non-silent.
- **N2** `schedule-constructor.ts:259` still infers day scope with the literal
  `evt.eventType === 'FLAG_OR_HGP'` instead of the shared label-aware predicate, so a `CUSTOM`
  row labelled as a flag ceremony renders as a Monday overlay yet blocks every weekday when a shape
  has no canonical CLASS rows. One-line alignment remedy.
- **N3** Cohort lane room authority (`cohort.preferredRoomType`) diverges from the validator's
  comparison basis (`subject.preferredRoomType`), which can mislabel a satisfied cohort authority or
  silence an unsatisfied subject authority. Read-only check required before generation; pre-existing.
- **N4** Closure hygiene: `lease-c07-executor` is `ACTIVE` while the stream is `INTEGRATED`
  (`COMPLETE_WITH_LIVE_LEASE` will reject `COMPLETE`); the terminal observation must be refreshed to
  the final pushed tip.

## Proposed next state

Supported: the wave unlocks **no** live/HIGH action — no deployment, generation, publication,
migration, term-cache apply, Teaching Load apply, or shared-runtime change is unlocked or implied.

## Required primary-planner action

Dispatch the bounded additive R3 correction (bind `policy_special_events` into the `policy`
freshness domain with failing-first post-run and transaction-bound stale controls; re-evidence
`C07-S04` on the reachable containment rejection using persisted-shaped rows only and re-caption the
non-Monday predicate as forward-compatibility for a schema-unrepresentable state; optional one-line
N2 alignment), then a fresh QA round, re-integration on current `origin/main`, and one fresh Wave
Completion Auditor. The cycle remains open: `COMPLETE` is invalid until `AUDIT_CLEAR`, and the
`lease-c07-executor` lease must be released before closure.
