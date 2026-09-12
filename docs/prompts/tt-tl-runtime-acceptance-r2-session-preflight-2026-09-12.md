# TT/TL runtime acceptance R2 — Session preflight correction

Status: `SUPERSEDED` by
`docs/prompts/tt-tl-runtime-acceptance-r3-final-audit-2026-09-12.md` and the R3
amendment in the active packet. Do not use this file to waive final independent
review or to request HIGH approval.

Role: `PRIMARY_PLANNER`

Apply this correction to the active packet
`docs/prompts/tt-tl-runtime-acceptance-2026-09-12.md` and its living-register
row before requesting HIGH approval. Do not deploy while applying this docs-only
correction.

## Verified state

- `origin/main`: `5c9fb9b3ad96596be5f343925a4d87030b391d25`
- Incumbent supervisor status reports release
  `9d2938791460c1d19059e5eddd30d7bba623fdad`, product pin `d44f29e0`, source
  `D:\ATLAS-runtime-supervised-20260912`, owned PIDs 15388/22272, and
  `ROLLOVER_AUTO_SYNC_ENABLED=false`.
- Local liveness/readiness and Tailnet health returned 200 during planner
  validation. The non-elevated planner could not inspect the SYSTEM scheduled
  task (`Access is denied`/not visible); the elevated executor must reverify it.
- `/api/v1/health` and `/api/v1/health/ready` do not expose `releaseSha`.
  Exact release identity comes from the supervisor status plus deployed Git
  HEAD, not the health JSON.

## Material packet correction

The amended R1 packet currently permits the cutover and only afterward allows
the JWT-only Timetable diagnostic to become
`EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`. That violates the project rule:
never deploy first and later downgrade a mandatory acceptance row because its
credential/session was unavailable.

Before any listener stop, machine-environment change, or task change, the
elevated executor must open the configured persistent Playwright profile and
prove that an existing authenticated officer/admin session can access the
required school/year read-only routes at the exact Tailnet origin. This
preflight must issue no fresh login and no mutation request.

- If the reusable session is valid, proceed with the already reviewed R1
  cutover and acceptance.
- If it is absent, expired, wrong-school, or otherwise unusable, return
  `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` with **no deployment and no
  runtime/task/environment mutation**. The operator may then authorize one
  bounded login or split deployment from authenticated acceptance.

Clarify the post-start evidence language:

- local liveness = HTTP 200;
- local dependency readiness = HTTP 200;
- Tailnet liveness = HTTP 200;
- exact installed `releaseSha` = supervisor status and
  `git -C <new release> rev-parse HEAD`, both equal to `3d916b26...`.

Do not claim the Tailnet health payload itself contains `releaseSha`.

Update every active occurrence in the register consistently and run `git
diff --check`. A material HIGH-packet change invalidates the preceding audit;
the correction-round budget never waives final independent review. The final
packet must receive one fresh pre-action audit before the primary planner may
present an approval sentence.

Suggested commit:

```text
docs(runtime): require authenticated session before TT TL cutover
```
