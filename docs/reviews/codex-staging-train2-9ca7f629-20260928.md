pass 0 / fail 3 / unperformed 1

| row id | result | observed vs expected |
|---|---|---|
| A2 / timetable | FAIL | Grid rendered without React #310; D showed Draft and Publish but no visible Edit/Discard, M1 back returned to grid, M2 room picker listed alternatives, M3 exposed eight targets and accepted a mouse drop, M4 cancel closed its swap review, M5 was not exercised after a saved edit, H exceeded two rows and showed only `149 warnings` rather than severity, and timing was cold grid <=0.54s (hard-reload observation) but one loaded section switch took 1.30s, above 0.4s. |
| A3 / campus + dashboard | FAIL | Campus overview and Building Details rendered, but the editor canvas visibly continued beneath/behind the fixed inspector (36); room-card section-pill/meter detail was unavailable in the selected no-teaching-room fixture (7.1 UNPERFORMED); the dashboard ultimately had a global scrollable document (1966px/768px), while the campus editor and dashboard each first displayed a blank shell before recovering after 60s. |
| A5 / subjects | FAIL | One status filter was present (9.1), but the filter row has search plus five selects rather than four (41); clicking `Araling Panlipunan coverage: 15/15 sections` did not open a coverage dialog (17.1); the shared sortable-header tooltip could not be exercised in this mouse pass (34/35 UNPERFORMED). |
| A6 / teachers + teaching load | UNPERFORMED | Direct `Update teacher list` / `Create temporary teacher` actions, readable resizable profile, inline `Review load` workload dialog, modal `Load summary`, and a toolbar with search, sort, two toggles and draft controls were visible; no edit was made, so save-confirmation (40) was not exercised, and the profile subject-code sizing could not be conclusively judged from this single view. |

New defects

- MAJOR - `/map?mode=editor&buildingId=4`: initial navigation shows a blank app shell; editor appears only after 60s.
- MAJOR - `/`: initial dashboard navigation shows a blank app shell; content appears only after 60s.
- MAJOR - `/map?mode=editor&buildingId=4`: the Grade 10 canvas card is occluded by the fixed Building summary inspector.
- MAJOR - `/subjects`: click any visible `... coverage: n/n sections` button; no coverage dialog opens.
- MAJOR - `/timetable`: select a class and enter move mode; one loaded section switch measured 1.30s, exceeding the 0.4s target.
- MODERATE - `/timetable`: header shows several stacked notice/control rows and `149 warnings`, not the requested two rows with must-fix/advisory severity.
