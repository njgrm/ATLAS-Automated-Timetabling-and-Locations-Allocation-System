# TL-C02R2 Changed-Scope Advisory Review

## Verdict

`REVIEW_REQUIRED`, `zeroFix: true`.

No material product, authority, safety, test, or scope finding remains in the
TL-C02R2 changed scope. This is advisory evidence only; it is not formal `GO`,
does not authorize a Teaching Load or department-authority apply, and does not
authorize merge or push.

## Review identity and range

- Reviewer context: `collaboration-task:/root/tlc02r2_review`
- Implementer base / current HEAD:
  `e9329d0efb659e3d8cd150c4286e04f257944959`
- Reviewed target: the uncommitted TL-C02R2 working-tree delta on
  `work/teaching-load-tlc02`
- Production source SHA-256:
  `A159D0C960C8C336B94C45A4DF0A59AD89D6775A051FC58896F6D378D8DE8547`
- Service-test SHA-256:
  `0198D3E9F6572D6D535634D73DB91FD13DE5B3274501F39633C5DC17E6CD5764`
- Mounted-route-test SHA-256:
  `69EB9693EAC4B8FDB9C8090D41C0148E4429CE0F0C2ACD18144ED8AC4C4631F0`
- Progress-ledger SHA-256:
  `FBA43D0DC592B37428E6150E722AB490ACA8386AC72ECFE472CDBA56ACCA0447`
- NON_APPLICABLE marker SHA-256:
  `984AB2D535CE2AB8062E64BA22E9169340741D46B7D9F677B393D5CD51751BB9`

The tracked delta contains only the service, the two focused suites, and the
owning progress ledger. The ignored marker is present and was reviewed. Two
pre-existing untracked tests (`faculty-assignment-pass5-regression.test.ts` and
`workload-policy.test.ts`) are not part of this candidate and were not touched.

Post-review evidence-only reconciliation: after this review was first written,
the implementer changed only the ledger's final `PENDING` review line to record
this review's `zeroFix:true` result and independently reproduced checks. The
wording accurately reflects this artifact. Production and both focused-test
hashes remained byte-identical, so no gate rerun was necessary; the ledger hash
above binds the reconciled bytes.

## Production-path review

1. `readSchoolYearAuthoritySnapshot(client, schoolId, schoolYearId)` performs
   both reads through the supplied client: a composite-key read for the
   requested same-school mirror and a full filtered `findMany` for that
   school's active, non-archived set. It contains no global Prisma lookup.
2. Error precedence is explicit and correct:
   - absent requested mirror -> 404 `YEAR_MIRROR_NOT_FOUND`;
   - archived requested mirror -> 409 `ARCHIVED_YEAR`;
   - zero active, non-archived mirrors -> 409 `ACTIVE_YEAR_UNAVAILABLE`;
   - more than one active, non-archived mirror -> 409
     `ACTIVE_YEAR_AMBIGUOUS`;
   - exactly one active mirror for a different year -> 409
     `INACTIVE_HISTORICAL_YEAR`.
3. The successful snapshot is constructed from the resolved sole-active row,
   not merely the requested row. `authorityMode`, mirror identity, active and
   archived state, sync status, and `updatedAt` are included in the canonical
   source revision. A competing active row therefore fails before a stale
   preview can be applied; a changed resolved row changes revision/fingerprint.
4. Readiness and preview use `readReconciliationSourceSnapshot`, which calls
   this authority reader. Apply calls the same snapshot reader inside its
   existing `db().$transaction(..., { isolationLevel: 'Serializable' })` and
   supplies the transaction client before source-revision comparison or any
   write.
5. The two-active-mirror fixture is discriminating: the requested row remains
   active and non-archived, proving the superseded requested-row-only algorithm
   would accept it, while readiness, preview, and apply all return the typed
   ambiguity error. Exact ownership, `FacultySubject`, cycle, and audit counts
   remain unchanged, and supplied-client instrumentation records zero writes.
6. Zero-active and sole-other-active states are separately covered. Archiving
   or deactivating the competing row restores the intended year. Existing
   missing and archived behavior remains covered.

## Independently rerun commands

All commands were run from the assigned worktree; no broad or client suite was
run.

| Command | Result |
| --- | --- |
| `npx tsx src/__tests__/teaching-load-reconciliation.test.ts` | exit 0, 168/168 |
| `npx tsx src/__tests__/teaching-load-reconciliation-route.test.ts` | exit 0, 54/54 |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 |
| `git diff --check` | exit 0; line-ending notices only |

The previous 158 service assertions and 47 route assertions remain present;
the suites now contain 10 and 7 additional authority assertions respectively.
Both disposable fixture suites reported exact zero residue.

## Artifact and boundary review

- The TL-C02R1 fingerprint
  `F0F29E217DF14EA8E87C0F38CD640D9943E5AE3DEC2A907765198A9216023BC0`
  and source revision
  `247B8494D6049536BC606A147A1C37B4564B321E90CC59C30ECECE06298C6490`
  are explicitly marked `NON_APPLICABLE` and authorize no mutation.
- No replacement live preview exists in the changed set. The ledger correctly
  defers it until the separate department-label decision is settled.
- No client contract, other stream, schema, migration, runtime process,
  companion repository, or shared/live data was changed. The only database
  operations observed by this reviewer were the focused disposable fixtures,
  which cleaned to zero residue.

## Findings

No material findings.

Packaging note: because the NON_APPLICABLE marker and this review artifact are
ignored by the repository's general docs policy, the implementer must include
their exact paths explicitly when staging the correction commit. This is not a
product or authority defect in the reviewed working tree.
