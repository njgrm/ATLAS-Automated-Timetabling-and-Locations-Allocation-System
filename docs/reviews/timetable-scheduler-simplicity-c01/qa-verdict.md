# Timetable scheduler simplicity C01 — independent QA verdict

**Verdict: ACCEPT_SOURCE_CORRECTION**

Base: `2f162ccd2d73592f9d0b8854b92e3ce11e30675a`
Candidate: `2ed471db78a615921b336d5abff0c9bf8bf5531d`

The additive correction extends the real local `/timetable` Playwright lifecycle
test to treat `/policies/scheduling/` as a protected read while term authority
is missing. The mounted route proves bounded setup guidance, zero protected
reads (including policy and grade-window endpoints), and zero non-GET requests.
It also preserves the verified-Term-2 default and explicit mouse-driven All
Terms view with all three entries and no overflow reveal control.

Evidence run by fresh Terra QA:

- `npm run test:visual:timetable-simplicity-lifecycle` — 2 passed.
- `cd atlas-client; npm run test:timetable-operator-ux` — 58 passed.
- `npm run typecheck` — passed.
- `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net npm run build` — passed.
- `git diff --check 2f162ccd...2ed471db` — passed; worktree clean.

The same lifecycle assertion was run against immutable baseline
`2e216e103364cb485ed142fc8fe6522a7131cfbf`: the blocked-authority case failed
with `GET /api/v1/policies/scheduling/7/22` and
`GET /api/v1/generation/7/22/grade-windows`, proving the negative guard fails
without the correction.

This is source acceptance only. Deployment, live draft generation, publication,
and authenticated browser acceptance remain HIGH actions and require their own
pre-action/runtime reconciliation and post-action QA.
