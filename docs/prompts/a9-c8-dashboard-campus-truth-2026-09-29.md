# A9 c8 — the Dashboard must never say "could not check" on a working system, and one room is one number

Owner: lane `a9-c8`, worktree `E:\ATLAS-worktrees\lane-a9-c8-dashboard-truth`, branch
`work/a9-c8-dashboard-truth`, base `origin/main` `24401f0b`. Target train 11. Running alongside A9 c7 and A9 m1 —
your file ownership is the list in §Scope; if you need a path another lane is editing, stop and report it.

Source packet: `docs/prompts/truth-fixes-2026-09-29.md` §"A9 c8" and the 19:58/20:10 addenda. Grade against those
words, not against a narrower rewrite of them.

## Who this is for and what it should feel like

The user is an older, mouse-first scheduler standing in front of a real school on demo day. They open the Dashboard
first. It is the one screen that is supposed to tell them, in one glance, "how far along am I and what is my next
step". Today it can tell them the opposite of the truth in three different ways at once: "ATLAS could not check these"
while the system is working, four different answers to "how many teaching rooms are ready", and a sentence that
counts a room as broken when the only thing missing is a class that has not been scheduled yet.

What should feel different afterwards: the Dashboard is **calm**. While it is still reading, it says it is reading.
When it has read, every line is a number you can walk to the page and find again, and the whole screen points at one
next step. Nothing on it argues with the page it links to.

## Root cause — measured, not guessed

Reproduced on real staging data (`127.0.0.1:5240` preview → staging API `:5101`), 1366x768, `origin/main` `24401f0b`.

`GET /api/v1/dashboard/readiness-summary?schoolId=1` returns **200** with every domain `available: true`
(`sourceState: verified_live`, run 347 `COMPLETED`, `blockingHardCount: 6`, `softViolationCount: 696`,
`isPublished: false`, 20 sections, 21 subjects, 34 teachers, 78/103 rooms). The data is all there. So the live
"9 ATLAS COULD NOT CHECK" screen is **not a failed read — it is the pending state, mislabelled.**

Delaying that one request by 12 s in the browser reproduces the reported screen exactly:

```
Checking source
0 OF 10 READY · 1 STEP TO GO · 9 ATLAS COULD NOT CHECK
ATLAS could not check these
```

`useDashboardData.ts` initialises `domainAvailability` to `unavailableDomainAvailability()` (all six `false`),
`Dashboard.tsx:517-530` derives every checklist row's `unresolved` from those flags, and `ReadinessCard` renders an
`unresolved` row as "ATLAS could not check". A read that has **not arrived yet** is therefore reported as a read that
**failed**. On live the same request takes ~1.5 s at best and the supervisor log shows a 17.5 s event-loop stall and a
22.7 s sibling route, so a scheduler watches "could not check" for many seconds on a system with no fault at all.
There is no retry and no timeout, so a genuinely slow read simply leaves the lie on screen.

Two more facts from the same capture, both of which the packet calls a BLOCKER:

- The Dashboard's "Timetable made and checked" row is fed by a **second** request,
  `GET /generation/1/2/runs/latest/violations` (`useDashboardData.ts:590-601`), while the summary it already received
  carries the same canonical count in `generation.blockingHardCount`. One fact, two reads, two chances to disagree —
  and the second read is the slower one. On the live drill this row read "made and checked" while `/timetable` read
  "No 2023-2024 timetable yet". `/timetable` says "No <year> timetable yet" from
  `components/timetable/SimpleHeaderHelpers.tsx:81` when it has no `context.draft`.
- One school, four answers about the same rooms, all on the Dashboard at once:
  `TEACHING ROOMS 78/103` · `7 ready` · `1 building have no rooms` · campus panel `100%` with the selected building
  "Speech Lab" at `0 teaching rooms ready`. The Campus page (`/map`) says, for the same rooms,
  `78 of 78 teaching rooms are ready to be used for classes.` and `58 rooms need something fixed, in 7 buildings.`
  Six of those seven buildings are only "needs a section yet" — a timetable fact, not a room defect — and the
  seventh (Speech Lab, `rooms: []`) is the one real defect, which the count reports as **0 rooms need something
  fixed, in 1 building** on live.

## What to change (F1–F4)

### F1 — a pending read is never "could not check" (BLOCKER)

While the readiness summary is in flight the readiness region must say it is reading, in words a scheduler
understands, and the `0 OF 10 READY · N STEPS TO GO · N ATLAS COULD NOT CHECK` header must not be published at all.
"Unresolved" must mean *the read failed*, not *the read has not come back*. Decide the wording with the existing
`SOURCE_DECISION_COPY` / `checking_source` copy the screen already owns; do not invent a second vocabulary.
A read that fails must still read as "could not check" — that is the only state that earns those words, and it must
carry the retry the screen currently lacks.

**Subtract first (§11 design gate):** this is a wording/state fix, not an added panel. Do not add a chip, a spinner
region or a sentence to the header. If your change adds visible words anywhere, remove at least as many.

### F2 — "Timetable made and checked" reads the same source as its page (BLOCKER)

Drive that row from the summary's canonical generation count, not from a second request. Then, on real data, the
Dashboard's number and `/timetable`'s number must be the same number for the same run, and the row must never read
"made and checked" while the page it links to says there is no timetable for that year. If the page is right and the
Dashboard is wrong for this data, fix the Dashboard; if you conclude the page is the wrong one, say so explicitly in
the handoff with the evidence, and do not paper over it. One source, one definition, one number.
If the second request is kept for anything, it must not be able to turn an answered fact into "could not check".

### F3 — one room number, one definition, everywhere on the Dashboard

The Dashboard prints the Campus page's figure or it prints nothing. Same numerator, same denominator, same words as
`components/campus-map/CampusMapOverview.tsx:559-574` ("N of M teaching rooms are ready to be used for classes"),
where M is the **teaching** rooms. Retire `78/103` and the separate `7 ready` line rather than reconciling them —
a fraction across two populations is the fabrication the Campus page already removed once (see the A9 C3 note at
`CampusMapOverview.tsx:529-558`). The campus panel's `100%` next to a building with `0 teaching rooms ready` is the
same defect: a percentage with no honest denominator must be omitted, not printed. Also fix the grammar —
`1 building have no rooms` must read `1 building has no rooms` — wherever that string is built
(`useDashboardData.ts:673-679` on the client, and the same shape in the server summary's `buildingSetupStatus`).

### F4 — the Campus problems region counts one thing

A building with no teaching room is a thing to fix, and it must be counted as such: the region must never read
`0 rooms need something fixed, in 1 building`. And `needs-section` (a room with no class yet) must stop inflating the
"needs something fixed" **room** count, because the same screen reports those rooms as ready. Keep the per-building
detail and the one fix per building; change what the summary line counts and says. If you change
`roomProblemSummary`/`buildRoomProblemGroups`, every other caller of them must agree — search first.

## Proof required for each item

State intent, not just the letter, per `AGENTS.md` §11's design judgement gate, and prove it as rendered:

1. **Real staging renders at 1366x768.** Start the preview with
   `powershell -File scripts/dev/start-preview.ps1 -ClientDir <worktree>\atlas-client -Port <5200-5299 free port>`
   (it proxies to the staging API; never point it at 5001), open
   `http://127.0.0.1:<port>/__dev/staging-login`, and screenshot `/`, `/map` and `/timetable` — the real pages, real
   staging data, no fixtures, no harness page. Attach the paths.
2. **The pending state, seen.** With the readiness read delayed (a Playwright route delay is fine for the
   screenshot), the Dashboard must show a reading state, and must not contain the string
   `ATLAS COULD NOT CHECK` or `0 OF 10 READY`. Paste the text you saw in both states.
3. **Every Dashboard line equals its page.** For the rendered `/`, list each readiness row and each room figure and
   the page it must equal, with the value from both. A row that cannot be checked is a failing row, not a note.
4. **`npm run test:encoding` passes**, and `scripts/qa/ux-audit.js` pasted into the page context on every page you
   touched returns `major: 0` with nothing under 14px on what you touched. Attach the JSON.
5. **A regression test for each of F1–F4** in the same commit, reachable from a committed `package.json` script.
   F1's test must fail on `origin/main` and pass on your candidate — prove the failing-first with the literal
   command and its output.
6. `npx tsc --noEmit` (client) and the focused suites you touched. Record what you actually ran.

## Boundaries

- Client source under `atlas-client/src/**` (Dashboard, `useDashboardData`, `ReadinessCard`, the campus components and
  their tests) and, **only if F3/F4 needs it**, the campus block of
  `atlas-server/src/services/dashboard-readiness.service.ts`. Touch nothing else in the server.
- One writer: you, in `E:\ATLAS-worktrees\lane-a9-c8-dashboard-truth`. **Never write in `D:\ATLAS`** — it is Lane C's
  checkout. Do not touch another lane's worktree, `origin/main`, or the live runtime.
- No deploy, no migration, no generation, no publication, no live-data write. A4 ships it.
- Do not `git checkout --`, `git reset --hard` or `git clean` anything with uncommitted work. Commit
  `wip(a9-c8): <what>` and push your branch at least every 30 minutes and before any long step.
- Shared files (`CHANGELOG.md`, `docs/plans/live-state.md`, `docs/plans/atlas-delivery-cycles.json`) are the
  integration owner's. Do not edit them.
- Correct additively: never delete or weaken a test or assertion to close a finding.

## Handoff

Base SHA · candidate SHA · exact changed paths · what changed and why · the decisive commands with results ·
before/after on-screen words for F1–F4 · the screenshot paths · risks marked BLOCKING/NON_BLOCKING · verdict.
One page. Evidence files go in `docs/reviews/a9-c8-20260929/`.
