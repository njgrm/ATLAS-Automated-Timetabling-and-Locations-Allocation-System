TIER: T1   OWNER: Timetable   BASE: fbde3d4a58320d584be7ba8dcfb68c6750f8cdc6   WORKTREE: E:\ATLAS-worktrees\lane-timetable-p01   BRANCH: work/lane-timetable-p01

ACCEPTANCE (operator's words, verbatim; do not restate): "update the 3 header tests (a2-c12-header-rows2, draft-ux-c01, a2-c11-s2-header-banners) to the c82b8636 wording, asserting behaviour/test ids and importing strings, no product code changes."

CONTEXT: c82b8636 restored calm header rows. The readiness consequence now renders the readiness plus `Can't publish yet`; undo/redo reasons remain in their existing button tooltips; tabs do not wrap. Tests pin behaviour, not wording.

OWNED FILES: atlas-client/src/components/timetable/__tests__/a2-c12-header-rows2.test.tsx; atlas-client/src/components/timetable/__tests__/draft-ux-c01.test.tsx; atlas-client/src/components/timetable/__tests__/a2-c11-s2-header-banners.test.tsx. Editing any other file = stop and report NEEDS_DECISION.

FORBIDDEN: product-code changes; reading .env/runtime-config files; deploy, publish, generation or writes on live; other lanes' files; fixing known client tsc errors.

TESTS PIN BEHAVIOUR, NOT WORDING: assert roles, data-testid, counts and state. Import user-facing strings from the component/string module rather than repeating visible literals. Do not add a source-text assertion.

DONE MEANS: make the three focused package scripts pass; run the relevant preservation suite; do not run a browser server for this test-only packet; commit the candidate and report its SHA. Before exit, commit `wip: p01-header-tests` if anything is uncommitted.

REPORT BLOCK (print exactly, last):
RESULT: LANDED <sha> | PUSHED <branch>@<sha> | BLOCKED <reason> | NEEDS_DECISION <question>
TESTS: <names and pass counts>   SCREENSHOT: N/A test-only   EVIDENCE: <for any diagnosis>   WORKTREE: clean|wip@<sha>
