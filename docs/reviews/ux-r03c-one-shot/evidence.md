# UX-R03c one-shot — executor evidence (source + deployment)

Base `a7ad0f78c6eb2227785d4b1ea1daac89af0b235f` (`origin/main`, re-fetched, no drift).
Source candidate `c93dd2ee352a1e1a2d2850d6f3e746b69a63f559` on `work/ux-r03c-20260920`.
Release `D:\ATLAS-runtime-supervised-c93dd2ee-20260920` at the pin.
Rollback basis: live-verified incumbent `d50dde64` at
`D:\ATLAS-runtime-supervised-d50dde64-20260920` (supervisor 90968; 5001→91512; 5174→90172).
Elevated executor: true. No login performed. No secret, env value, or DB row is pasted here.

## Source rows 1–6 (source-proven, PASS)

1. A1 single GET: the workspace effect is the only `GET /policies/scheduling/...` left in
   client source; the pane's GET is deleted (only its PUT save remains). PASS.
2. A1 pane hydrates/saves: `policyRecord` + `policyRefreshToken` + `onPolicyRefetch`
   threaded workspace→center→pane; save calls `onPolicySaved` (→`loadAll`) and
   `onPolicyRefetch` (→policy effect). PASS.
3. A1 A-16 preserved: both values cleared before refetch; null record → pane
   `unavailable`; dirty `local`/`editIntent` never clobbered. PASS.
4. A2 chrome overrides for the five routes incl. `/timetable/exports`. PASS.
5. A3 exports sub-page: nested child, both route mappings, App child, center view
   composed from `SimpleExportMenu` + `ExportPresentationSettingsDialog` +
   `useSimpleExportSurface` (shared with the untouched header control). PASS.
6. No regression: client `tsc` clean; full client suite 747/747 pass, 0 fail (only the
   two packet-authorized deferred-exports assertions changed). PASS.

## Deployment rows 7–14 (C02 rows 1–8, reproduced post-action, PASS)

7. Release: installed HEAD `c93dd2ee…` (status: only runtime `ops/runtime/logs/`
   untracked); machine `ATLAS_RUNTIME_SOURCE_DIR` + `ATLAS_RUNTIME_RELEASE_SHA` =
   new dir + pin (verified by re-read); task action/workdir = new dir; authoritative
   `ops/runtime/logs/supervisor-state.json`: `releaseSha=c93dd2ee…`,
   `sourceDir`=new dir, `state=running`, `ownedPids` 92740/82444. (`productPin`
   ignored as historical per packet.) PASS.
8. Ownership: single listeners 5001→92740, 5174→82444, both parented to supervisor
   91896 (`…\c93dd2ee-20260920\ops\runtime\cli.mjs start`, task-launched, not the
   executor shell); task `Running`, SYSTEM, ONSTART, `PT0S`, IgnoreNew (preserved by
   re-export field parity). PASS.
9. Health: local health/ready 200, host `/` + `/__host/ready` 200, Tailnet health 200,
   subjects read 200. PASS.
10. Term truth: `…/schools/1/schedules/published?termIndex=1` → 200, 920 entries,
    distinct termIndex = {1}; `termIndex=bogus` → typed 400 `INVALID_TERM_INDEX`. PASS.
11. Warnings: latest + run-specific violation reports → 401 `NO_TOKEN` pre-dispatch.
    No login performed. PASS.
12. Served identity: local host `/` and Tailnet `/` each serve HTML whose 34 referenced
    assets are all hash-equal to the built dist manifest (0 mismatched); entry chunk
    `assets/index-BiORrVpn.js` (differs from incumbent `index-BZ9J8198.js`); served
    bundle contains `/timetable/exports` and the EnrollPro origin, no SMART/AIMS
    start URL, no React-crash markers. PASS.
13. Config: env hash unchanged `BC7921A7…`, 17-key set unchanged, 0 SMART/AIMS keys;
    supervisor log `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false`;
    no SMART/AIMS secret/URL invented. PASS.
14. Peers + zero write: SMART/AIMS starts → typed 503
    `COMPANION_SSO_NOT_CONFIGURED`, no Location, no Set-Cookie; post schema-wide map
    (46 tables) SHA-256 = pre `e6c013e3…` byte-identical (C01 addendum SQL verbatim,
    throwaway script deleted after each run). PASS.

## Part C browser rows 15–18

Not attempted — browser custody belongs to the independent QA task. No browser launched.

## Anomaly resolved

`node ops/runtime/cli.mjs status` from the new release dir printed a stale
`74c1f12a5c06`/`stopped` document (that dir's artifact). The authoritative
per-release file `ops/runtime/logs/supervisor-state.json` in the new dir reads
`running`/`c93dd2ee…`/new-dir/92740+82444, matching the live listeners. No rollback
trigger; cutover stands.

## Deviations recorded literally

- `schtasks` UTF-16 hazard did NOT recur: `/query /xml` bytes began `FF FE`
  (genuine UTF-16LE + BOM), so the replacement XML was registered directly with
  exactly 2 string swaps (`d50dde64-20260920` → `c93dd2ee-20260920`); re-export
  field parity proven. New XML hash `6C4DECA6…`; original capture `A531C12E…`.
- First alternate-port host smoke returned `UNREACHABLE` because my scratch script
  omitted the required host env (`ATLAS_HOST_STATIC_ROOT`, `ATLAS_HOST_API_TARGET`,
  `ATLAS_HOST_ENROLLPRO_TARGET`); re-ran with supervisor-equivalent values →
  server 200, host live 200, host ready 200, processes stopped, ports clear.
- Existing suites pin header source text (`if (exportingKind !== null) return;`,
  three `resolveSimpleExportRequest('…')` calls, `await dispatchSimpleExport(descriptor)`,
  `setPolicy(null);` immediately before `const fetchPolicyAndWindows`); the header
  keeps a delegating M17 gate plus a truthful sharing comment, and the workspace
  clears the record before the narrow value — no test changed beyond the two
  authorized assertions.
- Scratch scripts lived in-worktree (temp-dir writes unavailable) and were deleted
  after each run; `sigmap-pre/post.txt` hold only aggregate counts+hashes and are
  removed at cleanup.

## Risks

- NON_BLOCKING: D: at 18.81 GiB free (below 25 GiB warn, above 15 GiB floor).
- NON_BLOCKING: `cli.mjs status` resolved a stale artifact in this layout; direct
  per-release state reads are authoritative.
- BLOCKING: none open. Rollback NOT executed (no mandatory failure); incumbent
  release, original task XML (`A531C12E…`, retained operator-only until QA terminal),
  and all prior releases untouched.

Verdict: `REVIEW_REQUIRED` — source candidate plus deployment 14/14 on the real path;
browser rows 15–18 belong to the independent QA pass.
