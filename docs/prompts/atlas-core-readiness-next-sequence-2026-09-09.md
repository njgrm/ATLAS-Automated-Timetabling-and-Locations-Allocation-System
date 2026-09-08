# ATLAS Core Readiness — Next Execution Sequence

Date: 2026-09-09
Integrated base: `4559eb13bbd371dd7945b39128f8c0dcdacd430a`
Status: RC-02D ready; later stages dependency-gated

## Outcome

Move the merged curriculum, Teaching Load, timetable, and dashboard authority
repairs into the live Tailnet runtime, persist operator-approved current-year
curriculum authority, and only then resume allocation and timetable generation.

## Default execution workflow

For every prompt in this sequence:

1. Start a fresh executor in a clean isolated Git worktree created from the
   current `origin/main`.
2. Use a neutral branch named `work/<stream>-<prompt>`; never work on `main`.
3. Record the base commit in the named progress ledger before editing.
4. Keep changes inside the prompt's explicit boundary. Companion repositories
   are `READ_ONLY`.
5. Run only the prompt's decisive focused checks. Do not rerun historical test
   matrices unless a changed dependency requires them.
6. Stage exact paths, run `git diff --cached --check`, and create one
   conventional commit on the executor branch.
7. Return `REVIEW_REQUIRED` with the base SHA, candidate SHA, changed paths,
   decisive evidence, and remaining risks. Do not merge, push, deploy, generate,
   publish, or apply production data unless the prompt explicitly authorizes it.
8. Planner/QA reviews the immutable `<base>...<candidate>` range. Corrections are
   new commits on the same branch; do not amend or rebase reviewed commits.

Use commit SHAs as evidence for ordinary source/tests/docs. Do not create
per-file hash inventories, receipt chains, reviewer allowlists, or custom gates.
Semantic SHA-256 fingerprints remain mandatory only for the HIGH-risk
curriculum/data/generation apply boundaries below.

## Ordered stages

| Stage | Risk | State | Dependency | Result |
|---|---|---|---|---|
| RC-02D live deployment and acceptance | MEDIUM operational | READY | merged base `4559eb13` | Reviewed code is served on Tailnet; no setup-data write |
| SCA-04A operator decisions and apply preview | HIGH preview / zero write | LOCKED | RC-02D accepted | Complete decisions plus one fresh semantic preview fingerprint |
| SCA-04B curriculum apply | HIGH data mutation | LOCKED | exact SCA-04A approval | Persist terms and current-year requirements atomically |
| TL-C02 allocation and rebalance | MEDIUM source; HIGH only at live apply | LOCKED | SCA-04B verified | Dynamic demand/qualification/load planner |
| TT-C02 unassigned insertion repair | MEDIUM source; HIGH only at generation | LOCKED | SCA-04B verified and TL-C02 contract available | Insert genuinely unassigned meetings through bounded search |
| EVAL-C02 integrated operator UX and objectives QA | MEDIUM | LOCKED | TL-C02 and TT-C02 source candidates integrated | Older-scheduler usability and core-objective proof |
| RC-03 fresh generation and publish-readiness proof | HIGH | LOCKED | SCA/TL/TT acceptance and explicit generation approval | Fresh year-8 run, blocker reconciliation, publication gate truth |

TL-C02 and TT-C02 may run in parallel only after SCA-04B establishes one
persisted demand authority. Their edit boundaries must remain disjoint:

- TL-C02 owns Teaching Load work-queue, candidate ranking, allocation preview,
  and rebalance services/routes/UI.
- TT-C02 owns timetable insertion/search and generator repair orchestration.
- TT-C02 consumes canonical curriculum and Teaching Load contracts; it must not
  create curriculum requirements, faculty ownership, or qualification policy.
- TL-C02 must not edit timetable construction, repair, generation, or publish
  services.

## Shared progress ledger

Maintain:

`docs/progress/atlas-core-readiness-next-sequence-2026-09-09-progress.md`

Keep it concise: task status, base/candidate commit, changed paths, decisive
tests, runtime/data effects, and one next action. Do not duplicate command
transcripts into multiple artifacts.

## Stop rules

- Any unexpected shared/live data mutation is an incident stop.
- Missing operator curriculum decisions stop SCA-04A at `DECISION_REQUIRED`.
- Fingerprint drift stops SCA-04B with zero writes.
- A current-year generation or publication action always requires explicit
  user approval naming its scope.
- A failed prerequisite never authorizes a fallback to catalog-derived demand,
  fixed specialization counts, hardcoded school/year IDs, or invented faculty.
