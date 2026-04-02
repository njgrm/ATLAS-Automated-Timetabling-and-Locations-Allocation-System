# Phase Verification Gates

Use this checklist for every implementation batch before marking it accepted.

## 1) Scope Gate
- [ ] Work is within active phase scope in `phasePlan.md`
- [ ] Any cross-phase item has explicit user approval

## 2) Architecture Gate
- [ ] Controllers/routes are transport-only
- [ ] Business logic resides in `/services`
- [ ] Data access and schema changes respect Prisma conventions
- [ ] Endpoints remain versioned under `/api/v1/...`
- [ ] School/year scoping is explicit and validated

## 3) Behavior Gate
- [ ] Acceptance criteria for current feature are testable
- [ ] Error shapes are deterministic and actionable
- [ ] Role and auth constraints are enforced

## 4) Regression Gate
- [ ] Existing high-impact flows still function
- [ ] Route/nav and UX states (idle/loading/empty/error) remain correct
- [ ] Typecheck/build pass for touched app(s)

## 5) Evidence Gate
- [ ] Verification results logged in `docs/verification/evidence-log.md`
- [ ] Blocking issues either fixed or explicitly waived by user
