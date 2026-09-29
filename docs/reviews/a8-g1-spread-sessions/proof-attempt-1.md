# A8 g1 — live-shaped proof attempt 1 (planner-run, FAILED the row it measures)

Recorded by the A8 g1 planner on 2026-09-29. Additive evidence: this is the first real measurement of the
packet's rule-3 row on a staging copy of live, and it did **not** close. Nothing in it is superseded.

## How it was run

- Source: `atlas_staging` (read-only `pg_dump`, confirmed by the harness's own `A8G1_SOURCE` line; NOT
  `atlas_db`). The staging `DATABASE_URL` was read from the existing `D:\ATLAS\atlas-server\.env` and
  injected into the child process environment; the credential value was never printed, logged or committed.
- Harness: `atlas-server/src/scripts/a8-g1-live-shape-proof.ts --target atlas_restore_drill_20260929_a8g1`
  (the reviewed whole-database path: `createdb -T template0` + `pg_restore` + the shared
  `assertRestoreTargetAllowed` / `runWithGuaranteedCleanup` / `assertCleanupTargetAllowed` guards).
- Full log: `$env:TEMP/opencode/a8g1-proof.log` (planner machine). No credential appears in it.

## What it proved (these parts are sound and stay)

- Whole-database copy works: dump ��� restore ─ fresh `atlas_restore_drill_20260929_a8g1` ─ run ─ drop.
- `A8G1_SOURCE_SIGNATURE_BEFORE 2/100/22/60/103/10/9` == `A8G1_SOURCE_SIGNATURE_AFTER 2/100/22/60/103/10/9`,
  `A8G1_SOURCE_UNCHANGED true` — the staging source was not mutated.
- `A8G1_CLEANUP_OK … absent=true` and `A8G1_RESIDUE … present=false` — zero residue over the one name it created.

## What it did NOT prove (why the row is open)

```
| measure               | before   | after    | note
| entries placed        | 2730     | 855      |
| same-day repeat pairs | 144      | 0        | TARGET 0 non-block
| worst same-day count  | 15       | 0        | TARGET <= ceil(sessions/5)
| unplaced              | 10       | 65       | MUST NOT RISE (910/920 today)
| teacher overlaps      | 1675     | 75       | MUST STAY 0
| section overlaps      | 1820     | 0        | MUST STAY 0
| room overlaps         | 1820     | 0        | MUST STAY 0
| hard violations       | 10       | 0        | MUST STAY 0
| run seconds           | n/a      | 0.113    |
A8G1_PROOF_FAILED code=UNPLACED_RAISED unplaced rose: 10 -> 65
```

Two defects in the measurement, both of which must be fixed before any of these numbers may be quoted:

1. **The two sides are not comparable.** `before` is run 347's stored rows (2730 entries = the whole
   3-term year), `after` is one constructor invocation (855 placed + 65 unplaced = 920 sessions, i.e. one
   week). The before side's overlap numbers (1675/1820/1820) are an artifact of measuring a multi-term run
   with a single-term overlap definition — a teacher legitimately holds the same slot in different terms.
   The "before" side must be produced by running the OLD comparator through the SAME offline harness on the
   SAME restored inputs, so both sides are the same shape by construction.
2. **The after side may carry the same artifact.** 75 teacher "overlaps" in a one-week run is either a real
   hard failure or rotation/modular entries repeated per `termIndex`. The measurement must key on
   `termIndex` (and `entryKind`/`cohortCode`) so a legitimate re-teach across terms is not counted as an
   overlap, and must then report whether 75 survives that key.

The spread targets (`same-day repeat pairs 144 → 0`, `worst same-day count 15 → 0`) are the direction the
packet asks for, but they are **not yet admissible as evidence** because they come from a table whose other
rows are not trustworthy.

## Disposition

`REVIEW_REQUIRED` stands, the candidate is **not** pushed to `main`, and the packet's rule-3 row is recorded
as **open (measured, failed its own assertion, cause not yet separated)**. One bounded correction round is
authorised: make the before/after comparison sound and re-measure. If the unplaced rise survives a sound
measurement, the constructor change is wrong and must be corrected, not the harness.
