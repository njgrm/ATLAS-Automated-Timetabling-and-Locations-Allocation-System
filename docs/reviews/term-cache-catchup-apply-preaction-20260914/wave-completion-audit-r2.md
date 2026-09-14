# Wave Completion Audit — `term-cache-apply-packet-c01` (round 2, after correction #1)

**Verdict: `CORRECTION_REQUIRED` — mandatory 14 / passed 13 / blocked 0 / unperformed 0.**

- Auditor task: `ses_f5fc0cec4ffe8PKeyNmJKI2ima` (fresh independent read-only
  `atlas-qa-delegate`, role `WAVE_COMPLETION_AUDITOR`).
- Model: `opencode-go/deepseek-v4.1-flash`; no reasoning-variant selector
  exposed — fallback disclosed.
- Reviewed range: `84dd537bb2a2c045b8518c35b3a5372142e0080c...326f91569525fb67d5fb0b99a881c59823d0e9b1`
  (correction commit `326f9156`, one docs path).
- Blocking finding **B1**: §8.4 row 5 asserted
  `derivedDemand.revision === a51b62a2…`, which is unsatisfiable —
  `derived-demand.service.ts` computes `revision` as an UPPERCASE sha256 over
  the derived-demand payload (live example `902B914D…`), and the dashboard
  projection's `termStructure` exposes only `{format, terms}`. The contract
  `semanticRevision` (`a51b62a2…`) belongs on the persisted mirror contract
  (proven by §8.1), not on a dashboard field.
- Non-blocking: row-4 code alternative `DERIVED_DEMAND_BLOCKED` (the emitted
  missing-snapshot code is `TERM_STRUCTURE_UNAVAILABLE`; first-listed code
  correct); WF-C02 worktree continued its own in-progress edits (external).
- Independently reproduced in round 2: identity/range, directive hash, live
  upstream parity, fingerprint, DB baseline, deployed trace, matrix — all
  PASS other than row 11 (B1).
- Action executed by the auditor: none (read-only).
