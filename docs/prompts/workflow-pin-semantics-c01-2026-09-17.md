# WORKFLOW-PIN-SEMANTICS-C01 — make the deployment pin an immutable SHA, not the tip

ROLE: EXECUTOR. Recommended reasoning variant: `high`. Risk tier: **MEDIUM**
(`ops/workflow/**` plus tests; no product, runtime, data, or register change in
this packet's own diff).

## Why

The current pin-stability gate requires `origin/main == pin`. Multi-lane cycles
violate that by design: three separate register-only pushes broke a frozen
deployment pin during the `CONSOLIDATED-DEPLOYMENT-C10` pre-action review,
forcing re-reviews of an artifact whose **bytes never changed**. The release is
built from an immutable SHA, so tip equality is not the property that matters.

## Objective

Require all three of these instead of tip equality:

1. `pin` is an **ancestor of or equal to** `origin/main`.
2. The packet blob at `pin` equals the blob that was reviewed (identity of
   content, not of tip).
3. The register records that literal SHA as the stream's pin.

Concurrent pushes by unrelated lanes then cannot invalidate a frozen pin, while
the guarantee that matters — "the reviewed bytes are the deployed bytes" — is
preserved and strengthened.

## Owned paths

- `ops/workflow/lib/verify.mjs` — the pin-stability rule.
- `ops/workflow/lib/transition.mjs` — the guard that records/enforces the pin.
- `ops/workflow/lib/pins.mjs` — pin resolution/reporting, if it carries the rule.
- `ops/workflow/__tests__/**` — new and adjusted fixtures only.

## Forbidden

- No `atlas-server/**`, `atlas-client/**`, `prisma/**`, `docs/plans/**` (the
  register and projection are planner-written), `CHANGELOG.md`, runtime map,
  companions.
- Do not weaken any other gate: boundary checks, CAS revision guards, granted-
  approval immutability, and the acceptance-row tooling must be untouched.

## Required behaviour and negative controls

1. **Positive:** pin `P` is an ancestor of a tip that has advanced by
   register-only commits → the gate **passes**, and reports the resolved pin.
2. **Negative A:** the packet blob at `P` differs from the reviewed blob → gate
   **fails** (`PIN_CONTENT_DRIFT`-class), even though `P` is an ancestor.
3. **Negative B:** `P` is not an ancestor of the tip → gate **fails**.
4. **Negative C:** the register names a different SHA than the reviewed pin →
   gate **fails**.
5. Each negative must fail **nonzero** through the real validator entry point,
   not a helper assertion.

## Acceptance

- The three negatives above reproduce failing-first against the **pre-change**
  code where applicable (at minimum A and C are new rules and must have a
  failing-first fixture).
- Full `ops/workflow` suite green; `verify-cycle.mjs` and
  `render-register.mjs --check` exit 0 on the unchanged register.
- Evidence records: the exact rule diff, the three fixtures with their exit
  codes, and a replay of the `CONSOLIDATED-DEPLOYMENT-C10` shape (pin ancestor
  + register-only pushes above it) showing it now passes without re-review.

## Notes

This is the single highest-leverage change identified from the C10 cycle. It
should land in the same deliberate directive revision batch, after C10 closes.

Suggested spec (author at registration; do not add prematurely to
`ops/workflow/specs/register/`):

```json
{
  "id": "WORKFLOW-PIN-SEMANTICS-C01",
  "kind": "STREAM",
  "objective": "Replace tip-equality pin stability with immutable-SHA pin semantics: pin must be an ancestor of origin/main, the packet blob at the pin must equal the reviewed blob, and the register must name that SHA, so unrelated register-only pushes cannot invalidate a frozen deployment pin.",
  "riskTier": "MEDIUM",
  "state": "PLANNED",
  "requires": []
}
```
