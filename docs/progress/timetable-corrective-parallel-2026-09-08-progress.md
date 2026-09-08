# Timetable Corrective Parallel Progress

- Authoritative prompts: `Prompt TT-C01 — Timetable Runtime Truth and Parallel-Safe Page Closure`; `TT-C01A — Narrow Collaboration Scope Authorization`; `TT-C01B — Final collaboration-state cleanup`; `TT-C01B-R — Restore and seal the reviewed collaboration cleanup`
- Current phase: TT-C01B-R sealed
- Implementer context: `/root`
- SOURCE_IMPLEMENTATION: GO
- LIVE_RUNTIME: GO

## Execution ledger

| Task | Risk | Status | Dependencies | Mutation boundary | Evidence / notes |
|---|---|---|---|---|---|
| TT-C01.0 Current-state and collision preflight | LOW | DONE | none | Read-only runtime and repository inspection | Actor school 1; SY 8 / 2029-2030; zero runs; no published schedule; curriculum blocked by `OFFERING_TERM_CONFIG_MISSING`. Existing dirty files belong to SCA/TL active streams. PID 37132 is ATLAS server on 5001. PID 24884 is ATLAS Vite on IPv4 and IPv6 5174. No 5173 listener. Tailscale proxies `127.0.0.1:5174`. |
| TT-C01.1 Timetable mojibake closure | LOW | DONE | TT-C01.0 | Allowed Timetable frontend and focused tests only | Six malformed UTF-8 strings replaced with proper ellipsis/em dash; focused UTF-8 scan PASS. |
| TT-C01.2 Actor-school scope removal | MEDIUM | DONE | TT-C01.0 | TT-C01 plus TT-C01A-authorized collaboration hook/test/artifacts | `/auth/me` re-resolves actor scope with no fallback; all HTTP paths use scoped ID; school is included in caches. The caller cast is removed. The production collaboration connection requires positive integer school/year/run IDs and a token before socket construction, joins only its captured scope, closes and resets on scope cleanup, and rejects selection transmission after closure. No fallback ID exists. Fresh review reports zero fixes. |
| TT-C01.3 Truthful no-run/readiness | MEDIUM | DONE | TT-C01.2 | Read-only readiness route and allowed Timetable UI only | Five explicit readiness states; server blocker shown; one Curriculum Requirements repair link; generation handler fails closed unless ready. Negative control PASS. |
| TT-C01.4 Tailnet correction preview | LOW | DONE | TT-C01.0 | Documentation only; no runtime mutation | `docs/verification/timetable-tailnet-route-preview-2026-09-08.md`. |
| TT-C01.5 Focused verification | MEDIUM | DONE | TT-C01.1–TT-C01.4 | Focused tests/build/browser only | Source gates PASS. Tailnet authentication recovered without runtime mutation. Authenticated Timetable rendered at desktop 1280x720 and mobile 390x844 with no horizontal overflow. It showed the current-year no-run state, exact server readiness blocker, and one 44px-high Curriculum Requirements repair target. Generation controls remained `display:none` with zero dimensions and were absent from the accessibility snapshot, so blocked generation was not invokable. |
| TT-C01.6 Scheduler continuation audit | LOW | DONE | TT-C01.0 | Scheduler source read-only | `docs/verification/timetable-scheduler-successor-map-2026-09-08.md`; repair only relocates scheduled conflicts and returns existing unassigned items unchanged. |
| TT-C01.R Advisory review | MEDIUM | DONE | TT-C01.1–TT-C01.6, TT-C01A | Fresh reviewer; reviewer authors artifact | Reviewer `/root/tt_c01a_final_review` independently reran the prescribed matrix, confirmed the exact boundary, and reported `zeroFix: true`. Artifact: `docs/reviews/timetable-corrective-parallel-2026-09-08/tt-c01a-final-zero-fix-review-root-tt-c01a-final-review.md`. |

## Existing dirty-file attribution

- Curriculum/decision stream: `atlas-client/src/App.tsx`, `atlas-client/src/pages/CurriculumRequirements.tsx`, `atlas-client/src/pages/DecisionWorkspace.tsx`, `atlas-server/src/routes/curriculum-requirements.router.ts`, `atlas-server/src/services/curriculum-decision-candidates.service.ts`, and related decision artifacts.
- Teaching Load stream: `atlas-client/src/pages/TeachingLoad.tsx`, `atlas-client/src/components/faculty-assignments/**`, `atlas-client/src/hooks/useTeachingLoad*.ts`, `atlas-client/src/lib/faculty-*.ts`, `atlas-server/src/routes/faculty-assignment.router.ts`, `atlas-server/src/services/faculty-assignment.service.ts`, `atlas-server/src/services/teaching-load-cycle.service.ts`, and scheduling-policy work.
- Unrelated user artifact: `letter-for-facebook-page.docx`.
- TT-C01 will not edit any of the above.

## Reviews

### Task review log

| Boundary | Reviewer context | Status | Notes |
|---|---|---|---|
| TT-C01 prompt batch | pending | TODO | Advisory reviewer will cover only the final TT-C01 changed scope. |
| TT-C01 review 1 | `/root/tt_c01_review` | FIXED | F1: load now re-resolves `/auth/me` every refresh and clears scoped state before refetch on actor change. F2: no-scope path builder throws before dispatch; executable school-2/no-dispatch test added; request-capable contexts are not built without school scope. F3: ledger reconciled here. |
| TT-C01 review 2 | `/root/tt_c01_rereview` | FIXED | R1: every API method in `useTimetableMutations` now passes through `createTimetableScopedClient`; unresolved scope rejects before raw-client dispatch. Executable spy covers GET/POST/PUT/PATCH/DELETE and school-2 dispatch. |
| TT-C01 review 3 | `/root/tt_c01_final_review_reset` | FIXED | R1: removed three `schoolId ?? 0` sentinels and one `schoolId as number` cast; updated the negative contract to reject both forms; collaboration fails closed before join/send while scope is unresolved. |
| TT-C01 review 4 | `/root/tt_c01_zero_fix_review` | REVIEW_BLOCKED | The nullable collaboration change was technically correct but outside the authoritative edit boundary. The reviewer cannot broaden scope; the hook edit was reverted, leaving its call-site assertion as the exact authorization blocker. Artifact: `docs/reviews/timetable-corrective-parallel-2026-09-08/tt-c01-zero-fix-review-root-tt-c01-zero-fix-review.md`. |
| TT-C01A implementation | `/root` | REVIEW | Valid RED: focused test failed because the production collaboration connection export did not exist. First review rejected helper-only coverage and a shipped guard-bypass seam. Both were removed: the 4/4 final focused tests invoke and rerender the actual production hook with a deterministic hook runtime and recording socket, including queued stale-send cancellation and state/ref/timer cleanup. Runtime truth 9/9 and affected state/decision/Undo/swap 50/50 pass. |
| TT-C01A review 1 | `/root/tt_c01a_review` | FIXED | F1: replaced helper-only lifecycle tests with production-hook render/rerender tests covering school 1 → null and school 1 → school 2. F2: removed the production `scopeGuard` injection seam; the deliberately unsafe mutant now exists only inside the negative-control test. |
| TT-C01A final review | `/root/tt_c01a_final_review` | DONE | `zeroFix: true`; independently confirmed 4/4 collaboration, 9/9 runtime-truth, 62/62 affected state/decision, TypeScript, diff hygiene, production-hook lifecycle cleanup, stale-send prevention, test-only mutant, and exact boundary compliance. |
| TT-C01B implementation | `/root` | DONE | Valid RED: 3/5 focused production-hook lifecycle tests failed on stale `lastError`, inherited selection throttle state, and authentication-loss cleanup. GREEN: 5/5 focused tests after scope reset was extended to error, self ID, timestamp, timer, socket, and connection state and authentication token became an effect identity. |
| TT-C01B-R restoration | `/root` | DONE | Restored the overwritten production hook byte-for-byte to reviewed SHA-256 `5AD9F45A4401B14A42212528679EA5FF186DC5D0E635D7A6A1BD9E4E58D1B973`. The existing test remained at `1C2F541343D6C1F627C346E2359C1687E20BFA6FEEC6599EFB38BB6DD1E8F434`. All prescribed pre-review gates passed. |
| TT-C01B-R review and seal | `/root/tt_c01b_restore_review` | DONE | Fresh review `zeroFix: true`. Post-review hashes matched the reviewer byte-for-byte, then the collaboration suite passed 5/5. No source or test writes occurred after sealing. |
| TT-C01B final review | `/root/tt_c01b_review` | DONE | First fresh review returned `zeroFix: true`. Independently verified collaboration 5/5, runtime truth 9/9, affected state/decision 62/62, TypeScript, diff hygiene, cleanup semantics, and exact boundary compliance. |

### Phase review log

| Phase | Reviewer context | Artifact | Verdict |
|---|---|---|---|
| TT-C01 / TT-C01A / TT-C01B-R | `/root/tt_c01b_restore_review` | `docs/reviews/timetable-corrective-parallel-2026-09-08/tt-c01b-r-restore-seal-review-root-tt-c01b-restore-review.md` | Advisory GO, post-review immutability seal PASS — `REVIEW_REQUIRED` |

## Decisions and risks

- Current runtime evidence supersedes the prompt's stale port-ownership observation: ATLAS currently owns IPv4 and IPv6 port 5174.
- All live probes are read-only. No service, Tailscale, database, generation, publication, or companion repository mutation is authorized.
- Actor school scope must fail closed; cached active-year data that reports school 1 is not actor authority.

## Verification evidence

- Latest affected runtime-truth + Simple state/decision/Undo/swap/term/display set: 86/86 PASS, including the actor-scope and readiness negative controls.
- Latest focused runtime-truth regression after review fixes: 9/9 PASS, including executable school-2 and five-method unresolved-scope zero-dispatch controls.
- TT-C01B collaboration lifecycle: 5/5 PASS, including production-hook error clearing, self-ID isolation, first-selection throttle reset, authentication loss, and stale timer/socket suppression.
- TT-C01B affected state/decision/Undo/swap/term/display suite: 62/62 PASS.
- TT-C01B-R final seal: reviewer and post-review SHA-256 both equal `5AD9F45A4401B14A42212528679EA5FF186DC5D0E635D7A6A1BD9E4E58D1B973` for `useTimetableCollaboration.ts` and `1C2F541343D6C1F627C346E2359C1687E20BFA6FEEC6599EFB38BB6DD1E8F434` for its focused test; post-comparison collaboration rerun 5/5 PASS.
- Final sealed modification timestamps: production hook `2026-09-08 22:07:57 Asia/Manila` (`2026-09-08 14:07:57 UTC`); focused test `2026-09-08 21:32:43 Asia/Manila` (`2026-09-08 13:32:43 UTC`).
- Latest Timetable live-conflict set: 7/7 PASS.
- Client TypeScript: TT-C01A final rerun PASS (`npx tsc --noEmit`) after the concurrent Dashboard edit stabilized.
- One client production build: PASS (`npm run build`).
- `git diff --check`: PASS; only line-ending warnings on existing dirty files.
- Mojibake scan across allowed Timetable files: zero matches for known malformed UTF-8 sequences.
- Tailnet root: HTTP 200 at `100.88.55.125`; browser rendered ATLAS, not IMSCCA.
- Authenticated Tailnet Timetable acceptance: PASS at 1280x720 and 390x844; no overflow or mojibake, one keyboard-focusable repair link, and no visible/invokable generation control while readiness is blocked.

## Stop eligibility matrix

| Check | Count |
|---|---:|
| Safe incomplete implementation tasks | 0 |
| Required deferred/absent/collapsed tasks | 0 |
| Invalid or missing required advisory reviews | 0 |
| Unexplained test removals/reduced assertions | 0 |
| Ledger/report/evidence disagreements | 0 |
| Accessible required read-only routes not probed | 0 |

## Next task

- Formal planner/QA review of sealed TT-C01/TT-C01A/TT-C01B-R. Status: `REVIEW_REQUIRED`. Do not start TT-C02 until formally released.
