# PUBLISHED-TERM-AND-DRIFT-FOLLOWUP-C01 handoff (2026-09-26)

**Source-only cycle; not deployed.** Base `9d01690587a425eb0539dee93769cd89e6f29bef`, candidate
`b0dee7c67c2f403c653cfbeed882c6fb7ea6a792`, integration merge `1dd92647`, pushed to `origin/main`.

## F2 — availability drift routing

Candidate commit `09588b4b` changes the shared availability drift href to `/faculty/concerns`, updates the
real failing-first domain/primary-href controls, and adds a rendered mounted-route assertion. The other six
domain entries and the concern helper/card/banner delegation remain untouched.

Evidence: old `/faculty` fails; new candidate controls pass; client scheduler-concern 26/26; client
suite 989/972/17 with all failures reproduced on base; typecheck and production build pass. One client-suite
pre-existing failure in the changed drift test and the rendered test are base-reproduced.

## F1 — effective published export term authority

Candidate commit `b0dee7c6` keeps the `INITIAL_PUBLICATION` base lookup and live fallback, reads the existing
SCHEDULED/SUPERSEDED effective revision chain, and routes it through the existing
`resolveEffectiveIdentitySnapshot`/`frozenTermContract` seam with `asOf = new Date()`. No new validator/import
edge, no write, and no route/status/code change.

Real disposable-PostgreSQL evidence: C08 160/160; the effective 4-term override makes term 4 resolve; pre-effective
and SUPERSEDED paths stay under the base 3-term authority; active order and `TERM_FILTER_NOT_READY` null-active
behaviour are preserved; snapshot digest is byte-stable. The load-bearing resolver mutant fails the four
discriminating controls. `test:server-db` base-reproduces 5/5 failures with zero candidate-only failures and zero
residue. Published identity suites, server/client typechecks, server build, and `git diff --check` pass.

## QA and integration

Fresh QA `ACCEPT_READY` **15/15/0/0**; model `opencode-go/space-bunny-free`. Combined integration gates reproduced
the candidate product tree, C08, F1 identity suites, client scheduler/typecheck/build, and server build. The live
release remains `861d89a2`; this cycle did not deploy, restart, generate, publish, or touch the live database.

Non-blocking residuals: the export-path 422 mapping suggestion, the archived-read `TERM_SELECTION_REQUIRED`
retention is structural rather than newly executed, the base `test:client-suite` gate-reachability defect, and
existing client copy/route test debt. F1 base-revision selection and date threading remain separate follow-ups.
