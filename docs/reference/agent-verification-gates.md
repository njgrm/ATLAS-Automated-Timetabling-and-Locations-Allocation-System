# Verification Gates

Apply only gates relevant to the MEDIUM or HIGH change.

1. Exercise the real production route or service; helper-only tests and grep counts
   are not sufficient.
2. Prove the decisive test fails without the fix.
3. For translations, filters, grouping, defaults, persistence, or rendering, trace
   `authority -> producer -> persisted form -> API projection -> consumer` and
   conserve identities, counts, ordering, scope, and totals. Keep `missing`,
   `unknown`, `all`, and concrete values distinct.
4. Actor- or tenant-scoped fallbacks such as `schoolId = 1`, `?? 1`, or `|| 1`
   fail open unless the route is explicitly public. Scope changes invalidate stale
   previews, confirmations, caches, and pending mutations.
5. Set-valued write authority must re-read the complete qualifying set inside the
   transaction and reject ambiguity with zero residue.
6. Authority, freshness, or concurrency rejection must dispatch and write nothing.
7. Source QA and deployed browser acceptance are separate. Live Tailnet evidence
   cannot prove undeployed source bytes.
8. Before adding an authority gate, enumerate and report the route's consumers:
   machine or system-token callers, client callers, and pending packets that depend
   on it. A gate that breaks a documented contract is a finding, not a fix.
