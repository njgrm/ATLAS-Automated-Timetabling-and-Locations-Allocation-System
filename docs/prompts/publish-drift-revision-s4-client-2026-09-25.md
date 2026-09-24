# S4-client — DRIFT / REVISION UX + D4 read-back packet (2026-09-25)

Program: `docs/plans/teacher-concern-authority-plan-2026-09-24.md` — stream **S4** (client half) plus the
server read-back wiring, decisions **D4/D5**, cycle **C6** (lane B of two; parallel with S2). Read the plan
doc and `docs/reference/agent-verification-gates.md` before editing.

- Base SHA: `48100126fe26f4a53365e3e8ad41039a5e739fa9`
- Worktree / branch (single writer): `E:/ATLAS-worktrees/publish-drift-s4-client` / `work/publish-drift-s4-client`
- Tier: **MEDIUM client + one bounded server read path**. No deployment, generation, publication, live
  apply, or login. The withdraw/revision **apply** remains HIGH-gated; you build and test the path.

## 1. Objective

Make the integrated S4 identity-delta authority **user-visible and honest end to end**:
(a) D5 — map **all seven** `GenerationInputDomain`s in the shared drift routing (currently only 5:
`teachingLoad`, `policy`, `rooms`, `sections`, `subjects`; add `availability`, `derivedDemand`), add an
explicit **"Regenerate to apply"** affordance that preserves valid draft placements, and a read-only
impact preview; **never auto-regenerate a published run**.
(b) Revision UX — create effective-dated revisions carrying optional `identityOverrides` and the bounded
audited withdraw through the integrated S4-server routes.
(c) D4 read-back — wire the canonical published read so identity deltas reach the public published
projection (the accepted S4-server candidate exposed the resolver + `GET …/effective-identity` but
`published-schedule.service.ts` still reads only the base snapshot).

## 2. Owned paths (edit only these)

- `atlas-client/src/components/timetable/timetableDriftRouting.ts` — seven-domain map + regenerate routing
- `atlas-client/src/components/timetable/simple/SimpleDriftBanner.tsx`
- `atlas-client/src/components/timetable/PublishedRevisionDialog.tsx`
- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/lib/published-revision-client.ts`
- `atlas-server/src/services/published-schedule.service.ts` — apply the effective identity snapshot on the
  published read (reuse `resolveEffectivePublishedIdentitySnapshot` / `applyIdentityOverrides` from the
  integrated `published-identity-snapshot.service.ts`; do not fork a second validator)
- `atlas-client/src/types.ts` — additive types only
- `atlas-client/package.json` and `atlas-server/package.json` — add only your own test script lines
- tests: new drift/revision suite(s) + `lib/__tests__/published-revision-client.test.ts`,
  `lib/__tests__/timetable-dynamic-workspace-drift.test.ts`

## 3. Acceptance rows

1. **D5 seven domains:** every `GenerationInputDomain` has a `DOMAIN_META` entry with a truthful label and
   canonical repair home; a changed `availability` or `derivedDemand` domain produces a chip, not an
   unlabelled/umbrella fallback.
2. **Regenerate affordance:** explicit, operator-triggered (never automatic); a read-only impact preview
   states what will change; valid draft placements are preserved; a published run is never
   auto-regenerated (state the guard).
3. **Revision UX:** create an effective-dated revision with optional `identityOverrides` and run the
   bounded, reason-required withdraw through the integrated routes; typed failures surface honestly
   (invalid/inconsistent override, missing reason, cross-school, base immutable).
4. **D4 read-back:** the canonical published read applies the effective identity snapshot in
   effective-date order; a read before the effective date returns the base authority, at/after returns the
   override; the base snapshot is never mutated. Prove with a real-route/real-service test, and confirm no
   existing response shape regresses.
5. **Tests:** new suite(s) registered (`test:*`); client `test:client-suite` + `gate-reachability` and
   server `test:server-suite` stay green; existing assertions updated additively only.

## 4. Do NOT touch

- S2 files: `App.tsx`, `pages/**`, `components/faculty-shared/**`, `components/app-shell/navigation.ts`,
  `FacultyMobileBottomNav.tsx`, `faculty-dashboard/*`, `simple/SimpleMoreMenuContent.tsx`,
  `hooks/useNotificationInbox.ts`, `lib/auth.ts`.
- Any other `components/timetable/simple/**` file; any other `atlas-server/**` file (the S4-server lane's
  `published-revision.service.ts` / `published-identity-snapshot.service.ts` / `published-revision.router.ts`
  are already integrated — import them, do not rewrite them).
- `docs/plans/**`, `CHANGELOG.md`, `prisma/**`, other worktrees, runtime dirs, `D:\ATLAS`.
- No deployment, generation, publication, live apply, or login.

## 5. Evidence

Commit only the owned paths on `work/publish-drift-s4-client`. Do not push; do not touch `main`. If you
approach your step limit, commit a coherent candidate and report its exact state. Handoff: base SHA ·
candidate SHA · changed paths · what changed and why · decisive commands with results (client suite,
server suite, build/typecheck, `git diff --check`) · the failing-first control for the D4 read-back ·
each risk `BLOCKING`/`NON_BLOCKING` · verdict `REVIEW_REQUIRED`. Then a fresh independent `atlas-qa`
reviews the immutable range, and only then does the planner integrate. `types.ts` and both `package.json`
files are shared with S2 and resolved by union at integration — keep edits additive.
