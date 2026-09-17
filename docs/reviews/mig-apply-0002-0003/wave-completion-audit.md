# MIG-APPLY-0002-0003 — Wave Completion Audit capsule

Planner-recorded capsule of an independent adversarial audit. The auditor
authored the verdict and findings; this file is a compact transcription, not a
transcript.

| Item | Value |
| --- | --- |
| Stream | `MIG-APPLY-0002-0003` (HIGH live schema apply) |
| Auditor role | fresh `atlas-wave-auditor` (read-only, adversarial) |
| Auditor task id (planner-captured) | `ses_f50eec155ffeIoARuYvLaK2lgr` |
| Model / reasoning | `deepseek-v4.1-flash`, reasoning `medium` — **disclosed fallback**: this HIGH live-database wave calls for `max`; the active catalog exposes no higher variant. The auditor recorded that every finding rests on reproduced binary facts. |
| Reviewed `origin/main` | `61fe85155c31aed4b30ae2075c99897ae41c5256` |
| Candidate / integration | `33b1a90739cd5812c31c21f64c9bd311eb225c1b` / `b93430ad2e22e36363afe9d3382bdbc08ca7f380` |
| Verdict | **`CORRECTION_REQUIRED`** |
| Mandatory tally | total 7 / passed 6 / failed 1 / blocked 0 / unperformed 0 |

## Checks the auditor ran (beyond reused QA)

Supervisor status + listener ownership + child command lines; deployed-tree
reference trace (`app.js`, `auth.router.js`, `companion-sso.service.js`,
`schema.prisma`, `dist` inventory); supervisor env-key enumeration (14 keys, no
SSO keys); live `to_regclass`/counts/`_prisma_migrations` checksum probes;
LF-vs-CRLF checksum reproduction against the persisted registry;
`git ls-files --eol` / `check-attr` / `core.autocrlf`;
`GET /api/v1/subjects?schoolId=1` on both origins; `verify-cycle.mjs` (exit 0);
`render-register.mjs --check` (exit 0); `pg_restore --list` (exit 0, 464 TOC
entries); archive sha256; audit-log post-window delta; C06B S15 source and
packet-row trace. Reused: delegated QA `ses_f50f49d82ffeBADNwOO2vsstR4`
(`ACCEPT_READY`, SOURCE 4/4, LIVE 8/8), the executor evidence document, and the
pre-action review capsule.

## Findings

### B1 — BLOCKING (triggered by this authorized wave)

`atlas-server/src/__tests__/export-presentation-schema-guard-c06b.test.ts`
contains a **non-skipped** mandatory acceptance test `S15` asserting that
`public.teacher_program_presentation_revisions` does **not** exist on the
**configured (live)** database — line 92 (test declaration, no `skip`), line 98
(`S15(before)` assert `''`), and line 385 (`S15(after)` assert `''`). The
applied `0003_teacher_program_presentation` falsifies that premise:
`to_regclass('public.teacher_program_presentation_revisions')::text` now returns
the table name.

Planner verification of B1 (this turn): read the test source at the integration
tip and confirmed the non-skipped test and both assertions; independently
confirmed the live table is present. B1 is confirmed.

Why blocking rather than backlog: the stream `EXPORT-PRESENTATION-SCHEMA-GUARD-C06B`
is `COMPLETE` with a receipt and a byte-frozen evidence set, the assertion is a
committed mandatory acceptance row (S15), and the consolidated deployment lane
exercises the server suite — so the next lane fails on a stale premise. Runtime
behaviour is unaffected (with the table present the P2021 → typed-503
translation is simply untriggered), and the negative control remains valid on the
disposable database where `0003` is deliberately unapplied. The remedy is a
bounded, deterministic, test-only rebaseline from "must not exist" to "must not
be mutated".

### NON_BLOCKING

- **N1 — register bookkeeping (planner-owned).** `lease-mig-apply-0002-0003` was
  still `ACTIVE` while the stream was `INTEGRATED`; **remedied this turn**
  (returned at revision 296). The stale `blocker.safeWorkRemaining` list must be
  cleared at closure.
- **N2 — audit-prompt paraphrase.** "the running build never references these
  tables" is inaccurate for `companion_sso_codes`: the deployed release mounts
  the SSO route and references `prisma.companionSsoCode`, but both entry points
  resolve configuration and fail closed (`COMPANION_SSO_NOT_CONFIGURED` / generic
  invalid body) **before** any table access, and the durable env carries no SSO
  keys. The packet's own §1 claim ("does NOT activate companion SSO") stands;
  no packet correction is needed.
- **N3 — O1 carried precondition.** `.gitattributes` LF coverage omits
  `prisma/migrations/**`, so Prisma persisted CRLF-based checksums for all four
  applied migrations (the pre-existing `0001` row proves the mechanism predates
  this wave). `NON_BLOCKING` for this apply. The auditor narrowed the QA's
  reading: it is **not** a blocking precondition for `CONSOLIDATED-DEPLOYMENT-C10`
  **as written**, because that packet explicitly excludes migration; but it **is**
  a mandatory preflight for any future Prisma migration command, and adding an LF
  rule would itself create drift. Remedy: require
  `git ls-files --eol prisma/migrations` to show `w/crlf` (or recompute the file
  digests and require equality with the persisted checksums) before any
  `migrate deploy`/`status`; record this as a precondition row in the C10 packet.
- Unrelated hygiene: `D:\ATLAS` root remains a stale divergent `main` checkout
  with ~200 modified files and two untracked `*.conf.lock` files. Not this wave.

## Live-precondition snapshot (2026-09-17, Asia/Manila)

Runtime release `54dce67b` from `D:\ATLAS-runtime-supervised-54dce67b-20260914`,
supervisor-owned, 5001→PID 13244 / 5174→PID 13260, `restartFailures 0`, no
restart during the wave; health/ready 200 local and Tailnet; DB
`atlas_recovery_clean_rebuild_20260905@localhost:5432` with 4 finished
migrations, 46 public tables / 23 enums, both new tables empty; `audit_logs` 248
with **zero** rows inside the apply window; durable env mtime predates the wave;
companion mirror `D:\EnrollPro` clean; backup archive verified 270517 B /
`a989f3c9…` / 464 TOC entries.

## Required primary-planner action

Dispatch the bounded `EXPORT-PRESENTATION-S15-REBASELINE` correction (test-only
rebaseline, retirement of the stale unregistered
`docs/prompts/companion-sso-migration-live-c02-2026-09-15.md` packet whose
preconditions are falsified, and the O1 precondition row for C10), then fresh
independent QA, integration, and **one fresh Wave Completion Auditor** over the
changed final tree. Only then may `MIG-APPLY-0002-0003` close `COMPLETE` with its
receipt and may the consolidated-deployment approval sentence be presented.

## State at this commit

`MIG-APPLY-0002-0003` is `INTEGRATED` at register revision **300** (lease returned
at 299; residue reconciled at 300, after the concurrent `G9G10-FLAG-SOURCE-LANE`
lane took revisions 296–298 and forced a rebase of this bookkeeping onto the
remote register) and is
**not** `COMPLETE`: the latest Wave Completion Auditor verdict is
`CORRECTION_REQUIRED`, so closure is barred and no successor HIGH approval is
presented. The applied migrations remain in place and are additive and inert. No
rollback was performed or indicated.
