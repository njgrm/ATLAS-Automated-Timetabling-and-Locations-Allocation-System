TL history · scores 3/2/2/2 · REJECT_UX yes

## 1. Ten-second understanding

This looks like a read-only list for checking who was assigned which subjects and sections in an old school year. I reached it from **Teaching Load** in 2 mouse clicks: **More Teaching Load tools** → **Archived load**. The only offered archived year was **2029-2030**; **2022-2023 was not offered**. Live origin was asserted on Teaching Load and archive: `https://njgrm.buru-degree.ts.net`; viewport 1366x768. No login, save, apply, restore, or edit action was used.

## 2. Scores

| a. Know next step | b. Not dense/intimidating | c. Plain words | d. Tedious work done |
|---:|---:|---:|---:|
| 3 | 2 | 2 | 2 |

## 3. Screen, top to bottom

Left rail: truncated school masthead, **S.Y. 2023-2024 • ACTIVE**; navigation (Dashboard, Sections, Subjects, Teachers, Teaching Load, Teacher Concerns, Campus & Rooms, Class Schedule, Room Schedules, Audit); user **officer / Admin**. Header: breadcrumb **Teachers and Rooms > Archived Teaching Load**, notifications **2**, accessibility button, **Active year: 2023-2024**. Main: **Archived Teaching Load**; “Review preserved assignments from an archived school year.”; **Current Teaching Load** button. Yellow banner: **“Read-only history — 2029-2030”** and **“This school year is archived. You can review its Teaching Load, but you cannot reconcile, suggest, reset, edit, save, or run staffing actions here.”** Filters: **Archived school year** / **Archived year: 2029-2030** (one option), then **Find a teacher, subject, or section** and an empty search box. At 1366px the two filter labels collide visually (“year…Find”), while the search box begins on the next line. Totals: **42 teachers**, **95 subject assignments**, **20 sections**. Then a long, ungrouped stack of teacher cards: name, department code, subject count, and subject-code-to-section rows—for example **AGUILAR, CARLO MIGUEL / FIL / “FIL — FIL Gold, Diamond, Rose”**; **Alcantara, Roberto / SCI / “SCI_BIO — SCIENCE Luna, Sampaguita”**, **“SCI_CHEM”**, **“SCI_ES”**, **“STE_APPLIED_CHEM”**, **“STE_RESEARCH”**. Repeated awkward text includes **“5 subject s”** and **“Department not recorded”**. The masthead itself is cut off as **“ATLAS ENRIQUETA MON...”**.

## 4. Scheduler questions

| Question | Clicks needed | Answered? |
|---|---:|---|
| Who taught Grade 8 MAPEH last year? | 1 click into search, then typing; otherwise manual scan | No. MAPEH teachers can be found, but no grade labels identify Grade 8. |
| What was Ms X’s load? | 1 click into search, then typing | Partly. It shows subjects and sections, not hours/week or a clear total workload. |
| Can I copy last year’s assignments? | 0; the banner answers it | No. There is no copy control and the banner explicitly says no edit/save/staffing actions. |

## 5. Worst problems (ranked)

1. **“Archived year: 2029-2030”** is offered alone; 2022-2023 is absent. Fix: show all archived years or say why each is unavailable.
2. **“Find a teacher, subject, or section”** cannot answer “Grade 8 MAPEH” because cards omit grade. Fix: add Grade and Subject filters plus grade labels in results.
3. **“Archived school year”** collides with **“Find a teacher, subject, or section”** at desktop size. Fix: put each filter in its own row/column with fixed label space.
4. **“95 subject assignments”** and 42 full cards arrive as one wall. Fix: start with searchable, collapsible teacher rows and subject/grade summary.
5. **“SCI_BIO”**, **“STE_APPLIED_CHEM”**, **“TLE_AFA_EXP”** are codes, not scheduler language. Fix: lead with plain subject names; place codes in muted detail.
6. **“5 subject s”** looks broken. Fix: use singular/plural correctly: “5 subjects.”
7. **“Department not recorded”** gives no useful next step. Fix: say “Department was not saved for this archived record.”
8. The page calls this Teaching **Load** but omits hours, periods, and total load. Fix: show “X hours/week, Y classes” on each teacher.
9. **“Read-only history”** correctly forbids changes but leaves no helpful next action. Fix: add “Compare with current year” and a plain explanation of what can be reviewed.
10. **“S.Y. 2023-2024 • ACTIVE”** and **“Active year: 2023-2024”** remain prominent while viewing 2029-2030. Fix: put a large, persistent “Viewing archived year: 2029-2030” identity beside the title.

REJECT_UX: yes (b, c, and d are 2).

## 6. What it should look like

An older scheduler should see one calm heading—“Teaching Load: 2029-2030 (read only)”—with a clearly labeled year picker containing every archived year. Below it, three big mouse-first choices: find a teacher, find a subject/grade, or compare with this year. Results should be short, collapsible cards in plain words: teacher name, total hours/classes, then subject and Grade 7/8/9/10 sections; codes only in a small “details” line. A clear, friendly read-only note should say that this page is for checking history and offer a safe “Compare with current year” view, without surrounding the scheduler with a 42-card wall.
