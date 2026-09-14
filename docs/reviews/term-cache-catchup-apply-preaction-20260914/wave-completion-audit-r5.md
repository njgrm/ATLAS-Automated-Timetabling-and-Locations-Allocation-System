# Wave Completion Audit — `term-cache-apply-packet-c01` (round 5, after head-planner correction)

**Verdict: `CORRECTION_REQUIRED` — mandatory 16 / passed 14 / blocked 0 / unperformed 0.**

- Auditor task: `ses_f5f56f653ffeKavb9vAZqRC3k2` (fresh independent read-only
  `atlas-qa-delegate`, role `WAVE_COMPLETION_AUDITOR`).
- Model: `opencode-go/deepseek-v4.1-flash`; no reasoning-variant selector
  exposed — strongest-model fallback disclosed.
- Reviewed range: `84dd537bb2a2c045b8518c35b3a5372142e0080c...3360d8e51f8325a49524b53ccc868b37c3b2b11a`
  (six changed docs paths; verified).
- **F1 — BLOCKING (row 16, executable rollback):** §9 used `TIMESTAMPTZ`
  literals, but `enrollpro_school_year_mirrors.updated_at` and
  `term_contract_cached_at` are `TIMESTAMP(3)` (no time zone) and the live
  session time zone is `Asia/Kuala_Lumpur` (both node-postgres and Prisma).
  Proof: `updated_at = TIMESTAMPTZ '2026-09-10T11:18:14.634Z'` = **false**
  (while the naive `TIMESTAMP` comparison is true); `TIMESTAMPTZ::timestamp`
  assignment shifts +08. The guard would always evaluate false → `affected = 0`
  → abort with zero changes. Fix: pin `SET LOCAL TIME ZONE 'UTC'` and use naive
  UTC `TIMESTAMP` literals.
- **F2 — BLOCKING (row 12, bounded side effects):** the login delta omitted the
  engine-managed `atlas_auth_accounts.updated_at` advance (`AtlasAuthAccount`
  `@updatedAt`; login updates `last_login_at`), so "no other authentication side
  effect" was false. Live proof: actor 46 `updated_at = 2026-09-14 09:27:58.562`
  vs `last_login_at = 2026-09-14 09:27:55.967`. Fix: declare and bind it in
  §1/§2/§3/§5/§8.3/§12.
- **F3 — NON_BLOCKING:** the historical capture baseline did not record actor
  `updated_at`; folded into the F2 fix.
- **F4–F6 — NON_BLOCKING:** raw-IP origin note (non-secret); supervisor
  snapshot staleness (pre-existing, disclosed); system-token test uses a
  non-JWT bearer (behaviourally equivalent rejection).
- Rows 1–11 and 13–15 PASS (identity, directive hash, provenance, live parity,
  fingerprint, baseline incl. bound `updated_at`, deployed trace, write
  boundary, matrix, rollback embedding/audit disclosure, acceptance plan,
  secret scan, surface isolation, implicit-ORM row 15).
- Corrected in packet commit `b8ab861c`; a fresh round-6 auditor was
  commissioned immediately after.
- Action executed by the auditor: none. Read-only probes only (one `EXPLAIN`
  without `ANALYZE` in a rolled-back transaction, row confirmed unchanged);
  temp probe scripts deleted; no edit/login/apply/DB modification.
