---
name: atlas-candidate-review
description: Independently review or QA an ATLAS candidate by commit range (base...candidate) and return one verdict. Use when asked to QA, review, accept or audit a candidate SHA, or when writing an executor handoff that a reviewer will consume.
metadata:
  short-description: ATLAS commit-range QA and handoff format
---

# ATLAS candidate review

Authority: `AGENTS.md` §10, §11, §16. Gates: `docs/reference/agent-verification-gates.md`
(apply only the relevant ones). Read-only: a reviewer never edits, commits, integrates or pushes.

## 1. Pin the range

- `git fetch -q origin`; confirm `git cat-file -t <candidate>` succeeds **in the shared repo**
  (a clone's commit is invisible here — `BLOCKED(transport)` if missing).
- Base must be an ancestor of the candidate. Review `git diff --stat <base>...<candidate>` and
  the full diff of production paths. The implementer must not be the accepting reviewer.
- A handoff or ledger is supporting evidence, never a substitute for the diff.

## 2. Tier

LOW (docs/copy/test-only, mechanically non-behavioural): self-check + planner review, no QA.
MEDIUM (production wiring, cross-layer shape, concurrency): one fresh QA. HIGH (migration,
production-data write, auth boundary, deploy, generation, publication): packet review, explicit
approval, post-action QA. A bounded correction commit gets a review of **that commit and its
blast radius** plus proof the prior accepted blobs are unchanged — not a full re-review.

## 3. Checks that have caught real defects

- Real production route/service exercised; the decisive test **fails without the fix**
  (check out the base for the test, or revert the fix locally in a scratch copy).
- Scope: every changed path is inside the packet's assigned paths.
- Authority/tenant: no `?? 1` / `|| 1` / `schoolId = 1` fallback on a non-public route;
  rejections dispatch and write nothing.
- Consumer enumeration comes from a **mechanical search** that is quoted, and includes the
  tests and fixtures that exercise the changed entry point.
- Frontend (§8): no component file over 1000 physical lines, no native `<select>`, raw
  `<details>`/`title`, or unstyled `<button>`; scroll containment preserved.
- Server (§5): relative runtime imports keep `.js`; the built server starts under Node.
- Timetable work: load `atlas-timetable-invariants`.
- Gate reachability: new test files are wired into a committed suite script.

## 4. Verdict — one page

```
Range: <base>...<candidate>     Tier: LOW|MEDIUM|HIGH
Changed paths: <exact list>
Commands run: <decisive commands with pass/fail/skip counts>
Findings: <each BLOCKING or NON_BLOCKING, with file:line and a failure scenario>
Verdict: ACCEPT_READY | CORRECTION_REQUIRED | BLOCKED(<reason>)
Worktree disposition: KEEP_ACTIVE | RETIRE_AFTER_INTEGRATION | PRESERVE_FOR_DECISION
```

The executor's handoff uses the same shape (base, candidate, paths, what and why, commands
actually run, risks marked BLOCKING/NON_BLOCKING). No transcripts.
