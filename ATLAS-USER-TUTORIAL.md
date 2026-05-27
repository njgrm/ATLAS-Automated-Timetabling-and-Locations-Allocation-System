# ATLAS — Step-by-Step User Tutorial
## For Scheduling Officers and Faculty

> **What is ATLAS?**
> A.T.L.A.S. (Automated Timetabling and Locations Allocation System) is a web-based Progressive Web App (PWA) that helps Philippine Junior High Schools automatically generate, review, and publish academic timetables. It supports two primary user roles: the **Scheduling Officer** who builds and manages the schedule, and **Faculty** (teachers) who submit preferences and view their assigned schedule.

---

## Table of Contents

1. [How ATLAS Fits Into the Bigger Picture (EnrollPro & Microservices)](#1-how-atlas-fits-into-the-bigger-picture)
2. [Getting In: Login and Authentication](#2-getting-in-login-and-authentication)
3. [Scheduling Officer Walkthrough](#3-scheduling-officer-walkthrough)
   - [3.1 Dashboard — Your Control Room](#31-dashboard--your-control-room)
   - [3.2 Subjects — What Gets Taught](#32-subjects--what-gets-taught)
   - [3.3 Campus Map Editor — Where Things Happen](#33-campus-map-editor--where-things-happen)
   - [3.4 Faculty — Who Teaches](#34-faculty--who-teaches)
   - [3.5 Teaching Load — Assigning Teachers to Sections](#35-teaching-load--assigning-teachers-to-sections)
   - [3.6 Officer Preferences — Reviewing Faculty Input](#36-officer-preferences--reviewing-faculty-input)
   - [3.7 Generating the Schedule](#37-generating-the-schedule)
   - [3.8 Schedule Review — Inspecting and Fixing the Timetable](#38-schedule-review--inspecting-and-fixing-the-timetable)
   - [3.9 Publishing the Schedule](#39-publishing-the-schedule)
4. [Faculty Walkthrough](#4-faculty-walkthrough)
   - [4.1 Faculty Login](#41-faculty-login)
   - [4.2 My Dashboard — Overview at a Glance](#42-my-dashboard--overview-at-a-glance)
   - [4.3 My Preferences — Telling the System When You're Available](#43-my-preferences--telling-the-system-when-youre-available)
   - [4.4 My Room Preferences — Mobility and Wellness Needs](#44-my-room-preferences--mobility-and-wellness-needs)
   - [4.5 My Schedule — Your Published Timetable](#45-my-schedule--your-published-timetable)
5. [Public / Student Schedule View](#5-public--student-schedule-view)
6. [Offline Fallback — How the System Works Without Internet](#6-offline-fallback--how-the-system-works-without-internet)
7. [The Schedule Lifecycle — State by State](#7-the-schedule-lifecycle--state-by-state)
8. [Hard vs. Soft Constraints — Why Some Edits Are Blocked](#8-hard-vs-soft-constraints--why-some-edits-are-blocked)
9. [Troubleshooting Common Situations](#9-troubleshooting-common-situations)

---

## 1. How ATLAS Fits Into the Bigger Picture

### In Plain Terms
ATLAS does not work alone. Think of it as one specialist department in a larger school system. Another system called **EnrollPro** manages student enrollment, sections (class groups), and faculty records. ATLAS *depends on* EnrollPro for the raw data it needs before it can build a schedule.

The relationship looks like this:

```
EnrollPro  ──(sends faculty + sections)──▶  ATLAS  ──(publishes timetable)──▶  Students / Faculty
```

ATLAS never touches EnrollPro's database directly. They are completely separate systems that only talk to each other over the internet (HTTP API calls). This is called a **microservice architecture** — each application owns its own data and communicates through well-defined contracts (APIs).

### What ATLAS Waits For Before It Can Generate a Schedule

| Data ATLAS Needs | Where It Comes From | What Happens If It's Missing |
|---|---|---|
| Faculty list (who the teachers are) | EnrollPro HR/LIS API | ATLAS uses a local mirror; generation may show unassigned sessions |
| Sections (student class groups, e.g. Grade 7 — Narra) | EnrollPro enrollment data | No sections = nothing to schedule |
| Academic year / term context | EnrollPro public settings API | ATLAS falls back to its last cached year context |

### The Technical Side

**EnrollPro → ATLAS faculty sync** works through a **swappable adapter** pattern. Think of an adapter like a universal plug converter — the code that fetches faculty data is isolated in one file (`atlas-server/src/services/faculty-sync/`). In development and early deployment, ATLAS uses a **stub adapter** that returns simulated faculty data so development can proceed without a live EnrollPro connection. When the real EnrollPro is ready, only the adapter needs to swap — nothing else in ATLAS changes.

**The bridge token** is how a user logged into EnrollPro opens ATLAS without logging in again. EnrollPro stores a JWT (a secure digital ticket) in the browser. A bookmarklet or sidebar link passes that ticket to ATLAS in the URL (`?bridgeToken=...`). ATLAS reads it, stores it temporarily in `sessionStorage`, and uses it to identify the user on every API call. They share the same secret key so ATLAS can verify the ticket is genuine.

**EnrollPro public settings** (`/api/settings/public`) tell ATLAS things like: what the current school year is, what the school's name and brand colors are. This is how the ATLAS header shows the correct school name and accent color without ATLAS having to manage branding separately.

---

## 2. Getting In: Login and Authentication

### For Scheduling Officers / Admins

**In Plain Terms:** You can log in directly to ATLAS with your employee ID and password. You do not need to go through EnrollPro first, though you can.

**How to log in directly:**
1. Go to the ATLAS URL (e.g., `https://njgrm.buru-degree.ts.net`).
2. Enter your **Employee ID** (e.g., `1000001`) and **password**.
3. Click **Sign In**.

**How it works technically:** ATLAS uses its own local authentication database. Your employee ID and a hashed password are stored in ATLAS's PostgreSQL database. When you log in, the server verifies the password against its stored hash (using `bcrypt`) and issues a JWT (JSON Web Token). This token is stored in your browser's `localStorage` and is included automatically in every subsequent request using an Axios HTTP interceptor. The token expires after a configured time period, after which you are required to log in again.

**Via EnrollPro Bridge (alternative):**
If you are already logged into EnrollPro, a bookmarklet in your browser toolbar can open ATLAS in a new tab while carrying your session over. The shared JWT secret means your EnrollPro identity is trusted by ATLAS automatically.

### For Faculty

Faculty log in using their **email address** and **password** — provisioned when their record is imported from EnrollPro. The login page is the same URL, but ATLAS detects the role from the token and routes them to the faculty portal (`/my/dashboard`) instead of the officer dashboard.

---

## 3. Scheduling Officer Walkthrough

### 3.1 Dashboard — Your Control Room

**What you see when you first log in:**
The Dashboard is your command center. It shows:
- The current **lifecycle phase** of the active schedule (a progress bar: Setup → Preferences → Generation → Review → Published).
- A **setup checklist** — things that must be done before you can generate (subjects configured, teachers synced, rooms mapped, policies set).
- **Key stats** — total subjects, faculty count, rooms available, sections loaded.
- A **live campus map mini-view** — a visual overview of buildings, clickable to see room usage.

**Why each section is there:**
- The **lifecycle bar** exists because generating a schedule at the wrong step would produce meaningless results. You must set up the building blocks first.
- The **setup checklist** catches missing configuration early, before you waste time running a generation that immediately fails.
- The **map mini-view** gives spatial context — at a glance you can see which buildings are busiest.

**How it works technically:**
The Dashboard loads data from several API endpoints in parallel:
- `GET /api/v1/schools/:id/stats` — counts subjects, faculty, rooms.
- `GET /api/v1/map/schools/:id/buildings` — building and room data for the Konva canvas.
- `GET /api/v1/generation/:schoolId/:yearId/runs/latest` — current generation run state.
- `GET /api/v1/enrollpro-context` (proxied) — school year from EnrollPro's public settings.

The campus map is drawn on an HTML5 `<canvas>` element using the **React Konva** library, which provides React-friendly wrappers around the Konva 2D canvas engine. Buildings are rendered as colored rectangles with text labels; rooms are shown inside when you hover or click.

The school year context (which academic year is "active") is resolved through `resolveActiveSchoolYearContext()`. This function tries EnrollPro's public settings API first, then falls back to the last value it cached locally.

---

### 3.2 Subjects — What Gets Taught

**What this page does:**
This is where you define every subject that needs to be scheduled — Filipino, English, Mathematics, Science, Araling Panlipunan, MAPEH, TLE/TVL, and Homeroom Guidance (per DepEd DO 010 s.2024). For each subject you set:
- Its **name and code** (e.g., `ENG-G7`, "English Grade 7").
- The **required room type** (classroom, laboratory, computer lab, TLE workshop, etc.).
- The **minimum weekly minutes** — how many minutes of instruction this subject needs each week.
- The **grade levels** it applies to (Grade 7, 8, 9, or 10) and any special program codes (STE, SPA, HE, IA, AFA).

**Why this matters:** The scheduler uses these settings to know "this subject needs 240 minutes/week and must be in a laboratory." Without this, it can't match sessions to rooms or validate whether the weekly minute requirement is met.

**How it works technically:**
Subjects are stored in the `Subject` table in PostgreSQL via Prisma ORM. The Subject model carries fields like `weeklyMinJhs`, `requiredRoomType`, `gradeLevel`, and `programCode`. When a generation run starts, the server calls `reconcileSubjectContractFromUpstream()` which syncs subject definitions with the latest data and ensures default templates (subject ↔ grade ↔ room type bindings) are current. This prevents stale subject data from silently corrupting generation output.

The Subjects page is paginated (10/25/50/100 per page), sortable, and filterable by grade and room type. All form controls use `shadcn/ui` Select and Dialog components — never raw HTML `<select>` elements — to maintain visual consistency with the design system.

---

### 3.3 Campus Map Editor — Where Things Happens

**What this page does:**
The Map Editor lets you draw your school's physical layout:
1. **Upload a campus photo** as a background reference image.
2. **Draw buildings** as colored rectangles on top of the photo.
3. **Add rooms** inside each building with name, floor, type, and capacity.

This data drives room assignment during schedule generation — the system knows a science lab is in Building C, floor 2, and has a capacity of 40.

**How to use it:**
- Click the "Draw Building" tool, then click and drag on the canvas to place a rectangle.
- Click a building to select it; a side panel opens to rename it, change its color, and manage its rooms.
- For each room, specify: name (e.g., "Room 201"), floor, type (Laboratory, Classroom, etc.), and capacity.
- Hit **Save** when done.

**How it works technically:**
The editor is built on **React Konva**, using `Stage`, `Layer`, `Rect`, and `Text` components to render the interactive canvas. Buildings are `Konva.Group` elements containing a `Rect` (body) and `Text` (label). The `Konva.Transformer` enables drag, resize, and rotation.

The Map Editor keeps a **30-step undo/redo history** in React state (two arrays: `historyStack` and `redoStack`). Every significant change pushes a snapshot before and after, so you can step back through your edits.

Data is saved to PostgreSQL:
- `POST /api/v1/map/schools/:id/buildings` — creates a building.
- `PUT /api/v1/map/schools/:id/buildings/:buildingId` — updates position, size, color.
- `POST /api/v1/map/schools/:id/buildings/:buildingId/rooms` — adds a room.

The campus background image is uploaded via multipart form to `POST /api/v1/map/schools/:id/campus-image`, stored as a file by **Multer** (server-side upload middleware), and served statically by Express from the `/uploads` directory.

---

### 3.4 Faculty — Who Teaches

**What this page does:**
The Faculty list shows every teacher in the system. For each teacher you can see:
- Their name, specialization, subject assignments.
- Their **weekly teaching load** (hours assigned vs. their cap).
- Their **sync status** — whether their record came from EnrollPro or was entered manually.
- An "active/excluded from scheduling" flag — teachers on leave, for example, can be excluded without being deleted.

You can also **sync faculty from EnrollPro** from this page, which pulls the latest roster from the EnrollPro API and updates the local mirror.

**How the sync works technically:**
ATLAS keeps a local copy of faculty data in its `FacultyMirror` table. This is the source of truth ATLAS uses for scheduling — not the live EnrollPro API — because schedule generation needs stable, consistent data during the run.

When you click **Sync**, the server calls `POST /api/v1/faculty/sync`. The faculty adapter calls EnrollPro's `/api/hr/faculty` endpoint, compares the response to the existing `FacultyMirror` records, then creates/updates/deactivates rows as needed. This is called a **upsert** pattern — insert if new, update if changed.

A "hard reset" sync variant (`POST /api/v1/faculty/sync/reset` with `confirmPrune=true`) will also remove faculty from ATLAS's mirror who are no longer in EnrollPro. This is a destructive operation and requires explicit confirmation.

The Faculty page falls back to a **cached response** if the server can't be reached, showing the last-fetched data with a "last synced X ago" notice.

---

### 3.5 Teaching Load — Assigning Teachers to Sections

**What this page does:**
Before the generator can assign teachers automatically, a Scheduling Officer must first decide *which teacher is responsible for which subject in which section*. The Teaching Load page is where this happens.

You see a grid: sections as rows, subjects as columns. Each cell shows who (if anyone) is assigned to teach that subject in that section. You can:
- Manually assign a teacher to a cell.
- Use **Auto-Fill** to let the system suggest optimal assignments based on qualifications and load caps.
- Preview the total load per teacher and see warnings when someone is approaching their 30-hour/week standard limit or 40-hour legal cap.

The page has three coverage modes:
- **Standard Faculty Load (30h)** — fills teachers up to their standard limit.
- **Hard Cap Utilization (40h)** — squeezes more from teachers, up to the legal max.
- **Hybrid Staffing** — fills real teachers first, then uses "Teacher X" placeholders for anything that can't be covered.

**How it works technically:**
Teaching assignments are stored in `FacultyAssignment` records linking a `FacultyMirror` ID, a `Subject` ID, and a section ID. The `useTeachingLoadData` hook loads all faculty, all subjects, all sections, and all current assignments in parallel via `Promise.all()`.

The **Auto-Fill** function calls `POST /api/v1/faculty-assignments/auto-fill` which runs a server-side greedy assignment algorithm: for each unassigned section-subject pair, it picks the qualified teacher with the most available capacity without exceeding their cap.

**Split-brain protection:** If ATLAS's local assignment data gets out of sync with the EnrollPro source of truth (for example, after a faculty sync), an integrity endpoint (`POST /api/v1/faculty-assignments/integrity/reconcile-split-brain`) detects and repairs the divergence. Edits are quarantined (read-only) while a conflict is detected, protecting data integrity.

---

### 3.6 Officer Preferences — Reviewing Faculty Input

**What this page does:**
Before generating, the system collects each teacher's availability preferences (see Section 4.3 for the faculty side). The Officer Preferences page is where the Scheduling Officer:
- Sees which teachers have submitted preferences, which are still in draft, and which haven't responded at all.
- Reviews each teacher's submitted time-slot preferences.
- Sends **reminders** to teachers who haven't submitted yet.
- Approves or rejects preference submissions (to handle unrealistic requests, e.g., a teacher marking every morning as unavailable).

**Why review is needed:**
Faculty preferences are *inputs* to the algorithm, not hard rules. The officer's review step ensures that the preferences going into generation are realistic and achievable. A teacher who marks every available slot as "unavailable" could cause their classes to have no valid placement.

**How it works technically:**
Faculty preference data is stored in `FacultyPreference` and `FacultyTimeSlotPreference` tables. Each slot has one of three states: `PREFERRED`, `AVAILABLE`, or `UNAVAILABLE`. The officer review sets a `ReviewStatus` field (`APPROVED`, `REJECTED`, `PENDING`) on the preference record.

When the generation algorithm scores candidate time slots for a session, it consults these preferences. A slot marked `PREFERRED` by the assigned teacher receives a bonus in the scoring function; `UNAVAILABLE` slots are avoided (treated as a soft constraint — it won't cause a hard block, but the algorithm strongly discourages placing sessions there).

The reminder feature calls `POST /api/v1/preferences/:schoolId/:schoolYearId/remind` which sends a push notification or in-system message to the faculty member.

---

### 3.7 Generating the Schedule

**What this step does:**
Once subjects, rooms, faculty assignments, and preferences are all in place, you trigger a generation run. ATLAS will attempt to place every required class session into a valid time slot in a valid room with a valid teacher.

**How to start generation:**
1. From the Dashboard, check that the setup checklist is complete (green checkmarks).
2. Navigate to **Schedule Review** (or use the "Generate" button on the dashboard).
3. In the pre-generation workspace, review the policy settings (max consecutive minutes, break windows, lunch block, etc.).
4. Click **Generate Schedule**.
5. The system runs the algorithm — typically under 60 seconds for a single school — then shows the result.

**Understanding the output:**
- **Placed sessions** — classes that were successfully assigned a slot, room, and teacher.
- **Unassigned sessions** — classes the algorithm could not place. Each one tells you *why*: no qualified faculty, no available room, all slots conflict, etc.
- **Violations summary** — a count of hard vs. soft constraint violations across the entire draft.

**How it works technically:**
The generation request hits `POST /api/v1/generation/:schoolId/:schoolYearId/runs`. A new `GenerationRun` record is created with status `IN_PROGRESS`. The server runs the scheduling algorithm in the same process (synchronously for v1) and updates the run record to `COMPLETED` or `FAILED` when done.

The algorithm is a **deterministic greedy baseline constructor**:
1. Build a demand list: every (section × subject × required-sessions) tuple.
2. Sort demands by priority (Grade 7→10, then by section ID, then subject ID). This fixed ordering ensures the same input always produces the same output — reproducible results.
3. For each demand, evaluate all (day × time-slot × room × teacher) combinations.
4. Score each candidate against all constraints: hard constraints disqualify a candidate entirely; soft constraints add penalty points.
5. Pick the candidate with the lowest total penalty score.
6. Record the placement and mark the slot/room/teacher as occupied for future iterations.

Constraint weights are configurable per school in the `SchedulingPolicy` table. Adjusting a weight (0–100 scale) changes how much the algorithm "cares" about a particular soft rule relative to others.

---

### 3.8 Schedule Review — Inspecting and Fixing the Timetable

**What this page does:**
The Schedule Review workspace is the most powerful part of ATLAS for the Scheduling Officer. It is a three-panel IDE-style layout:
- **Left panel** — Filters, violation list, section navigator. Shows all hard violations (red) and soft violations (amber) with clickable navigation to the affected session.
- **Center panel** — The full timetable grid. Days as columns, time slots as rows, sections navigable via tabs. Each cell shows subject, teacher, room, and grade color (G7=Green, G8=Yellow, G9=Red, G10=Blue).
- **Right panel** — The Manual Edit Panel. When you click a session, this shows its details and lets you reassign the time slot, room, or teacher. A real-time preview shows what violations would be introduced or resolved by the change *before* you commit it.

**Key actions:**
- **Filter by violation type** — quickly focus on "no teacher" or "double-booked room" issues.
- **Drag and drop** — drag a session card to a different slot. The system validates the move in real time.
- **Preview before commit** — every proposed change shows a diff of violations. Nothing is saved until you click "Commit."
- **Undo** — every committed change is reversible.
- **How It Works page** — a built-in explainer for the algorithm, accessible from the review workspace, in plain language.

**How it works technically:**
The Schedule Review loads the draft timetable from `GET /api/v1/generation/:schoolId/:yearId/runs/:runId/draft`. The response includes all placed entries (each with section, subject, teacher, room, day, start/end time) plus all unassigned items.

Manual edit requests go to `POST /api/v1/generation/:schoolId/:yearId/runs/:runId/edits/preview` (preview mode) and then `POST /api/v1/generation/:schoolId/:yearId/runs/:runId/edits/commit` (final save). The server re-runs constraint checks on every preview and commit to keep the violation list accurate.

**Optimistic locking** prevents two officers from editing the same run simultaneously. Every commit includes a `runVersion` number. If another user committed an edit since you loaded the page, the version numbers won't match and the server returns a `409 Conflict` response. ATLAS will tell you to reload before continuing.

The timetable grid uses **React DnD (Drag and Drop)** with sensors configured to avoid accidental drags on touch devices.

---

### 3.9 Publishing the Schedule

**What this means:**
Publishing moves the schedule from "draft under review" to "live — visible to all." Once published:
- Faculty can see their personal schedule in the `/my/schedule` page.
- Students can look up their section's schedule on the public schedule page (no login required).
- The schedule is locked from major structural edits (only exception requests like room changes are allowed post-publish).

**What you must satisfy before publish:**
- **Zero hard constraint violations** — ATLAS will not let you publish if any hard violation exists. Hard violations are absolute: a teacher in two rooms at once, a room double-booked, minimum weekly minutes not met.
- All sessions must be placed (no unassigned items).

Soft violations (warnings) do not block publication — you can publish with warnings, but they are flagged for transparency.

**How it works technically:**
The publish action calls `POST /api/v1/generation/:schoolId/:yearId/runs/:runId/publish`. The server:
1. Re-validates all hard constraints one final time (never trusts the client's claim that violations are zero).
2. If any hard violation exists, returns `422 Unprocessable Entity` with a list of violations.
3. If clean, updates `GenerationRun.status` to `PUBLISHED` and sets `GenerationRun.publishedAt`.
4. Sends push notifications to all faculty whose assigned sections appear in the schedule.

The published schedule is then exposed via the public API:
- `GET /api/v1/schools/:schoolId/schedules/published` — returns the current published schedule.
- `GET /api/v1/schools/:schoolId/schedules/published/:termId` — returns a specific term's published schedule.

These endpoints are intentionally open (no authentication required) so student-facing websites and parent portals can consume them without any credential management.

---

## 4. Faculty Walkthrough

Faculty members access a separate, simplified portal — accessed at the same URL but automatically routed to `/my/*` pages after login. The faculty portal is designed mobile-first: large touch targets, single-column layout, no data-dense tables.

### 4.1 Faculty Login

**In Plain Terms:**
Faculty log in using their **email address** (usually the one on file with HR) and a **password** set during account provisioning.

**How it works technically:**
When a faculty record is imported from EnrollPro and added to `FacultyMirror`, a corresponding `User` account is created in ATLAS's own auth table with the faculty's email and a temporary or HR-provisioned password. The password is stored as a **bcrypt hash** — never in plain text. On login, the entered password is hashed and compared to the stored hash.

After login, the JWT issued to faculty carries a `role: TEACHER` claim. The AppShell reads this claim and redirects to `/my/dashboard` instead of the admin dashboard. Route guards (`isFacultyPortalRoute()`) ensure faculty cannot access scheduling officer pages.

---

### 4.2 My Dashboard — Overview at a Glance

**What faculty see here:**
- The current **phase message** — e.g., "Preferences are open — please submit your availability by Friday."
- A **preview of their schedule** (if a draft or published schedule exists for their sections).
- Their **teaching assignments** — which subjects and sections they have been assigned.
- Quick links to submit preferences and view their full schedule.

**How it works technically:**
The My Dashboard calls `GET /api/v1/faculty-portal/my/dashboard` which is a composite endpoint — one request that returns all the data the dashboard needs:
- The current schedule phase (`SETUP`, `PREFERENCE_COLLECTION`, `GENERATION`, `REVIEW`, `PUBLISHED`).
- A `runContext` object describing the current draft run (if any).
- A schedule preview (the faculty member's sessions from the most recent run).
- Teaching assignment identities (section + subject list).
- A `fallbackBanner` flag that tells the UI whether to show an "Offline / Cached data" notice.

The endpoint always returns a response even when some sub-queries fail, so the dashboard degrades gracefully rather than showing a full error page.

---

### 4.3 My Preferences — Telling the System When You're Available

**What this page does:**
This is where teachers tell the system which time slots they prefer, which they're available for but don't prefer, and which they absolutely cannot teach. The schedule algorithm will strongly try to respect these — it's not a guarantee, but preferences significantly influence placement.

**The time slot grid:**
- Rows = time periods (e.g., 7:00–8:00, 8:00–9:00, etc.)
- Columns = days of the week (Monday–Friday)
- Each cell = one of three states:
  - ⭐ **Preferred** (the algorithm gives this slot a bonus score)
  - ✓ **Available** (neutral — the algorithm will use this)
  - ✗ **Unavailable** (the algorithm avoids this; faculty should use sparingly and explain why)

**Wellbeing flags** are also on this page: pregnancy support, physical ailment support, minimize travel time, avoid upper floors. These are soft signals that influence room assignment.

**How it works technically:**
The preferences page stores data in `FacultyPreference` (one record per faculty per school year) and related `FacultyTimeSlotPreference` rows. The page uses an **offline-aware save pattern**:
1. When you click Save, the data is first written to `localStorage` as a JSON snapshot (key: `atlas:faculty-offline:v1:preferences:...`).
2. Then an API request is made to `PUT /api/v1/preferences/:schoolId/:schoolYearId/my`.
3. If the request succeeds, the local snapshot is marked as in-sync.
4. If the request fails (offline), the local snapshot is retained. When connectivity returns, the page shows a "You have unsaved local changes — would you like to sync?" prompt and retries the save.

The page detects offline status through two signals: `navigator.onLine` (browser API) and whether the Axios error has no `response` object (which means the request never reached the server, not that the server returned an error). This distinction is critical — a 400 error from the server means the data is bad; a network error means the user is offline.

---

### 4.4 My Room Preferences — Mobility and Wellness Needs

**What this page does:**
Beyond time slots, faculty can indicate room preferences:
- Prefer ground-floor classrooms (mobility support).
- Prefer to minimize building-to-building travel (all classes in one building if possible).
- Avoid specific building types (e.g., older buildings if a physical ailment is involved).

**How it works technically:**
Room preferences are stored in `FacultyRoomPreference` records linked to the faculty member and school year. During generation, the room-scoring function checks these flags before assigning a room to a session. Like time slot preferences, room preferences are soft constraints — they guide the algorithm but don't block placement.

The My Room Preferences page uses the same **offline-first save pattern** as My Preferences: localStorage snapshot first, then API sync, with a stale-data banner if the cached version is older than 24 hours.

---

### 4.5 My Schedule — Your Published Timetable

**What faculty see here:**
Once a schedule is published, this page shows the faculty member's complete weekly timetable:
- Grouped by day (Monday through Friday).
- Each entry shows: subject name, section name, room name and floor, time range.
- Color-coded by grade level (G7=Green, G8=Yellow, G9=Red, G10=Blue).

**How it works technically:**
The My Schedule page calls `GET /api/v1/schools/:schoolId/schedules/published` filtered to the faculty member's identity (derived from their JWT token). The server returns only entries where `facultyId` matches the authenticated user's faculty mirror ID.

**Offline behavior:** The schedule data is cached to `localStorage` immediately after a successful load (key: `atlas:faculty-offline:v1:schedule:...`). If the faculty member opens the page while offline, the cached schedule is displayed with a yellow "Offline — showing last saved schedule" banner. The cache maximum age is 24 hours; after that, it's shown as stale with a reminder to reconnect and refresh.

---

## 5. Public / Student Schedule View

**What this is:**
Students and parents can look up any section's published schedule without logging in. The URL is public.

**How to use it:**
1. Navigate to `/schedule` (or the school's public schedule link).
2. Select the grade and section from the dropdowns.
3. The weekly timetable for that section appears — subject, teacher name, room, time.
4. You can also search by teacher name to find all classes a specific teacher handles.

**How it works technically:**
The public schedule page calls `GET /api/v1/schools/:schoolId/schedules/published`. This endpoint is intentionally unauthenticated — no JWT required — because it only returns `PUBLISHED` schedules. Draft schedules, review-state runs, and any other non-published data are never exposed by this endpoint.

The public schedule cache works identically to the faculty schedule cache: `localStorage` with a 24-hour max age. A student who has previously looked up their schedule will see the cached version if they visit again without internet.

---

## 6. Offline Fallback — How the System Works Without Internet

### In Plain Terms
ATLAS is built as a **Progressive Web App (PWA)** — a type of website that behaves more like an installed app. One of PWA's biggest features is the ability to work (at least partially) without an internet connection.

Think of it like this: every time you successfully load data, ATLAS quietly saves a copy in your browser's private storage. If you lose internet access later, ATLAS shows you that saved copy instead of a blank error screen. It's like having a local photocopy of important documents in case the printer is offline.

### What Works Offline

| Feature | Offline Behavior |
|---|---|
| App shell (navigation, layout) | Always available — loaded from service worker cache |
| Faculty: My Preferences | Shows last submitted preferences (up to 24h old) |
| Faculty: My Schedule | Shows last loaded published schedule (up to 24h old) |
| Faculty: My Dashboard | Shows last snapshot with "cached data" banner |
| Public schedule lookup | Shows last loaded section schedule (up to 24h old) |
| Scheduling Officer pages | Read-only; most data shows from session cache |

### What Requires Internet

- Submitting preference changes (saves locally first, syncs on reconnect).
- Triggering a new schedule generation run.
- Publishing a schedule.
- Viewing up-to-the-minute violation counts or live edits.

### The Technical Implementation

ATLAS uses two layers of offline support:

**Layer 1 — Service Worker (`/public/sw.js`)**

A Service Worker is a JavaScript file that runs in the background, separate from the page. ATLAS registers one at startup:

```javascript
// main.tsx
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
```

The service worker uses two caching strategies:
- **Cache-First** for static assets (app shell HTML, JavaScript bundles, icons, CSS): on first visit, these are downloaded and stored. On subsequent visits — including offline — the cached version is served instantly without hitting the network.
- **Network-First with timeout** for API calls matching specific faculty patterns (preferences, schedule, dashboard): the service worker tries the network first (with a 5-second timeout). If the network fails, it serves the last cached API response. This is why the dashboard still loads after 10 seconds offline — you're seeing the service worker's cached copy.

The shell assets (`/`, `/index.html`, `/manifest.webmanifest`, icons) are pre-cached during the service worker `install` event, so the app can start even with no network.

**Layer 2 — localStorage Snapshots (application level)**

On top of the service worker, individual pages write their own snapshots to `localStorage` using a consistent pattern:

```typescript
// faculty-offline-cache.ts
writeFacultySnapshot(cacheKey, responseData);  // writes { cachedAt: "2026-05-28T...", data: {...} }
const snapshot = readFacultySnapshot(cacheKey, { maxAgeMs: 24 * 60 * 60 * 1000 });
if (snapshot?.stale) { showStaleBanner(); }
```

The `cachedAt` timestamp is compared to `Date.now()` to determine if data is fresh or stale. Stale data is shown with a visible warning banner, never silently.

**How offline detection works:**
```typescript
// faculty-offline-cache.ts
export function isLikelyOfflineError(error: unknown): boolean {
  if (!navigator.onLine) return true;         // browser says offline
  if (candidate.response) return false;       // server replied → not offline, it's an API error
  if (candidate.code === 'ERR_NETWORK') return true;  // axios network error
  if (/network|failed to fetch|timeout/i.test(message)) return true;
}
```

The key insight: if the server returned *any* response (even a 500 error), you're online but there's a bug. If no response exists at all, you're offline. ATLAS handles these two cases differently — offline shows cached data; server errors show error messages.

**PWA Install Manifest:**
```html
<!-- index.html -->
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#0f172a" />
```

This makes ATLAS installable as a home-screen app on Android and iOS — when installed, it opens in a standalone window without browser chrome, just like a native app.

---

## 7. The Schedule Lifecycle — State by State

Every schedule in ATLAS moves through a fixed sequence of states. You cannot skip steps.

```
SETUP → PREFERENCE_COLLECTION → GENERATION → REVIEW → PUBLISHED → ARCHIVED
```

| State | Who Acts | What Happens |
|---|---|---|
| **SETUP** | Scheduling Officer | Configure subjects, import faculty, build the campus map, set policies. |
| **PREFERENCE_COLLECTION** | Faculty + Officer | Faculty submit time/room preferences. Officer reviews and approves. |
| **GENERATION** | System | Algorithm runs and produces a draft timetable. |
| **REVIEW** | Scheduling Officer | Officer inspects violations, makes manual edits, resolves conflicts. |
| **PUBLISHED** | Scheduling Officer | Zero hard violations confirmed; schedule goes live to faculty and public. |
| **ARCHIVED** | System (automatic) | End of school year; schedule is moved to historical storage. |

**Why enforce this order?**
Attempting to generate before subjects and rooms are configured would produce an empty or nonsensical schedule. Collecting preferences before generation triggers pushes teachers to provide input at the right time. Publishing before zero hard violations are achieved would expose an illegal schedule to students and parents. Each gate exists to prevent real operational mistakes.

---

## 8. Hard vs. Soft Constraints — Why Some Edits Are Blocked

### Hard Constraints (Red)
These are absolute rules. Violating them produces a schedule that is physically or legally impossible.

Examples:
- A teacher cannot be in two rooms at the same time.
- A room cannot hold two classes simultaneously.
- A section cannot have two subjects in the same slot.
- Minimum required weekly minutes per subject not met.

**Effect:** Hard violations block publication. Manual edits that would introduce a new hard violation are refused by the system with an explanation.

### Soft Constraints (Amber / Warning)
These are strong preferences but can bend when necessary.

Examples:
- A teacher teaching more than 3 consecutive hours without a break.
- A session placed in a slot the teacher marked as "Unavailable."
- A class placed in a room that is further from the section's home room than the policy allows.
- A teacher's assigned load exceeds their standard 30-hour weekly target (but is under the 40-hour legal cap).

**Effect:** Soft violations appear as warnings. You can still publish with soft violations, but they are visible to the officer as yellow items in the violation list.

### How Constraint Weights Work
Each soft constraint has a weight from 0 to 100 in the `SchedulingPolicy`. A higher weight means the algorithm will try harder to avoid that violation, even at the cost of a worse placement for a lower-weighted constraint. This lets you tune the algorithm's priorities: if teacher wellness (avoiding unavailable slots) matters more than room proximity, increase the weight of the preference adherence constraint relative to the travel distance constraint.

---

## 9. Troubleshooting Common Situations

| Situation | What to Check | Technical Cause |
|---|---|---|
| "Generation produced many unassigned sessions" | Are all subjects assigned to a qualified teacher in Teaching Load? Are rooms of the required type available? | Greedy algorithm exhausted all valid candidates for those demands. Add faculty assignments or rooms, then regenerate. |
| "Faculty roster is outdated" | Click Sync on the Faculty page. | `FacultyMirror` is stale; EnrollPro sync has not run recently. |
| "My schedule shows cached data (offline banner)" | Connect to the internet and refresh the page. | `localStorage` snapshot is being served by the offline fallback. |
| "Publish button is disabled" | Check the violations list for any red (hard) items; resolve all of them first. | Hard constraint violations detected; `POST /runs/:id/publish` will reject until clean. |
| "I made edits but got a 'version conflict' error" | Reload the page to get the latest draft, then reapply your changes. | Optimistic locking caught a concurrent edit. Another user committed a change between your load and your commit. |
| "Faculty can't log in" | Ensure the faculty record was imported and a user account was created. Check the email matches the account. | `User` record may not have been created during faculty sync, or the email is mismatched. |
| "Section data is missing / no sections listed" | Trigger an EnrollPro section sync from the admin panel. | `ExternalSection` records from EnrollPro have not been pulled for the current school year. |
| "Subject appears in generation but wasn't configured" | Check the Subjects page for auto-seeded subjects vs. manually configured ones. | `reconcileSubjectContractFromUpstream()` may have re-seeded a default subject that was deleted. |

---

*Document maintained by the ATLAS development team.*  
*Last updated: 2026-05-28*
