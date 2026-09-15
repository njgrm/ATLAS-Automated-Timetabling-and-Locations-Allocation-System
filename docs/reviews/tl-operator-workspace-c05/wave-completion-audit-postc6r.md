# TL-OPERATOR-WORKSPACE-C05 wave completion audit — post-C-6R (CORRECTION_REQUIRED)

- Auditor: delegated read-only adversarial context (`atlas-qa-delegate` shell),
  `deepseek-v4.1-flash` at `high`.
- Auditor task/session: `ses_f5a4ca21cffeuu5P1GYK4M7z8F` (returned to the
  planner after the task completed).
- Reviewed `origin/main`: `e60710058b796be3b8233254ba9f334a2747dd79`;
  integration `2b4c436968ee83117c2f6919eb0f99bec707bced` (parents `2614ec2a` +
  `713f5f5a`).
- Base / candidate / register: `56b317c5…` (adopted) / `713f5f5a…` / revision 74.
- Directive pin (byte-exact recompute of `origin/main:AGENTS.md`): `76631646…` —
  matched. Note: the environment-injected `D:\ATLAS\AGENTS.md` (`6488f044`) is
  stale versus `origin/main` (N4).
- Mandatory tally: **9 total / 8 passed / 0 blocked / 0 unperformed / 1 failed**.
- Verdict: **CORRECTION_REQUIRED**.

## Findings

### B1 — BLOCKING: the diagnostics authority feed's reply is not dispatch-precedence-gated

`useTeachingLoadData.ts:158` `canWrite()` gates every sibling feed on
`isLatestDispatch() && …`, but the diagnostics read (`:499-514`) is gated only at
its call site, and its reply currency (`:224`, `:230`, `:238`) is
`isScopeCurrent(binding)` — scope identity + epoch only. For a superseded
**same-scope** dispatch (epoch not advanced, scopeRef unchanged)
`isScopeCurrent` is `true`, so the older reply still runs `setPayload` and
`setLoading(false)`: a superseded invocation writes an actor-school/year
authority feed and clears a loading flag, contradicting the completion mandate
("a superseded older fetch writes nothing — feeds and loading flag alike") and
the candidate's own "every write gated" claim.

Probe QA-AUDIT-B (isolated temp copy, junctioned read-only `node_modules`,
lockfile `CE1AE84E…` verified): two `loadAuthorityDiagnosticsForScope` calls for
the same scope, newer resolves first, older resolves last → returns `persisted`
and overwrites the newer payload (expected `discarded`); reproducible on the
pristine tip. Reachability: `TeachingLoad.tsx:185,189,344,618,659`; no
`AbortController`. The committed controls cover only cross-scope supersession
(`tl-authority-diagnostics-cold-load.test.ts:298-362`) and unbound/different-scope
overlap (`tl-dispatch-precedence-overlap.test.ts`).

**Bounded remedy:** thread the dispatch precedence (or an `isLatestDispatch`
predicate) into `loadAuthorityDiagnosticsForScope` and re-check it at reply time
alongside `isScopeCurrent`; add a committed failing-first same-scope supersession
control; correct the handoff claim.

### NON_BLOCKING

- **N1** The committed behavioral controls lack a bound-then-superseded case:
  mutant M3 (`canWrite()` scope-only) is caught only by the source-string
  assertion at `tl-dispatch-precedence-overlap.test.ts:168`; a source regex may
  support but must not replace a behavioral control (probe QA-AUDIT-A catches it
  behaviorally).
- **N2** `commitScopeBoundWrite` (`useTeachingLoadData.ts:79`) is exported with
  no production caller; the C-6 suite's core control drives it (helper-only
  relative to production). C-6R's factory-driven controls do cover production.
- **N3** The retained local model at `tl-scope-epoch-sibling-feeds.test.ts:105-111`
  still encodes pre-C-6R semantics; its comment no longer mirrors production.
- **N4** The environment-injected `D:\ATLAS/AGENTS.md` (`6488f044`) is stale and
  omits rule 13 and the extended scope-epoch rule; this wave's packets pinned the
  correct `origin/main` hash, so the artifacts are governed correctly.
- **N5** The handoff's `88/88` tally is correct (nine enumerated files: static
  `test(` count 88; runner 88/88) — the earlier QA's "89" was imprecise.

## Checks run vs reused

- **Ran:** directive recompute; integration identity (`2614ec2a..2b4c4369` = the
  4 candidate paths; product parity vs `713f5f5a`; tip delta register-only);
  nine TL suites 88/88; isolated-copy mutants P1/P2 (precedence term removed →
  3/3 fail; `bind()` gate removed → "an older dispatch must never bind"), rule-13
  mutant reproduction (C05 suite 31/4); byte-exact restores; four C-4 blobs
  unchanged; C-5 seam intact; register/custody checks; new probes A/A2/B and
  mutant M3.
- **Reused:** register/QA/executor records as claims only. Isolated copy removed;
  junction target intact (124 entries before/after).

## Live-precondition snapshot

Source-only. No deployment, login, browser, database, runtime, generation,
publication, migration, or companion action by the wave or this audit. No HIGH
action unlocked. Collided legacy worktree `E:/ATLAS-worktrees/tl-operator-workspace-c05`
(`ea9b498d`, dirty) untouched; branches retained; no closure receipt exists.

## Required primary-planner action

Author the bounded additive C-6R2 completion on the C-6R lineage (same branch):
gate the diagnostics reply on dispatch precedence in addition to scope currency,
add committed failing-first same-scope supersession and bound-then-superseded
controls, and correct the handoff claim; then fresh QA and a fresh Wave
Completion Auditor. If this completion does not clear, escalate to the operator
rather than iterate again.
