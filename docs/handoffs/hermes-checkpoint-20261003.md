# Session checkpoint — 2026-10-03 morning

Durable handoff for a fresh Hermes session at a lane boundary. Reconciled from Git, the
supervisor state file, and machine scope — not from a transcript.

## Objective

Ship the 2026-10-03 train (A6 placement gate, p06c/d, p07, prisma live-database guard,
auth enforcement, and five member-review packets), then run live Tailnet browser acceptance.

## Current state

- `main` = `7378dbbd` (decision 16a: deploy-count cap and quiet-hours removed).
- `origin/main` = `4c4682b9`. **One unpushed commit.** Push blocked — see Blocker.
- Live release = `a46710d6`, health 200. Not touched this session.
- Train integrated on branch `integration/trains-20261003` (worktree
  `E:/ATLAS-worktrees/lane-int-trains`), tip **`06a03277`**, worktree clean.
- Release worktree `E:/ATLAS-worktrees/lane-a4-release-20261003-trains` exists at
  `4c4682b9` and does **not** yet contain the train.

## Train contents (all independently verified)

| Item | SHA | Evidence |
|---|---|---|
| Auth enforcement | `d52f5355` | independent review ACCEPTED, 0 blocking; 34/34 guarded routes 403; officer 0 denials; capability-override-mount 69/69 (run by planner) |
| Tab affordance + break band | `5e31b698` | contrast measured from built stylesheet; no rendered screenshot |
| MR-71 subjects container | `5883b4e8` | 99/99; coverage assertion proven to discriminate |
| D6 teacher filters | `3486d895` | 136 tests, 1 pre-existing fail; Substitute deliberately not offered |
| D1 vocabulary Edit/Save | `e8bdfbed` | 16 suites, net **0** new failures vs a measured baseline; lint 981 = baseline |
| Gate scripts made reachable | `06a03277` | planner fix; two new tests had no committed script (§11) |

No Prisma schema or migration change in the train. Scope: 107 product files.

## Blocker — needs the operator

`git push` fails:

```
remote: Invalid username or token. Password authentication is not supported.
```

The credential **exists** (Git Credential Manager holds one for `njgrm`); it is stale or
revoked. Not fixable agent-side. The release gate reads `docs/plans/live-state.md` from
`origin/main`, so no cutover can be requested until the push lands.

Full detail: `docs/plans/release-blocked-push.md`.

## Known follow-ups (non-blocking)

1. `TimetableSubNav.tsx:36` still reads `label: 'Draft'` — belongs to the tab-affordance lane.
2. Two in-scope `Published schedule` strings under other lanes' committed pins.
3. Auth test gap: 18 of 34 guarded routes lack a wiring assertion (defence-in-depth only).
4. `D:/ATLAS/atlas-client/node_modules` is empty (pre-existing) — that checkout cannot build.
5. `Faculty.tsx` is at exactly 1000 lines (§8 cap).

## Custody

- Worktrees: `lane-int-trains` = `KEEP_ACTIVE`. Release + candidate worktrees =
  `PRESERVE_FOR_DECISION` until the train lands.
- Browser: released. Tailnet evidence for `a46710d6` already captured and accepted.
- Runtime: untouched this session. Never restarted, never swapped.
- `live-state.md`: **not** updated — it needs the new release SHA, which does not exist yet.

## Next action

Operator refreshes the GitHub token, then:

```
cd D:/ATLAS && git push origin main
git -C E:/ATLAS-worktrees/lane-a4-release-20261003-trains fetch origin
git -C E:/ATLAS-worktrees/lane-a4-release-20261003-trains merge --ff-only origin/main
```

Then merge `06a03277` into the release tree, write the `## Live release` record naming target
and rollback, and run `release-request.ps1`.

## Skills written this session

`atlas-live-browser-evidence`, `atlas-running-tests` (profile `default`).