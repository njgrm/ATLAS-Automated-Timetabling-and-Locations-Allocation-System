# TIMETABLE-TERM-GATE-C01 — make the term-authority gate satisfiable (restore + re-release)

**Status:** `PREPARED`. **Risk:** MEDIUM (production read path). **Owner:** Lane A.
**Priority: highest** — this is the forward fix for the live outage, and it blocks re-releasing
Planner B's `TIMETABLE-SCHEDULER-SIMPLICITY-C01`.

## 0. Root cause — proved against the live system

Live was rolled back to `d4c9f391` on 2026-09-22 because `5a333c74` made the Timetable page unusable.

`5a0a8788 fix(timetable): gate reads on verified term scope` added, in
`atlas-client/src/hooks/useTimetableData.ts` (~`:1538`):

```ts
if (!termAuthorityReadyRef.current || (typeof termFilter !== 'number' && !input.userOverrodeTermFilter)) {
  setRuns([]); setDraft(null); setViolationReport(null);
  setError('Term setup is required before the timetable can be loaded.');
  setLoading(false);
  return;
}
```

`termAuthorityReadyRef` is set **only** from
`context.activeTerm?.verified === true && termIndex != null && orderedTerms.some(t => t.order === termIndex)`
(`:1211`, `:1227`). But the timetable calls `resolveActiveSchoolYearContext({ … preferCache, backgroundRefresh, allowStaleOnError, allowEnrollProFallback })` — **it never passes `verifyUpstream`**, and `verifyUpstream: true` exists in exactly one place in the client (`AppShell.tsx:177`). So the timetable's `/runtime/context` request omits the flag, and the server answers:

```
source: "atlas-unverified",  verified: false,  message: "Active term verification not requested."
```

**The gate can therefore never be satisfied — for anyone, on any data.** On a cold cache nothing
re-triggers it either, so the page stays dead until a reload.

Verified live (read-only, authenticated):

| call | result |
| --- | --- |
| `/runtime/context?schoolId=1` (what the timetable sends) | `verified: false`, `atlas-unverified` |
| `/runtime/context?schoolId=1&verifyUpstream=true` | **`verified: true`**, `activeTerm: "T2"`, `termIndex: 2`, *"ATLAS is aligned with EnrollPro active term T2."* |

**The environment is healthy. Only the wiring is wrong.** The gate's *intent* is right — do not fetch an
implicit all-term scope while term authority is unresolved — so preserve it; make it satisfiable.

## 1. Deliverables

**D1 — obtain a verified term authority.** In `fetchSchoolYear`, after the fast (unverified) read, if
`termAuthorityReadyRef.current` is still false, issue **one** `verifyUpstream: true` call (deduped —
`resolveActiveSchoolYearContext` already dedupes by request profile), set the ref from its result, and
keep the existing late-response actor-school discard. Do not force upstream verification on every
navigation: the fast cached read stays the first step.

**D2 — recover instead of dead-ending.** When that verified context lands, **re-run the load** if the
gate had blocked it. A blocked page must self-heal; today it cannot.

**D3 — never dead-end.** If authority cannot be verified (unresolved / unreachable / contract drift),
the timetable must still load: use an **explicit** term scope (the persisted active term if the context
carries one, else term 1) and surface a visible "term authority unverified" notice, rather than
blocking the whole page. The original safety property is preserved by never fetching an **implicit**
all-term scope while authority is unresolved — not by refusing to load.

**D4 — keep the gate honest.** The gate must still block a genuinely implicit all-term fetch while
authority is unresolved. Add a test for each branch: (a) verified → loads; (b) unverified then verified
→ loads after the recovery re-run; (c) never verifiable → loads with an explicit scope + the notice.

## 2. Boundaries — do not break

- **Writable:** `atlas-client/src/hooks/useTimetableData.ts`, `atlas-client/src/lib/enrollpro-public-settings.ts`
  (only if the verified-call plumbing needs it), the header/notice surface if one is needed, and the
  client tests that assert this behaviour.
- No `atlas-server/**` change. `/runtime/context` already behaves correctly.
- No `docs/**`, `CHANGELOG.md`, or companion repo.
- Do not remove the gate; make it satisfiable. Do not weaken the implicit-scope protection.

## 3. Gates (run and paste literal results)

1. `npm run test:client-suite` — must stay green (845 + your additions).
2. `npm run build` with `$env:VITE_ENROLLPRO_URL='https://dev-jegs.buru-degree.ts.net'`.
3. `git diff --check`.

## 4. Return (one page)

Base SHA · candidate SHA · exact changed paths · the three branch tests with literal output · gate
results · confirmation the implicit-scope protection still holds and no server file changed · risks
marked `BLOCKING`/`NON_BLOCKING` · verdict `REVIEW_REQUIRED`.
