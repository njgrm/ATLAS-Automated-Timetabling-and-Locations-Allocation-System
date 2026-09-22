# REFERENCE-SYNC-AND-TL-RECONCILIATION-C01 — reference data refreshes; decisions never change silently

**Status:** `PREPARED` — **the decision is made; this is the implementation packet.** **Risk:** MEDIUM
source, HIGH if a scheduled sync is enabled. **Owner:** Lane A.

## 0. The decision (operator, 2026-09-22)

Today ATLAS's EnrollPro-derived data is a **snapshot** and the scheduler has no way to know whether it
has moved. The operator's direction, refined:

- **Reference data** (sections, teachers, school year, ordered terms) **auto-refreshes** from EnrollPro.
- **Decision data** (Teaching Load) is **frozen** — an upstream sync must never silently re-derive it.
- When reference data moves, the scheduler is **told what was displaced**, not just "please refresh".

**The refinement that makes it work:** the system must *know* it is stale, not ask a human to notice. So
each decision records the **fingerprint of the source it was derived from**, and ATLAS computes the
**diff** and hands over **one review task** naming the affected rows.

## 1. Why this is reuse, not new architecture

ATLAS already built exactly this contract for generation:

- `GenerationInputSnapshot` — a fingerprint over the inputs a run was computed from
  (`generation-input-snapshot.service.ts`).
- `SOURCE_AUTHORITY_STALE` — the typed fail-closed when covered inputs changed between computation and
  persistence (`TT-SOURCE-FRESHNESS-C04`, wave-audited, receipt-pinned).
- EnrollPro already publishes a **`semanticRevision`** per term contract (observed live:
  `"semanticRevision": "e0dba8dc…"`), so there is a natural upstream change key.

**Do not invent a second notion of freshness.** Teaching Load must reuse the same fingerprint and the
same stale semantics as generation, or the two will disagree about what "current" means.

## 2. Deliverables

**D1 — reference refresh records a revision.** The reference fetches (sections, teachers, school year,
ordered terms) record the upstream `semanticRevision`/fingerprint they were read at, per school and
school year.

**D2 — Teaching Load stores its source fingerprint.** Every persisted Teaching Load state records the
fingerprint of the source it was derived from. This is additive — existing rows may carry `null` and be
treated as "provenance unknown", never as "current".

**D3 — a computed reconciliation, not a nag.** A read-only reconciliation compares the current reference
fingerprint with a stored decision fingerprint and returns a **typed diff**: sections/teachers added,
renamed or removed, and **which Teaching Load rows are affected and how**. It must compute against a
**single captured snapshot** (D1's revision), never a moving target.

**D4 — one review task, dismissible per delta.** The scheduler sees the diff as a task that names the
affected rows and the single action, and it is acknowledged **per delta** — not re-raised on every sync
tick.

**D5 — honest UI.** The existing "Working from saved data" notice must state **what** is unverified and
**how old**, distinguishing *persisted-but-current* from *stale*. It is currently a single sentence with
no age and no scope.

**D6 — the notification dependency.** D4 needs somewhere to land: see
`docs/prompts/notification-inbox-c01-2026-09-22.md`. ATLAS has a live event **stream** but no persisted
inbox, so a delta raised while nobody is looking is lost.

## 3. Boundaries — do not break

- **No silent mutation of decisions.** Nothing in this packet may rewrite, delete or re-derive Teaching
  Load rows. Reconciliation reports; a human decides.
- **No scheduled sync in this packet.** `ROLLOVER_AUTO_SYNC_ENABLED=false` is a deliberate runtime
  contract invariant (`ops/runtime/runtime-contract.json`). Enabling a scheduled pull is a **separate
  HIGH decision** — this packet fixes *visibility*, not *cadence*.
- Reuse `GenerationInputSnapshot` / `SOURCE_AUTHORITY_STALE`; do not add a parallel freshness model.
- No generation, publication, migration or live-data action is unlocked.

## 4. Acceptance tests

1. A Teaching Load state carries the fingerprint of the source it was derived from.
2. With reference data unchanged, reconciliation reports **no** delta.
3. After a section is renamed upstream, reconciliation names **that section** and the Teaching Load rows
   that reference it — and changes nothing.
4. A Teaching Load row with unknown provenance is reported as *unknown*, never as current.
5. The delta is acknowledged once and does not re-raise until the reference moves again.
6. The stale notice states what is unverified and its age.

## 5. The separate decision still open

**Should ATLAS pull on a schedule?** That is a HIGH data action on a timer, deliberately prevented today
by the runtime invariant. Keep it separate from this packet; the operator decides it on its own merits.
