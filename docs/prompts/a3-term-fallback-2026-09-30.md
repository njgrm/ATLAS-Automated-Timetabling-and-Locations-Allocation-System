# A3 TERM-FALLBACK — 2026-09-30

**Role:** `atlas-executor-ds` (DeepSeek V4.1 Flash, medium). **Planner:** A3 (year and term authority).
**Risk:** HIGH-leaning (term authority), **source-only**. No live writes, no deploy, no migration, no generation, no publication.
**Base:** `3b29bb44` (`origin/main` at authoring). **Worktree:** `E:/ATLAS-worktrees/lane-a3-term-fallback`, branch `work/a3-term-fallback`.
**Dependencies:** already provisioned as junctions to `D:/ATLAS` (root, `atlas-server`, `atlas-client`). **Do not run `npm install`** — it would write through a shared junction.

---

## 1. The defect (cause first)

When EnrollPro is unreachable, ATLAS flips the whole app to **Term 2** even though the last EnrollPro-verified active term was **Term 1**.

**Step 0 — read-only live evidence (planner, 2026-09-30 08:50 +08):**

The live active mirror row is `enrollpro_school_year_mirrors` **id 633** (school 1, `enrollpro_school_year_id` 5, label `2026-2027`, `is_active = true`):

| field | value |
|---|---|
| `term_contract_cached_at` | `2026-09-29T16:05:37.197Z` (the rollover) |
| `term_contract_cache.activeTerm` | **`null`** |
| `term_contract_cache.semanticRevision` | `d93b011827a4fd3f490f0c7ce306573e3d93b0da3f02badca5825940176db06b` |
| terms | T1 `2026-06-08..2026-09-15`, T2 `2026-09-16..2026-12-18`, T3 `2027-01-04..2027-04-08` |

The fallback reads this row through `loadPersistedActiveTermSnapshot` → `derivePersistedActiveTerm(terms, snapshotOrder = null, now = 2026-09-30)`. `snapshotOrder` is `null`, and today (`2026-09-30`) falls inside **T2**'s date range, so it returns **T2**.

The last EnrollPro-verified active term (**T1**, seen at 05:27 today via a passive runtime-context read) was **never persisted**: the passive read path performs no writes, and the only writer (`syncActiveTermContractAuthority`) is idempotent on `semanticRevision` — which deliberately **excludes** the active term — so a verified active term that differs from the stored one is discarded.

**Root cause (named):** `resolveCanonicalActiveTerm`'s unreachable path (`unreachableResolution`, `atlas-server/src/services/active-term-resolver.service.ts`) derives the fallback term from the persisted ordered-term snapshot's **date ranges** (`derivePersistedActiveTerm`), which can name a term that contradicts the last EnrollPro-verified active term. The last verified active term is never persisted.

## 2. The fix

1. **Persist the last EnrollPro-verified active term** whenever the runtime-context read verifies one. Store it in the existing `termContractCache` JSONB under a new `verifiedActiveTerm` key: `{ order: number, identity: string, verifiedAt: string }`. Write it with an **atomic `jsonb_set`** so it never clobbers the ordered structure and never races the sync path's whole-cache write. Best-effort (errors swallowed, never fails the read), and only when the value changes.
2. **Expose it** from `loadPersistedActiveTermSnapshot` as `verifiedActiveTerm`.
3. **Prefer it** in `unreachableResolution`: when a persisted `verifiedActiveTerm` exists, return it (`source: 'atlas-cache-offline'`, `degraded: true`, `cachedAt` = the `verifiedAt` time). Only when none is persisted does the path fall back to `derivePersistedActiveTerm` (preserving the existing behaviour).
4. **Client:** present the degraded fallback as a calm saved-data note, not a verified term change. The shared helper `describeSavedTermSource` (`atlas-client/src/lib/enrollpro-public-settings.ts`) already produces `Using saved term data from <time>.` — reuse it; do not invent a second wording.

## 3. Hard constraints (do not violate)

- **Do NOT persist on the availability/generation read path.** `resolveActiveOrderedTermIndexLive` / `getFacultyAvailability` must stay zero-write: `atlas-server/src/__tests__/active-term-live-resolution-c01.test.ts` row *"availability reads dispatch zero writes"* must stay green. Persist **only** from the runtime-context read (`resolveRuntimeActiveTerm` in `runtime-context.service.ts`).
- **Do NOT persist on the `scheduling-authority` route.** `atlas-server/src/__tests__/term-contract-cache-instrumentation.test.ts` section A (mounted passive route performs zero Prisma writes) must stay green. That route uses `resolveEnrollProTermContract`, not the canonical resolver — leave it alone.
- **No schema migration.** Use the existing JSONB column only.
- **No new dependencies.** No `npm install`.
- **No live writes, no deploy, no generation, no publication.**
- Keep the existing fail-closed invariants: a missing term identity never becomes Term 1; a revision mismatch still fails closed.

## 4. Failing-first tests (mandatory)

New file `atlas-server/src/__tests__/a3-term-fallback.test.ts`, wired into a committed `package.json` script **`test:a3-term-fallback`** in the same commit (§11: a test no gate runs is not evidence).

| Row | Assertion | Fails on base? |
|---|---|---|
| 1 | unreachable + snapshot with `verifiedActiveTerm = { order: 1, identity: 'T1', verifiedAt }` and terms whose dates put today in T2 → resolver returns **T1** | **yes** (base returns T2) |
| 2 | unreachable + snapshot **without** `verifiedActiveTerm` → resolver returns the date-derived **T2** (preservation) | no |
| 3 | the persist function writes `verifiedActiveTerm` via `jsonb_set` and is idempotent (no write when unchanged) | n/a (new) |
| 4 | the runtime-context read persists the verified active term (instrumented client records the write) | n/a (new) |
| 5 | the availability read path performs **zero** writes (preservation) | no |

**Mutant controls (apply, observe red, restore byte-exact):**
- Remove the `verifiedActiveTerm` preference in `unreachableResolution` → row 1 turns red.
- Remove the persist call from the runtime-context read → row 4 turns red.

## 5. Acceptance gates (run literally, record results)

- `npm run test:a3-term-fallback` — green.
- `npm run test:a5-c2a-term-truth` — **14/14** (preservation).
- `npm run test:active-term-live-resolution` — green (preservation).
- `npm run test:server-suite` — green, or the **same failure set as base** (record both).
- `npm run test:server-db` for `term-contract-cache-instrumentation.test.ts` — green on a disposable `atlas_restore_drill_*` database (never live).
- `npx tsc --noEmit` — clean.
- `git diff --check` — clean.

## 6. Deliverable

- One commit on `work/a3-term-fallback` with the server fix, the client note (if changed), the new test, and the `package.json` script.
- A short handoff (≤ 1 page): base SHA, candidate SHA, exact changed paths, what changed and why, the decisive commands actually run with results, known risks marked `BLOCKING`/`NON_BLOCKING`, verdict.
- **Do not** edit `docs/handoffs/lane-c-to-a2.md` — the planner writes that post.
- **Do not** push, merge, or deploy. Return the candidate SHA to the planner.
