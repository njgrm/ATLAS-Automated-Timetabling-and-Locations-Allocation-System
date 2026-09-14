# Handoff — `term-cache-apply-packet-c01` (frozen docs candidate, round-6 re-audit pending)

**Status: round-5 corrections applied; round-6 re-audit of this corrected tip is
pending at this commit — its capsule is committed in the following commit.**

- **Verdict so far:** the original packet `4a600784` was `AUDIT_CLEAR`
  (14/14/0/0, rounds 1–4). The head planner then returned `CORRECTION_REQUIRED`
  (7 deterministic items); those were applied in `f7568517` (packet) and
  `3360d8e5` (handoff). Round 5 over `3360d8e5` returned
  `CORRECTION_REQUIRED` 16/14/0/0 (F1: §9 `TIMESTAMPTZ` literals cannot
  match/assign the live `TIMESTAMP(3)` columns under `Asia/Kuala_Lumpur`
  session TZ; F2: the login delta omitted the engine-managed
  `atlas_auth_accounts.updated_at` advance). Both are fixed in the packet
  commit `b8ab861ceb21385a040d48d7b106efbd57e0b7df` and this handoff commit.
  A fresh round-6 auditor re-reviews this corrected tip on the 16-row matrix;
  its result is committed next as
  `docs/reviews/term-cache-catchup-apply-preaction-20260914/wave-completion-audit-r6.md`.
- **No live action occurred:** no login, no browser, no apply, no database
  write, no deployment, no runtime/env/task change. **NOT GRANTED** — no
  approval requested or received.
- **Refreshed base `origin/main`:**
  `84dd537bb2a2c045b8518c35b3a5372142e0080c`.
- **Worktree / branch:** `E:/ATLAS-worktrees/term-cache-apply-packet-c01` /
  `work/term-cache-apply-packet-c01`. Disposition: `KEEP_ACTIVE` until the head
  planner's integration review completes, then `RETIRE_AFTER_INTEGRATION`.
- **Directive LF-SHA-256:**
  `5F9206708A4763376DDA1943C1EAD28F49427ED1B1F0532AD25661F74ED3EBB5`.

## Immutable changed paths (branch vs `84dd537b`, explicit enumeration)

1. `docs/prompts/term-cache-catchup-apply-2026-09-14.md` (added; corrected in
   `f7568517`)
2. `docs/handoffs/term-cache-catchup-apply-packet-c01.md` (this file)
3. `docs/reviews/term-cache-catchup-apply-preaction-20260914/wave-completion-audit.md`
4. `docs/reviews/term-cache-catchup-apply-preaction-20260914/wave-completion-audit-r2.md`
5. `docs/reviews/term-cache-catchup-apply-preaction-20260914/wave-completion-audit-r3.md`
6. `docs/reviews/term-cache-catchup-apply-preaction-20260914/wave-completion-audit-r4.md`
7. `docs/reviews/term-cache-catchup-apply-preaction-20260914/wave-completion-audit-r5.md`
8. `docs/reviews/term-cache-catchup-apply-preaction-20260914/wave-completion-audit-r6.md`
   (committed only after the round-6 audit returns)

## Head-planner correction (2026-09-14) — applied items

1. Mirror 223 `updated_at` added to the exact pre-action baseline and to the
   expected apply delta (Prisma `@updatedAt` on the non-empty `updateMany`).
2. The packet now states explicitly that the authorized apply changes exactly:
   `term_contract_cache`, `term_contract_cached_at`, `updated_at`, and one
   `TERM_CACHE_SYNC_APPLIED` audit row (plus the separately authorized login
   delta).
3. Exact pre-apply `updated_at` bound in the packet (§2/§3):
   `2026-09-10T11:18:14.634Z`.
4. §9 now embeds the exact rollback transaction (guarded raw SQL, single
   transaction, `affected <> 1` aborts, post-restore assertion, audit row
   retained, fail-closed stop) instead of a deferred script.
5. The §12 HIGH approval sentence names the `updated_at` mutation and the exact
   pre-reviewed rollback.
6. Path enumeration corrected (item 3 above lists the unsuffixed
   `wave-completion-audit.md`, previously omitted from the chat report).
7. Fresh round-5 auditor commissioned over the corrected tip with a
   **16/16/0/0** requirement.

## Round-5 outcome and fixes (2026-09-14)

Round 5 (`ses_f5f56f653ffeKavb9vAZqRC3k2`) returned `CORRECTION_REQUIRED`
16/14/0/0 — rows 12 and 16 failed; both fixes are in `b8ab861c`:

- **F1:** §9 now pins `SET LOCAL TIME ZONE 'UTC'` immediately after `BEGIN;` and
  uses naive UTC `TIMESTAMP` literals; `${PRE_APPLY_UPDATED_AT}` =
  `2026-09-10 11:18:14.634`; `${POST_APPLY_CACHED_AT}` is bound from the §8
  `term_contract_cached_at::text` read-back (must equal the response `cachedAt`
  converted from ISO-UTC).
- **F2:** the login delta now declares the engine-managed
  `atlas_auth_accounts.updated_at` advance; actor 46 pre-action
  `updated_at = 2026-09-14T09:27:58.562Z` is bound in §2/§3; §1/§5/§8.3/§12
  updated.
- **F3:** the historical capture baseline lacked actor `updated_at` — folded
  into the F2 fix (the packet now carries the bound value).

## Fresh revalidated identities (read-only, 2026-09-14 ~16:01 UTC)

- Mirror 223: school 1, EnrollPro year 9, `2030-2031`, active, not archived,
  cache **NULL** / cachedAt **NULL**, `updated_at = 2026-09-10T11:18:14.634Z`
  (bound), `created_at = 2026-09-10T11:18:14.634Z`.
- Exactly one active, non-archived school-1 mirror; `TERM_CACHE_SYNC_APPLIED`
  count `0`; audit max `793` / total `242`; actor 46 officer/school 1,
  `last_login_at = 2026-09-14T09:27:55.967Z`; signatures 183/1/0/2;
  `_prisma_migrations` 2.
- Runtime release `3d916b26` (supervisor 3132; 5001→19448, 5174→10880;
  `ROLLOVER_AUTO_SYNC_ENABLED=false`; local health/ready + Tailnet health 200).
- Upstream configured `ENROLLPRO_API` returns the exact contract (year 9,
  `2030-2031`, `TRIMESTER`, T1/T2/T3; active-term `409 ACTIVE_TERM_UNRESOLVED`);
  fingerprint `d4cd7cc4…` / revision `a51b62a2…` exact.

## Approval and integration status

- **Copy-ready HIGH approval sentence:** §12 of the packet — **NOT GRANTED**.
- **Integration status:** `NOT INTEGRATED`, `NOT PUSHED TO MAIN`.
- **Single next action:** `RETURN_TO_HEAD_PLANNER for integration review;
  operator approval may be requested only after integration.`
