# TT-C02R Fresh Advisory Review

- Reviewer context: `01a08464-1ea9-7ae0-be8c-ceffe0e8683f`
- Reviewed boundary: uncommitted correction on top of `a7be9354f3c0f0a897775baf98872efc83ce2eb4`
- Risk tier: MEDIUM (preview-only; no mounted apply route)
- Authority: advisory only; no merge, push, apply, generation, or formal GO authority

## Review coverage

- Production apply-route absence and zero-write UI boundary
- Missing and cross-school actor-scope rejection
- Trimmed uppercase HG exclusion
- Half-open interval-overlap checks
- `INDIVIDUALLY_PREVIEWABLE` versus global-feasibility terminology
- Search and pagination for every demand line, including unresolved lines
- Effective-page clamping and preview-error visibility
- Responsive layout and keyboard-reachable controls

## Findings and fixes

The initial advisory pass identified three P2 client findings:

1. Unresolved lines were not included in the searchable paginated browser.
2. A refresh or scope change could leave the slice on an out-of-range page.
3. Preview errors were nested under the successful-preview panel and therefore hidden on failure.

The correction now uses one searchable/paginated list over every `lineStates` row, resets and clamps the effective page, and renders preview errors independently with `role="alert"`.

## Changed-scope verdict

`ZERO MATERIAL FINDINGS`

The reviewer confirmed that only summary and preview routes are mounted; exposed operations are read-only; actor scope fails closed before domain reads; interval overlap and normalized HG exclusion are present; terminology does not claim global feasibility; all demand lines remain discoverable; and controls are responsive and keyboard reachable.

Final status: `REVIEW_REQUIRED`.
