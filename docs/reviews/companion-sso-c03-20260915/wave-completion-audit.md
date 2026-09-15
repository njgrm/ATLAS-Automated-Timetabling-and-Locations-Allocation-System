# Wave Completion Audit — COMPANION-SSO-C03 / COMPANION-SSO-LIVE-PREP-C02 (2026-09-15)

Compact machine-checkable capsule. The auditor ran read-only and non-mutating;
the primary planner committed this record.

## Capsule

| Field | Value |
| --- | --- |
| Auditor role | `ROLE: WAVE_COMPLETION_AUDITOR` (read-only, non-mutating) |
| Auditor task/session ID | `ses_f5b4dbd29ffeDxtoKLBF9EWIKU` (identifier exposed by the orchestration harness only after the delegated task returned; recorded by the primary planner here per the Mechanical Cycle Closure rule) |
| Model / reasoning | `opencode-go/deepseek-v4.1-flash`; the harness exposed no reasoning-variant selector — fallback disclosed; no HIGH live action was under audit (all HIGH actions remain locked) |
| Reviewed `origin/main` | `c669c77cfc4f8895c5635be6920b9079ab0c259f` |
| Docs range | `c6d83cb4…789487e2` — registration `d314c01f`, merge `d16ee390`, truth reconciliation `789487e2`; merged C02 chain `6409a2a8..233ae67f` |
| Source candidate | `34e5faabd8f2f51b316a3d9a8257b639c05987e3` (base `0ed9225ee8cbb44eee03db799c492bf1654a2465`, single commit, 6 paths) |
| Source integration merge | `fc7abe07e738448cc69f35fccc6614bcf14b3502` (parents `2218b1a2`, `34e5faab`) |
| Mandatory tally | **7 / 7 passed / 0 blocked / 0 unperformed** |
| Verdict | **`AUDIT_CLEAR`** |
| Directive | `origin/main:AGENTS.md` LF-normalized SHA-256 `c1e05ab0aac280b9c335a0ea7fe41ccd9250b42ac5add9960f69508f566dcca7` (blob `4636cd78`); changed mid-cycle by `6488f044` — only the "Cost-aware planner model routing" section differs, no product/SSO/authority rule impact |

## New checks actually run (adversarial)

1. **Consumer-contract fidelity beyond the local mirror** — read `D:/EnrollPro` READ-ONLY at `5887d685`: `RoleEnum`, every `companionSsoReverseExchangeResponseSchema` constraint, the staff-role set (`TEACHER` present), and the 403→`COMPANION_REVERSE_SSO_ACCESS_DENIED` status mapping all match the candidate's producer output and local test mirror; no constraint omitted.
2. **Post-QA byte integrity** — `git diff 34e5faab fc7abe07 -- <6 candidate paths>` empty (zero post-QA product-byte change); `git diff fc7abe07 c669c77c` = docs/plans only; merge parents/ancestry exact.
3. **Shape-writer inventory** — `buildAssertion` is the sole reverse-assertion producer; no other reachable writer can emit raw `account.role` or empty names.
4. **Denial invariants** — the rethrow set is exactly `{COMPANION_SSO_ROLE_UNMAPPABLE, COMPANION_SSO_IDENTITY_NAME_UNAVAILABLE}`; every other failure keeps the unchanged 401 `COMPANION_SSO_INVALID_CODE_BODY`; the atomic consume block is byte-identical to base (SHA-256 `e8467265c7ed72d3c6ddc5b13dd454a695b02fb4e6396c6055a7cbd617133a2e`); typed denials write zero success-audit rows and no assertion.
5. **Helper edge paths (read-only execution)** — 17 targeted assertions plus a 569-case whitespace/token fuzz: single-token `accountName`, one-part-only faculty, whitespace-only, and empty inputs all fail typed; zero empty-name outcomes.
6. **Live-precondition snapshot (read-only)** — durable env still lacks `ENROLLPRO_PROXY_ORIGIN`; live DB `atlas_recovery_clean_rebuild_20260905` still has `0002` absent and no SSO tables; shared runtime still serves release `3d916b26` (supervisor state `running`, 5001→19792 / 5174→19000; Tailnet health 200); EnrollPro `dev-jegs` reachable (`GET /api/settings/public` 200); ATLAS proxy `/enrollpro-api/settings/public` still 502; no post-wave login/audit row and no live mutation.
7. **Register/runtime-map consistency** — registry revision 45 at audit time; C03 `INTEGRATED`; C02 `INTEGRATED`; cited registry captures (`c6d83cb4` rev 31 / 12 streams; `0c203423` 7 streams) verified; `WF-C05` confirmed as a genuine concurrent lane.

## Reused evidence (not rerun)

- Fresh QA `ses_f5b760374ffeMxb6tNGpn1CYcj` `ACCEPT_READY` 8/8/0/0 — mounted suite 19/19 on disposable DB `atlas_qa_sso_c03_20260915` (zero residue), mutants M1/M2/M3 failing, builds, ESM start on port 5319.
- Executor `ses_f5b9dd2d6ffe6tkp3h5wlDGxfA` `REVIEW_REQUIRED` at `34e5faab`.
- Docs QA `ses_f5bb25208ffekI4ETTVf3sLYRu` `ACCEPT_READY` 5/5/0/0 (Phase 1).

## Findings

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| F1 | NON_BLOCKING (docs) | `docs/reference/atlas-runtime-source-of-truth-map.md:169` Flow B bullet did not yet describe the normalized roles/names and typed 403 denials | **Applied** in this closure commit (planner-owned docs-only reconciliation; deterministic remedy supplied by the audit) |
| F2 | NON_BLOCKING (metadata) | The planner's packet metadata cited directive LF-SHA-256 `9d740045…`, which exists nowhere in repository history (computed with a corrupting PowerShell redirection). Correct current value: `c1e05ab0…`. No repository file carried the wrong value; no product/authority rule impact | Corrected here; dispatch packets will cite `c1e05ab0…` |
| F3 | NON_BLOCKING (comment precision) | `companion-sso-identity.ts` / `companion-sso.service.ts` comments summarize EnrollPro's non-403 mapping as "503" while 400/401 map to `CODE_INVALID` and an invalid 200 body to `RESPONSE_INVALID` | Recorded precision-only; ATLAS emits only 200/401/403 here. Not a product/test change; left unmodified so QA does not reopen |
| F4 | NON_BLOCKING (latent, unreachable) | `mapLocalRoleToEnrollProRoles` fails closed for `HEAD_REGISTRAR`/`CLASS_ADVISER`, valid `RoleEnum` values that are not issuable local roles (issuance limited to `admin`/`officer`/`SYSTEM_ADMIN`; live census `faculty` 42 / `officer` 2) | Latent only; failing closed is the stated contract. No action |

## Closure

`COMPANION-SSO-C03` and `COMPANION-SSO-LIVE-PREP-C02` closed `COMPLETE` with
receipts (`docs/plans/receipts/companion-sso-c03.receipt.json`,
`docs/plans/receipts/companion-sso-live-prep-c02.receipt.json`) at registry
revision 52, coordination `MANUAL`. No deployment, login, migration, live-data,
generation, or publication action occurred in this wave. Every live/HIGH action
remains locked; the corrected Option-A source is integrated but **not deployed**.
