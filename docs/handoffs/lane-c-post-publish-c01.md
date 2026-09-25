# POST-PUBLISH-C01 handoff (Lane C)

- **Base:** `af3bb594` · **Candidate:** `50b8077c` on `work/lane-c-post-publish-c01` · **Tier:** MEDIUM
  (production wiring across server and client; a new read-only route; no schema, migration, auth-model or write change)
- **Source findings:** B1, B2, B5, B6, B7 in `docs/reviews/ux-audit-teaching-load-and-schedule-controls-2026-09-25.md`.

## What and why

- **Server (`published-revision.service.ts`, `published-revision.router.ts`):** `previewPublishedScheduleRevision` /
  `previewPublishedSwapRevision` run the create path in a `preview` mode — same transaction, advisory lock, scope,
  term contract, source token, previous values and merged `validateHardConstraints` — and return before the first
  write. A missing date defaults to the later of tomorrow and the source revision's date; a missing reason to
  "Preview". Routes: `POST .../published-revisions/preview`, `POST .../published-revisions/swap/preview`, same
  privileged + actor-school gates. The 422 refusal keeps `details.violations` and adds `details.clashes` plus an
  `actionHint` that names the real problem. Swap change-building is extracted and shared by write and preview.
- **Client:** `published-revision-clashes.ts` (plain sentences per clash), `PublishedRevisionClashList`,
  `PublishedSwapRevisionPanel`; the teacher-leaving sheet's published Step 4 runs the dry run and gates the start
  date on a clean result; the swap dialog renders the revision panel for published runs and
  `openRegularSwapPrompt` never posts the direct preview for them; refusals show named clashes; four warnings become
  one note; rotating groups show their term; swap-mode prompts clear when swap mode ends.

## Commands run

- Server: `published-revision-authority-c12.test.ts` all checks pass incl. new rows P1–P5 (clash named, zero writes;
  clean preview agrees with commit; refusal carries clashes; swap preview on the real route 200 + zero writes;
  cross-school preview 403). Failing-first: new rows fail on base (`previewPublishedScheduleRevision` not exported).
- `npm run test:server-suite` 319/323 — the 4 failures are the known `class-program` export rows.
  `npm run build` exit 0. Built server started on isolated port 5198 with an unreachable DB: health 200, the preview
  route answers 401 (mounted, gated). Process stopped by its listening PID.
- Client: `npm run test:post-publish-changes` 12/12; failing-first on base (module absent). `tsc --noEmit` 0.
  Production build with `VITE_ENROLLPRO_URL` exit 0. `test:client-suite` 926/941 — the 15 failures are identical by
  name on base (929/914/15); no candidate-only failure.
- Three suites that pinned the old jargon (`tt-tl-modules-c04r1-behavior`, `-contract`, `-helpers`) carry the old
  assertions as SUPERSEDED comments with plain-language replacements beside them; the published contract (change
  starts only on the chosen date, no end-date reversion) is still asserted.

## Risks

- NON_BLOCKING: the preview holds the same advisory lock as a write for the duration of the check.
- NON_BLOCKING: clash sentences use the short subject display code (e.g. "SCIENCE"); the term label disambiguates
  rotating subjects.
- NON_BLOCKING (not this range): 3 `F4` drift-banner rows in `tt-tl-modules-c04r1-behavior` fail on `main` already.
- Out of scope, owned by C3: B3 (manual edit dead end after publish), B4/B8 (header in `TimetableSimpleHeader.tsx`,
  which `scheduler-clarity-c08` is editing), B9–B11.

## For the reviewer

Review `af3bb594...50b8077c` per the `atlas-candidate-review` skill. Decisive checks: the preview returns before any
`create` in the service; the published swap path contains no `${apiBase}/swap`; Step 5 is unreachable without a clean
check. After deployment, rerun the teacher-leaving test from the audit (Tolentino → Villanueva) and expect the
1:45 PM Orchid/Tulip clash to be named at Step 4.

**Worktree disposition:** `KEEP_ACTIVE` until integrated, then `RETIRE_AFTER_INTEGRATION`.
