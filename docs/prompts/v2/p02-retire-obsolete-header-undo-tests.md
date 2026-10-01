TIER: T1   OWNER: Timetable   BASE: 38c304d94def7815021200117079fa5575cf7100   WORKTREE: E:\ATLAS-worktrees\lane-timetable-p02   BRANCH: work/lane-timetable-p02

ACCEPTANCE (operator's words, verbatim; do not restate): "supersede the 2 obsolete assertions in a2-c11-s2-header-labels (T3a/T3c) and the undo single-surface assertion, same rules as p01 (behaviour + imported strings, tests only)."

The older, mouse-first scheduler needs calm, truthful controls. Retire only assertions that contradict the accepted calm-header / single Undo behaviour; preserve the real rendered interaction and the surviving toolbar Undo contract. Do not change product code to make a test pass.

OWNED FILES: atlas-client/src/components/timetable/__tests__/a2-c11-s2-header-labels.test.tsx; atlas-client/src/components/timetable/__tests__/timetable-undo-single-surface-a2.test.tsx. Editing any other file = stop and report NEEDS_DECISION.

FORBIDDEN: product-code changes; package-script changes; reading .env/runtime-config files; deploy, publish, generation or writes on live; other lanes' files; fixing known client tsc errors.

TESTS PIN BEHAVIOUR, NOT WORDING: retain rendered DOM/role/test-id/state assertions for the real production components. Any user-facing string referenced by a test must be imported from the production component or string module rather than repeated as a literal. Do not replace an obsolete assertion with a source-text assertion or a weaker existence check.

DONE MEANS: `npm run test:ux-a2-c11-s2-header`; `npm run test:a2-undo-single-surface-a2`; and `npm run test:ux-a2-c11-s2-header` again as the focused preservation gate all pass. Do not run a browser server for this test-only packet. Commit the candidate, push the branch, and report its SHA.

REPORT BLOCK (print exactly, last):
RESULT: LANDED <sha> | PUSHED <branch>@<sha> | BLOCKED <reason> | NEEDS_DECISION <question>
TESTS: <names and pass counts>   SCREENSHOT: N/A test-only   EVIDENCE: <obsolete assertions and their truthful replacements>   WORKTREE: clean|wip@<sha>
