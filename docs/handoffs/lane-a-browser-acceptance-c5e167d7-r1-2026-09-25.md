# Lane A browser acceptance — c5e167d7 R1 (2026-09-25)

**Verdict: `ACCEPT_READY` for the R1 live pixel rows.** This is a second pass after the
preserved first-pass incident in `lane-a-browser-acceptance-c5e167d7-2026-09-25.md`; the first
pass remains evidence and is not deleted.

## Surface and custody

- Tailnet origin: `https://njgrm.buru-degree.ts.net`; route `/timetable`.
- Seeded Lane A session; waited 15 seconds after navigation.
- Viewports: `1366x768` and `390x844`.
- No login, generation, publication, deletion, or deliberate UI mutation.

## Results

| Row | 1366x768 | 390x844 |
|---|---|---|
| R1 primary timetable/grid text | PASS — 135 rendered nodes at 14px | PASS — 110 rendered nodes at 14px |
| Deliberate 12px flags/special cells | PASS — flag ceremony, schedule notes, Health Break | PASS — same deliberate exceptions |
| Global/document scrollbar | PASS — document/body `scrollWidth=viewport`, `scrollHeight=viewport` | PASS — document/body `scrollWidth=390`, `scrollHeight=844` |
| Main/root overflow | PASS — main contained; inner timetable region had no horizontal overflow | PASS — main contained; inner region `clientWidth=scrollWidth=640` |
| Origin | PASS — Tailnet origin asserted | PASS — Tailnet origin asserted |

The R1 acceptance is specifically the 14px primary grid/timetable text and the explicit 12px
flag/special-cell exceptions. The global 12px chrome labels outside the R1 scope were not treated
as R1 grid sizes.

## Network and console

- The only mutating request was the explicitly disclosed collaboration prerequisite:
  `POST /api/v1/room-preferences/collaboration/ticket` -> 201. No other POST/PUT/PATCH/DELETE occurred.
- The ticket response value is intentionally not recorded.
- Two known non-blocking console/network residuals remain:
  - `/enrollpro-api/settings/public` -> 502
  - `/enrollpro-uploads/55a414b8-4b4c-4de3-8ce8-aa137fdf34a7.png` -> 502

The browser context was closed after both viewports. This closes the Lane A R1 pixel acceptance;
Lane C's separate draft-swap/stall-diagnostic acceptance remains pending.
