# ROOT-WORKTREE-RETIRE-C01 - Pre-Action Manifest (FROZEN)

Generated: 2026-09-14 (Asia/Manila), from the clean root checkout `D:/ATLAS`.
Cycle prompt: `docs/prompts/root-worktree-retire-c01-2026-09-14.md`
Base: `origin/main` = `3d01342113f6042520f63c36831e1183fb9981ab`
Directive: `origin/main:AGENTS.md` LF-normalized SHA-256 = `a44056d4956ea11e67e450f7d2ceb1fb373e97d4e44910e1cba1dd7abcc40feb`
Free space at freeze: D: 5.58 GiB; E: 79.99 GiB
Registered worktrees: 102 total; 94 direct children of `D:/ATLAS-worktrees` (8 outside: root, 3 Codex, 1 temp workspace, 3 runtime releases)

## Method (read-only probes)

- `git status --porcelain` per worktree (clean/dirty), `git rev-parse HEAD`, `git merge-base --is-ancestor HEAD origin/main`.
- Reparse-point scan per worktree: top level, `node_modules`/`atlas-client\\node_modules`/`atlas-server\\node_modules` junction detection (with targets). Full-tree `dir /s /b /al` scan performed for every ELIGIBLE path (0 reparse points each); prior full scans of representative worktrees confirmed the method.
- Junction safety: a disposable probe (2026-09-14) proved `git worktree remove` on this host (git 2.47.0.windows.1) FOLLOWS junctions and deletes the target contents. Therefore any worktree containing a junction with a target outside itself is ineligible; junction targets shared with other worktrees are also preserved.
- Strategy: any worktree whose deps junction into `D:/ATLAS/node_modules` (or another worktree/runtime tree) can never be removed without destroying shared data; such worktrees are PRESERVE_FOR_DECISION.
- Environment-file safety: every found in-worktree `.env` copy is byte-identical to the root and durable copies (SHA-256 match, size 2290/612 bytes); no unique secrets are lost.
- Process/session evidence: full Win32 process command-line scan (2026-09-14 ~18:31); the only live owners are the workflow session worktrees noted below. Root dev servers and the supervised runtime are outside the retirement scope.
- Branch deletion is NOT authorized and NOT performed. Commits and branches survive retirement.

## Totals

- ELIGIBLE_TO_RETIRE: 28
- KEEP_ACTIVE: 3
- PRESERVE_FOR_DECISION: 63
- Expected reclaim from eligible trees (measured physical bytes, reparse-excluded): ~24.3 GiB

## Disposition table (one row per registered direct child)

| # | Path | Branch | HEAD | Status | Merged | Junction (with target) | Register/evidence state | Process | Disposition | Reason | Size |
|---|------|--------|------|--------|--------|------------------------|-------------------------|---------|-------------|--------|------|
| 1 | D:/ATLAS-worktrees/actor-scope-c01 | work/actor-scope-c01 | 98ab5e04a2 | clean | ancestor | - | INTEGRATED | - | PRESERVE_FOR_DECISION | shared junction target of integration-actor-scope-c01 node_modules; removal would delete its deps | - |
| 2 | D:/ATLAS-worktrees/actor-scope-deploy-restore-20260912 | work/actor-scope-deploy-restore-20260912 | 534832bc72 | clean | ancestor | - | INTEGRATED (ephemeral deployment history) | - | PRESERVE_FOR_DECISION | runtime deploy lineage; .env copy; deferred to planner | - |
| 3 | D:/ATLAS-worktrees/aims-ux-audit-c01 | work/aims-ux-audit-c01 | 002e8822af | clean | ancestor | - | closed; no register row | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; no process/register/doc ownership (0 doc references) | 577 MB |
| 4 | D:/ATLAS-worktrees/companion-sso-c01 | work/companion-sso-c01 | fbb9dc6367 | DIRTY(2) | ancestor | - | INTEGRATED (live activation pending HIGH) | - | PRESERVE_FOR_DECISION | dirty (AGENTS.md modified; untracked guide); junction target | - |
| 5 | D:/ATLAS-worktrees/core-rc02d | work/core-rc02d | 6d53714806 | clean | ancestor | - | closed (RC02D acceptance evidence in main) | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; no active ownership | 1482 MB |
| 6 | D:/ATLAS-worktrees/curriculum-sca04a | work/curriculum-sca04a | 330fb91b7d | clean | ancestor | node_modules->D:\ATLAS\node_modules ; server-nm->D:\ATLAS\atlas-server\node_modules | SUPERSEDED (SCA) | none | PRESERVE_FOR_DECISION | external junction: node_modules -> D:/ATLAS/node_modules (removal would delete root deps) | - |
| 7 | D:/ATLAS-worktrees/dashboard-resilience-c01 | work/dashboard-resilience-c01 | 9b05a7c654 | clean | NOT-ancestor | node_modules->D:\ATLAS\node_modules ; client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS\atlas-server\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction; HEAD not ancestor of origin/main | - |
| 8 | D:/ATLAS-worktrees/derived-demand-c01 | work/derived-demand-c01 | c9263b5fb7 | clean | ancestor | - | DEMAND-C01 INTEGRATED | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; atlas-server/.env byte-identical to root and durable copies | 1469 MB |
| 9 | D:/ATLAS-worktrees/enrollpro-proxy-recovery-c01 | work/enrollpro-proxy-recovery-c01 | 54dce67b83 | clean | ancestor | client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS\atlas-server\node_modules | INTEGRATED; live install HIGH approval pending | none | PRESERVE_FOR_DECISION | external junction (client/server -> root); pending HIGH release binding | - |
| 10 | D:/ATLAS-worktrees/generation-genc01 | work/generation-genc01 | 2e922d6dc4 | clean | NOT-ancestor | node_modules->D:\ATLAS\node_modules ; client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS\atlas-server\node_modules | SUPERSEDED | none | PRESERVE_FOR_DECISION | external junction; HEAD not ancestor | - |
| 11 | D:/ATLAS-worktrees/integration-actor-scope-c01 | integration/actor-scope-c01-20260912 | 23c85ae695 | clean | ancestor | node_modules->D:\ATLAS-worktrees\actor-scope-c01\node_modules ; client-nm->D:\ATLAS-worktrees\actor-scope-c01\atlas-client\node_modules ; server-nm->D:\ATLAS-worktrees\actor-scope-c01\atlas-server\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction -> actor-scope-c01 node_modules | - |
| 12 | D:/ATLAS-worktrees/integration-companion-sso-20260913 | integration/companion-sso-20260913 | 68af55faf7 | DIRTY(1) | ancestor | - | INTEGRATED | - | PRESERVE_FOR_DECISION | dirty (AGENTS.md modified) | - |
| 13 | D:/ATLAS-worktrees/integration-enrollpro-proxy-recovery-c01 | integration/enrollpro-proxy-recovery-c01-20260914 | bba85ea5d6 | clean | ancestor | client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS\atlas-server\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction (client/server -> root) | - |
| 14 | D:/ATLAS-worktrees/integration-genc02r1-20260911 | integration/genc02r1-20260911 | 4981149661 | clean | ancestor | - | GEN-C02R1 INTEGRATED (deployed 3d916b26) | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; closed | 584 MB |
| 15 | D:/ATLAS-worktrees/integration-pubc01r3 | integration/pub-c01r3-20260910 | 63a15a370f | clean | ancestor | client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS\atlas-server\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction | - |
| 16 | D:/ATLAS-worktrees/integration-rollover-derived-demand-w1 | integration/rollover-derived-demand-w1 | 36c5d3d173 | clean | ancestor | - | W1-INTEGRATION INTEGRATED | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; closed | 586 MB |
| 17 | D:/ATLAS-worktrees/integration-rrtc01-20260911 | integration/rrtc01-20260911 | 904818d4aa | clean | ancestor | - | RR-TERM-CACHE-C01 INTEGRATED | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; successor deployed via d44f29e0 restore | 577 MB |
| 18 | D:/ATLAS-worktrees/integration-rrtc01r-20260912 | integration/rrtc01r-20260912 | a4dcd0613f | clean | ancestor | - | INTEGRATED | - | PRESERVE_FOR_DECISION | superseded named env source (R0 superseded by R1); shared junction target | - |
| 19 | D:/ATLAS-worktrees/integration-runtime-supervisor-restore-20260912 | integration/runtime-supervisor-restore-20260912 | e21aab04a9 | clean | ancestor | - | INTEGRATED | - | PRESERVE_FOR_DECISION | runtime supervision lineage; deferred to planner | - |
| 20 | D:/ATLAS-worktrees/integration-term-cache-preview-20260913 | integration/term-cache-preview-20260913 | 47e57540a2 | clean | ancestor | - | SUPERSEDED by 20260914 recapture | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; record preserved under docs/reviews/term-cache-catchup-preview-20260913/ | 578 MB |
| 21 | D:/ATLAS-worktrees/integration-term-cache-preview-20260914 | integration/term-cache-preview-20260914 | be1a2d6f44 | clean | ancestor | - | INTEGRATED (capture complete) | - | PRESERVE_FOR_DECISION | pending HIGH term-cache apply; most recent live capture worktree | - |
| 22 | D:/ATLAS-worktrees/integration-term-consume-c02 | integration/readiness-20260911 | b134811395 | clean | ancestor | client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS\atlas-server\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction | - |
| 23 | D:/ATLAS-worktrees/integration-timetable-ttc04 | integration/timetable-ttc04-20260910 | 84d64437bd | clean | ancestor | client-nm->D:\ATLAS-worktrees\timetable-ttc04\atlas-client\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction -> timetable-ttc04 | - |
| 24 | D:/ATLAS-worktrees/integration-timetable-ux01 | integration/timetable-ux-01-20260911 | 0c84496343 | clean | ancestor | - | TT-UX01 INTEGRATED | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; closed | 576 MB |
| 25 | D:/ATLAS-worktrees/integration-tlrr01-20260911 | integration/tl-rr01-20260911 | 95ceedf9e3 | clean | ancestor | - | TL-RR01 INTEGRATED | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; closed | 576 MB |
| 26 | D:/ATLAS-worktrees/integration-tlrr01r-20260911 | integration/tlrr01r-20260911 | fdd0c8c7d9 | clean | ancestor | - | INTEGRATED | - | PRESERVE_FOR_DECISION | named as startable fallback artifact location in register | - |
| 27 | D:/ATLAS-worktrees/integration-tl-suggestion-c03r-20260913 | integration/tl-suggestion-c03r-20260913 | 027b3f65ca | clean | ancestor | - | TL-SUGGESTION-C03R INTEGRATED | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; .env copy byte-identical to root and durable copies | 1470 MB |
| 28 | D:/ATLAS-worktrees/integration-tl-suggestion-c03r2-20260913 | integration/tl-suggestion-c03r2-20260913 | d4e9dc8e07 | clean | ancestor | - | INTEGRATED | - | PRESERVE_FOR_DECISION | same-day activity (2026-09-14); recent closure | - |
| 29 | D:/ATLAS-worktrees/integration-tl-suggestion-c03r3-20260914 | integration/tl-suggestion-c03r3-20260914 | 24567e217c | clean | ancestor | - | INTEGRATED (audited) | - | PRESERVE_FOR_DECISION | same-day activity (2026-09-14) | - |
| 30 | D:/ATLAS-worktrees/integration-tl-tt-c02-20260912 | integration/tl-tt-c02-20260912 | 4e5ef1f601 | clean | ancestor | client-nm->D:\ATLAS-worktrees\tt-shape-diagnostic-c02\atlas-client\node_modules ; server-nm->D:\ATLAS-worktrees\tt-shape-diagnostic-c02\atlas-server\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction -> tt-shape-diagnostic-c02 | - |
| 31 | D:/ATLAS-worktrees/integration-tluxc01-20260911 | integration/tl-ux-c01-20260911 | 6e5f210064 | clean | ancestor | - | TL-UX-C01 INTEGRATED (superseded write path) | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; source in main | 576 MB |
| 32 | D:/ATLAS-worktrees/integration-ttc02 | integration/core-20260909 | e62f784ec7 | clean | ancestor | client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS\atlas-server\node_modules | INTEGRATED (core 20260909) | none | PRESERVE_FOR_DECISION | external junction | - |
| 33 | D:/ATLAS-worktrees/integration-tt-c04-20260913 | integration/tt-c04-20260913 | 992dbccaf2 | clean | ancestor | - | C04 wave COMPLETE (audited) | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; no successor names this worktree | 1453 MB |
| 34 | D:/ATLAS-worktrees/integration-tt-output-c03r3-20260913 | integration/tt-output-c03r3-20260913 | def0dcc9e9 | clean | ancestor | node_modules->D:\ATLAS\node_modules ; client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS-worktrees\companion-sso-c01\atlas-server\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction | - |
| 35 | D:/ATLAS-worktrees/integration-tt-sync-term-c03r4-20260913 | integration/tt-sync-term-c03r4-20260913 | 486bf8c7ee | DIRTY(1) | ancestor | - | SUPERSEDED | - | PRESERVE_FOR_DECISION | dirty (AGENTS.md modified) | - |
| 36 | D:/ATLAS-worktrees/integration-tt-tl-c03-cycle-20260913 | integration/tt-tl-c03-cycle-20260913 | f3ac480900 | clean | ancestor | - | INTEGRATED | - | PRESERVE_FOR_DECISION | external junction; shared junction target | - |
| 37 | D:/ATLAS-worktrees/integration-tt-tl-modules-c04r1-20260914 | integration/tt-tl-modules-c04r1-20260914 | 3a4a3017eb | clean | ancestor | - | INTEGRATED (recovery closed) | - | PRESERVE_FOR_DECISION | same-day activity; C04R1 recovery lineage | - |
| 38 | D:/ATLAS-worktrees/integration-tt-tl-runtime-acceptance-20260912 | integration/tt-tl-runtime-acceptance-20260912 | 5a7308d6e4 | clean | ancestor | - | DEPLOYED_ACCEPTANCE_INCOMPLETE | - | PRESERVE_FOR_DECISION | open stream: rows 4-5 pending term-cache apply | - |
| 39 | D:/ATLAS-worktrees/integration-uxc01r-20260911 | integration/uxc01r-20260911 | 58c3967c16 | clean | ancestor | - | UX-C01R INTEGRATED (deployed) | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse | 588 MB |
| 40 | D:/ATLAS-worktrees/integration-w1-deploy | integration/w1-runtime-deploy-20260911 | ed44d62f09 | clean | ancestor | - | SUPERSEDED | - | PRESERVE_FOR_DECISION | runtime deploy lineage; deferred to planner | - |
| 41 | D:/ATLAS-worktrees/integration-wfc01-20260914 | integration/wfc01-20260914 | bd42eab66b | DIRTY(4) | NOT-ancestor | - | workflow session (live) | node --test in-worktree (observed 2026-09-14) | KEEP_ACTIVE | live node --test process observed in worktree this cycle; unmerged | - |
| 42 | D:/ATLAS-worktrees/migration-guard-r1 | review/migration-guard-r1-63bf48eb | 3b2b4607dc | clean | NOT-ancestor | node_modules->D:\ATLAS\node_modules ; server-nm->D:\ATLAS\atlas-server\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction; review branch not ancestor; review bundle local | - |
| 43 | D:/ATLAS-worktrees/planner-gen-c02-correction | docs/gen-c02-correction | 8052d727b4 | clean | ancestor | - | closed planner docs | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse | 576 MB |
| 44 | D:/ATLAS-worktrees/planner-gen-c02r1 | docs/generation-genc02r1 | 5560eaa668 | clean | ancestor | - | closed planner docs | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse | 576 MB |
| 45 | D:/ATLAS-worktrees/planner-tl-tt-c03-handoffs | docs/tl-tt-c03-handoffs | e01e4ee3e7 | clean | ancestor | - | closed planner docs | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse | 577 MB |
| 46 | D:/ATLAS-worktrees/planner-tt-dynamic-audit-c04 | codex/tt-dynamic-audit-c04 | e3882ca035 | clean | ancestor | - | audit cycle COMPLETE (pushed) | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; contract and audit docs in main | 578 MB |
| 47 | D:/ATLAS-worktrees/planner-tt-tl-modules-c04r1 | docs/tt-tl-modules-c04r1-recovery | ab75c131f4 | clean | ancestor | - | RECOVERY COMPLETE (same-day) | - | PRESERVE_FOR_DECISION | same-day activity; C04R1 recovery lineage | - |
| 48 | D:/ATLAS-worktrees/planner-ux-c01r | docs/ux-c01r | 0215b24a2a | clean | ancestor | - | closed planner docs | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse | 576 MB |
| 49 | D:/ATLAS-worktrees/planner-w1-deploy | docs/w1-runtime-deploy | 002e8822af | clean | ancestor | - | closed planner docs | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse | 577 MB |
| 50 | D:/ATLAS-worktrees/planning-rollover-core | docs/rollover-core-sequence | e39da52013 | clean | ancestor | - | wave-1 planning base; closed | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse | 575 MB |
| 51 | D:/ATLAS-worktrees/publication-pubc01 | work/publication-pubc01 | fbfb9be3b8 | clean | NOT-ancestor | server-nm->D:\ATLAS\atlas-server\node_modules | SUPERSEDED (PUB-C01R3) | none | PRESERVE_FOR_DECISION | external junction; review artifacts; HEAD not ancestor | - |
| 52 | D:/ATLAS-worktrees/readiness-term-c03r3 | work/readiness-term-c03r3 | 5256dc5a7e | clean | ancestor | node_modules->D:\ATLAS\node_modules ; client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS-worktrees\companion-sso-c01\atlas-server\node_modules | INTEGRATED (audited) | none | PRESERVE_FOR_DECISION | external junction | - |
| 53 | D:/ATLAS-worktrees/rr-term-cache-c01 | work/rr-term-cache-c01 | 45f089552d | clean | ancestor | - | INTEGRATED (superseded by C01R) | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; .env copy byte-identical | 1450 MB |
| 54 | D:/ATLAS-worktrees/rr-term-cache-c01r | work/rr-term-cache-c01r | 86376ba7a6 | clean | ancestor | - | INTEGRATED | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; .env copy byte-identical | 1450 MB |
| 55 | D:/ATLAS-worktrees/rr-term-cache-c01r2 | work/rr-term-cache-c01r2 | 4489bbbd54 | clean | ancestor | - | INTEGRATED (deployed d44f29e0) | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; .env copy byte-identical | 1450 MB |
| 56 | D:/ATLAS-worktrees/runtime-r2-final-audit | docs/runtime-r2-final-audit | 3f60eb6d1d | clean | ancestor | - | closed audit | - | PRESERVE_FOR_DECISION | runtime supervision lineage; deferred to planner | - |
| 57 | D:/ATLAS-worktrees/runtime-stability-wave-20260912 | docs/runtime-stability-wave-20260912 | 60cfe3d47e | clean | ancestor | - | COMPLETE | - | PRESERVE_FOR_DECISION | runtime supervision lineage; deferred to planner | - |
| 58 | D:/ATLAS-worktrees/runtime-supervision-c01 | work/runtime-supervision-c01 | 05143d6542 | clean | ancestor | node_modules->D:\ATLAS\node_modules ; client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS\atlas-server\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction; live supervisor source lineage | - |
| 59 | D:/ATLAS-worktrees/runtime-supervisor-live-install-20260912 | work/runtime-supervisor-live-install-20260912 | 2794c40fc9 | clean | NOT-ancestor | - | SUPERSEDED | - | PRESERVE_FOR_DECISION | HEAD not ancestor (rejected candidate 2794c40f) | - |
| 60 | D:/ATLAS-worktrees/runtime-supervisor-live-install-correction-20260912 | codex/runtime-supervisor-live-install-correction-20260912 | 0d30102490 | clean | ancestor | - | R1 integrated | - | PRESERVE_FOR_DECISION | runtime supervision lineage; deferred to planner | - |
| 61 | D:/ATLAS-worktrees/smart-ux-audit-c01 | work/smart-ux-audit-c01 | 7d04798971 | clean | NOT-ancestor | - | old audit | - | PRESERVE_FOR_DECISION | HEAD not ancestor | - |
| 62 | D:/ATLAS-worktrees/teaching-load-apply | work/teaching-load-apply | 4db15182a9 | clean | ancestor | server-nm->D:\ATLAS-worktrees\teaching-load-dept-apply\atlas-server\node_modules | TLC02e apply evidence | none | PRESERVE_FOR_DECISION | external junction -> teaching-load-dept-apply | - |
| 63 | D:/ATLAS-worktrees/teaching-load-dept-apply | work/teaching-load-dept-apply | 5020050b7c | clean | ancestor | - | TLC02d apply evidence | - | PRESERVE_FOR_DECISION | shared junction target | - |
| 64 | D:/ATLAS-worktrees/teaching-load-tlc02 | work/teaching-load-tlc02 | 709dd3b500 | DIRTY(2) | NOT-ancestor | node_modules->D:\ATLAS-worktrees\teaching-load-tlc02\atlas-server\node_modules | closed | none | PRESERVE_FOR_DECISION | dirty; not ancestor; self junction | - |
| 65 | D:/ATLAS-worktrees/teaching-load-ux-c01 | work/teaching-load-ux-c01 | 2aad67a3c1 | clean | ancestor | node_modules->D:\ATLAS\node_modules ; client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS\atlas-server\node_modules | SUPERSEDED | none | PRESERVE_FOR_DECISION | external junction | - |
| 66 | D:/ATLAS-worktrees/teaching-load-ux-c01r2 | work/teaching-load-ux-c01r2 | 52224ce309 | clean | NOT-ancestor | - | INTEGRATED | - | PRESERVE_FOR_DECISION | HEAD not ancestor (patch-equivalent to 1d9a06ec but not ancestor or byte/tree-equivalent) | - |
| 67 | D:/ATLAS-worktrees/term-consume-c02 | work/term-consume-c02 | a55abf7e7b | clean | ancestor | node_modules->D:\ATLAS\node_modules ; client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS\atlas-server\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction | - |
| 68 | D:/ATLAS-worktrees/term-live-migration-preview | work/term-live-migration-preview | e7121e75cb | clean | ancestor | - | TERM-LIVE-APPLY CLOSED | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; rollback bound to approved backup, not this worktree | 1283 MB |
| 69 | D:/ATLAS-worktrees/timetable-ttc02 | work/timetable-ttc02 | 7f7aa8146f | clean | ancestor | node_modules->D:\ATLAS\node_modules ; client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS\atlas-server\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction | - |
| 70 | D:/ATLAS-worktrees/timetable-ttc03 | work/timetable-ttc03 | 7374f398b5 | clean | NOT-ancestor | server-nm->D:\ATLAS\atlas-server\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction (server -> root); HEAD not ancestor (tree-equivalent to 92f2ad4b) | - |
| 71 | D:/ATLAS-worktrees/timetable-ttc04 | work/timetable-ttc04 | f94cfbcfcf | clean | ancestor | - | INTEGRATED | - | PRESERVE_FOR_DECISION | shared junction target | - |
| 72 | D:/ATLAS-worktrees/timetable-ux-01 | work/timetable-ux-01 | b0f607bb94 | clean | ancestor | node_modules->D:\ATLAS\node_modules ; client-nm->D:\ATLAS\atlas-client\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction | - |
| 73 | D:/ATLAS-worktrees/tl-authority-diagnostic-c02 | work/tl-authority-diagnostic-c02 | 7cc6f587c4 | DIRTY(3) | ancestor | client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS-worktrees\integration-rrtc01r-20260912\atlas-server\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | dirty; external junction | - |
| 74 | D:/ATLAS-worktrees/tl-rr01 | work/teaching-load-carry-forward-tlrr01 | 23eae7de0c | clean | ancestor | node_modules->D:\ATLAS\node_modules ; client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS\atlas-server\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction | - |
| 75 | D:/ATLAS-worktrees/tl-rr01r | work/teaching-load-carry-forward-tlrr01r | f66ca39284 | clean | ancestor | node_modules->D:\ATLAS\node_modules ; client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS\atlas-server\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction | - |
| 76 | D:/ATLAS-worktrees/tl-suggestion-c03 | work/tl-suggestion-c03 | 256e2658f9 | clean | NOT-ancestor | node_modules->D:\ATLAS\node_modules ; client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS-runtime-supervised-20260912\atlas-server\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction; HEAD not ancestor | - |
| 77 | D:/ATLAS-worktrees/tl-suggestion-c03r2 | work/tl-suggestion-c03r2 | bcb5382266 | clean | ancestor | node_modules->D:\ATLAS\node_modules ; client-nm->D:\ATLAS-worktrees\integration-tt-tl-c03-cycle-20260913\atlas-client\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction | - |
| 78 | D:/ATLAS-worktrees/tl-suggestion-c03r3-atomicity | work/tl-suggestion-c03r3-atomicity | 83415bd9a6 | clean | ancestor | - | INTEGRATED (audited) | - | PRESERVE_FOR_DECISION | same-day activity (2026-09-14) | - |
| 79 | D:/ATLAS-worktrees/tt-dynamic-workspace-c04 | work/tt-dynamic-workspace-c04 | 2ebb0b1797 | clean | ancestor | - | C04 wave COMPLETE (audited) | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse | 761 MB |
| 80 | D:/ATLAS-worktrees/tt-output-c03 | work/tt-output-c03 | e7deeb918a | clean | ancestor | node_modules->D:\ATLAS\node_modules ; client-nm->D:\ATLAS\atlas-client\node_modules ; server-nm->D:\ATLAS-runtime-supervised-20260912\atlas-server\node_modules | INTEGRATED | none | PRESERVE_FOR_DECISION | external junction | - |
| 81 | D:/ATLAS-worktrees/tt-shape-diagnostic-c02 | work/tt-shape-diagnostic-c02 | ddbdaced1a | clean | ancestor | - | INTEGRATED | - | PRESERVE_FOR_DECISION | shared junction target | - |
| 82 | D:/ATLAS-worktrees/tt-source-freshness-c04 | work/tt-source-freshness-c04 | 7f1fc7f6ad | DIRTY(12) | NOT-ancestor | - | PLANNED successor running | prisma -v from in-worktree node_modules (observed 2026-09-14) | KEEP_ACTIVE | live concurrent session (prisma -v from its atlas-server/node_modules observed); user-directed preserve | - |
| 83 | D:/ATLAS-worktrees/tt-sync-term-c03r4 | work/tt-sync-term-c03r4 | 0902767140 | DIRTY(1) | ancestor | - | SUPERSEDED | - | PRESERVE_FOR_DECISION | dirty (AGENTS.md modified) | - |
| 84 | D:/ATLAS-worktrees/tt-sync-term-c03r5 | work/tt-sync-term-c03r5 | 5163a33504 | clean | ancestor | - | INTEGRATED (audited) | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse; .env copy byte-identical | 1287 MB |
| 85 | D:/ATLAS-worktrees/tt-tl-authority-guard-c04 | work/tt-tl-authority-guard-c04 | 7b31c592c2 | clean | ancestor | node_modules->D:\ATLAS\node_modules ; client-nm->D:\ATLAS\atlas-client\node_modules | INTEGRATED (audited) | none | PRESERVE_FOR_DECISION | external junction | - |
| 86 | D:/ATLAS-worktrees/tt-tl-modules-c04 | work/tt-tl-modules-c04 | b7c4d386f7 | clean | ancestor | - | COMPLETE (audited; same-day) | - | PRESERVE_FOR_DECISION | same-day activity; successor fold-in scope | - |
| 87 | D:/ATLAS-worktrees/tt-warning-authority-c04 | work/tt-warning-authority-c04 | d9b1cd4af8 | clean | ancestor | - | C04 wave COMPLETE (audited) | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse | 1452 MB |
| 88 | D:/ATLAS-worktrees/ux-c01-derived-setup | work/ux-c01-derived-setup | 9e2803694c | clean | ancestor | - | UX-C01R INTEGRATED (deployed) | - | ELIGIBLE_TO_RETIRE | clean+ancestor; zero reparse | 587 MB |
| 89 | D:/ATLAS-worktrees/w1-runtime-deploy | work/w1-runtime-deploy-20260911 | 1ead56227d | clean | ancestor | - | SUPERSEDED | - | PRESERVE_FOR_DECISION | named as startable fallback artifact location in register | - |
| 90 | D:/ATLAS-worktrees/workflow-closure-recovery-20260914 | integration/workflow-closure-recovery-20260914 | 29284ac621 | clean | ancestor | - | COMPLETE (same-day) | - | PRESERVE_FOR_DECISION | same-day workflow session artifact | - |
| 91 | D:/ATLAS-worktrees/workflow-directive-closure-20260914 | codex/workflow-directive-closure-20260914 | 47582013a3 | clean | ancestor | - | closed workflow docs (same-day) | - | PRESERVE_FOR_DECISION | same-day workflow session artifact | - |
| 92 | D:/ATLAS-worktrees/workflow-foundation-wfc01 | work/workflow-foundation-wfc01 | 6b2cb7f1c3 | clean | NOT-ancestor | - | workflow session (live) | workflow session worktree (mtime 2026-09-14 17:54) | KEEP_ACTIVE | live workflow session worktree; HEAD not ancestor of origin/main | - |
| 93 | D:/ATLAS-worktrees/work-runtime-supervisor-live-install-restore-20260912 | work/runtime-supervisor-live-install-restore-20260912 | 5c699f3647 | clean | ancestor | - | COMPLETE (audited) | - | PRESERVE_FOR_DECISION | runtime restore execution lineage | - |
| 94 | D:/ATLAS-worktrees/work-tt-tl-runtime-acceptance-20260912 | work/tt-tl-runtime-acceptance-20260912 | 29ced76f86 | clean | ancestor | - | DEPLOYED_ACCEPTANCE_INCOMPLETE | - | PRESERVE_FOR_DECISION | open stream: rows 4-5 pending term-cache apply | - |

## ELIGIBLE_TO_RETIRE - exact literal paths (28)
- `D:\ATLAS-worktrees\aims-ux-audit-c01`
- `D:\ATLAS-worktrees\core-rc02d`
- `D:\ATLAS-worktrees\derived-demand-c01`
- `D:\ATLAS-worktrees\integration-genc02r1-20260911`
- `D:\ATLAS-worktrees\integration-rollover-derived-demand-w1`
- `D:\ATLAS-worktrees\integration-rrtc01-20260911`
- `D:\ATLAS-worktrees\integration-term-cache-preview-20260913`
- `D:\ATLAS-worktrees\integration-timetable-ux01`
- `D:\ATLAS-worktrees\integration-tl-suggestion-c03r-20260913`
- `D:\ATLAS-worktrees\integration-tlrr01-20260911`
- `D:\ATLAS-worktrees\integration-tluxc01-20260911`
- `D:\ATLAS-worktrees\integration-tt-c04-20260913`
- `D:\ATLAS-worktrees\integration-uxc01r-20260911`
- `D:\ATLAS-worktrees\planner-gen-c02-correction`
- `D:\ATLAS-worktrees\planner-gen-c02r1`
- `D:\ATLAS-worktrees\planner-tl-tt-c03-handoffs`
- `D:\ATLAS-worktrees\planner-tt-dynamic-audit-c04`
- `D:\ATLAS-worktrees\planner-ux-c01r`
- `D:\ATLAS-worktrees\planner-w1-deploy`
- `D:\ATLAS-worktrees\planning-rollover-core`
- `D:\ATLAS-worktrees\rr-term-cache-c01`
- `D:\ATLAS-worktrees\rr-term-cache-c01r`
- `D:\ATLAS-worktrees\rr-term-cache-c01r2`
- `D:\ATLAS-worktrees\term-live-migration-preview`
- `D:\ATLAS-worktrees\tt-dynamic-workspace-c04`
- `D:\ATLAS-worktrees\tt-sync-term-c03r5`
- `D:\ATLAS-worktrees\tt-warning-authority-c04`
- `D:\ATLAS-worktrees\ux-c01-derived-setup`

## Retirement protocol (Phase 3)

1. Per path: re-check status (empty), ancestry, zero reparse points (`dir /s /b /al`), and process references immediately before removal; any deviation preserves that path.
2. Remove only with `git worktree remove <exact-literal-path>` (no --force, no wildcards, no recursive deletion commands).
3. Batches of at most 10; after each batch record D: free space and `git worktree list --porcelain`.
4. After all approved rows: `git worktree prune` only.
5. No branch deletion, no installs, no builds, no runtime/database action.
