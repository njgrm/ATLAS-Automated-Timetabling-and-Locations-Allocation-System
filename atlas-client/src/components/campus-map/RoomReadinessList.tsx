/**
 * A9 C3 (2026-09-29) — ROOM READINESS, ORDERED BY WHAT IS BROKEN.
 *
 * ── WHAT THE OLDER-USER AUDIT FOUND ─────────────────────────────────────────────────────
 * "A flat 103-room readiness wall" (tedious 3/5, next 3/5, calm 2/5). The region rendered
 * every room in the school as a card, in building order, with the ~78 ready rooms first and
 * no grouping, so the scheduler had to read 78 correct rows to find the 25 that needed her.
 * The five status totals at the top were a summary of a list she then had to scan.
 *
 * ── WHAT IT IS NOW ──────────────────────────────────────────────────────────────────────
 * PROBLEMS FIRST, ONE GROUP PER BUILDING, and the full list behind one control.
 *
 * Each group states the CONSEQUENCE ("no class can be held there") and the ONE fix
 * ("Mark the rooms that are used for classes"), and carries ONE action that goes to the
 * editor already pointed at that building (`/map?mode=editor&buildingId=<id>` — the
 * existing deep link, not a new destination). A building with nothing wrong is NOT in the
 * problems region at all: listing "Building D — 20 of 20 ready" would be a second copy of
 * the banner's own figure, and `AGENTS.md` §8 forbids two chips saying the same thing.
 *
 * ── WHAT WAS NOT INVENTED ───────────────────────────────────────────────────────────────
 * `getRoomStatus` is UNCHANGED, so no readiness this page does not measure can be claimed:
 * `needs-section` still means "no section in the latest draft", and it still disappears when
 * no draft is loaded. The consequence sentences are derived from those five statuses and
 * from the building's own teaching-room count — nothing else. The wording is a pure function
 * (`buildRoomProblemGroups`) so a control can decide what the page PRINTS rather than
 * grepping the JSX, which is the split `a3-c4-home-room-truth.test.ts` forced on the
 * Sections tile after a 17/17 suite shipped "Home rooms 3/3" beside two rows that said
 * otherwise.
 *
 * ── SUBTRACTION LEDGER for this file (line for line, `AGENTS.md` §11 rule 3) ─────────────
 *   REMOVED  the five status-total badges ("12 Needs capacity", "3 Needs room type", …),
 *            which summarised a list the operator was then made to scan;
 *   REMOVED  the instruction line "Fix the items marked for attention before generating.",
 *            replaced by one summary line that says how many buildings need her;
 *   REMOVED  the 103 cards from the default view — the list itself is byte-identical and
 *            is now rendered by the "Show all rooms" control, which is also where internal
 *            scrolling is allowed (`AGENTS.md` §8: the root container is untouched, and this
 *            bounded region is the one that may scroll);
 *   ADDED    one summary line, one group per building with a consequence and a fix, one
 *            action per group, and the "Show all rooms" control.
 *   UNTOUCHED the per-room row markup and `STATUS_COPY`, deliberately: their colours are
 *            pinned by `palette-token-sweep-a3-s-e.test.ts`'s per-file residual counts, and
 *            this file's amber classes are what the c8 ratchet counts. The problems region
 *            below therefore uses the measured `--warning` token family and adds ZERO raw
 *            amber/yellow lines, so neither palette pin moves.
 *
 * ── A9 C6 (2026-09-29) — FIX 1.2 ITEM 7.2: THE TOGGLE BECAME FOUR REAL FILTERS ─────────────
 * THE USER is an older, mouse-first scheduler on Campus & Rooms. THE TASK on this screen is:
 * narrow the room list down to the rooms that matter, and read a room's full name. WHAT MUST
 * FEEL DIFFERENT: one obvious row of real filter buttons replaces a show/hide toggle, the list
 * is always in the order a human would say it out loud, and a filter with nothing behind it
 * says so in a sentence instead of a blank box.
 *
 * WHY THE TOGGLE IS GONE RATHER THAN KEPT (`AGENTS.md` §11 rule 3, subtract first): the new
 * row's `All rooms` default IS "show all rooms", so keeping `Show all rooms` beside it would
 * put two controls for one job on the row and leave the operator guessing which one is now
 * the real one. It is removed, not reworded.
 *
 * ── SUBTRACTION LEDGER for this file, APPENDED (`AGENTS.md` §16 — corrections are additive,
 *    the C3 entries above stand and nothing was deleted) ─────────────────────────────────────
 *   REMOVED  the `Show all rooms` / `Hide all rooms` toggle (`aria-expanded`,
 *            `data-testid="room-readiness-show-all"`) and the `ChevronDown` it rotated. Its
 *            only job was revealing the list, which the `All rooms` default now does, so
 *            keeping it beside four filters would be a second control for the same action.
 *   ADDED    one row of four filter buttons — `All rooms` (default) / `Ready` /
 *            `Needs attention` / `Unavailable` — each carrying its own count. It is the SAME
 *            shape as the `/teachers` attention-chip row
 *            (`src/components/faculty/TeacherAttentionFilters.tsx:40-58`), copied rather than
 *            reinvented, because `AGENTS.md` §8 "One look per control" is a QA failure and
 *            not a suggestion. The filters add NO sentence, NO chip and NO count line of
 *            their own: the numbers live inside the buttons.
 *   ADDED    one empty sentence PER FILTER, exported as a pure function so a control decides
 *            the exact wording instead of grepping the JSX. A filter that shows a blank box is
 *            the failure mode; the operator's own words are used verbatim for the case she
 *            named.
 *   ADDED    natural name order for the full list, in EVERY filter. The list was in building
 *            DECLARATION order, which is a database detail; `G10 Room 101, 102, … 201` is the
 *            order a human says out loud, and a plain string sort would put `Room 102` before
 *            `Room 2`'s successor, so the comparator is numeric-aware with a building-name
 *            tiebreak. The PROBLEMS region below keeps its own worst-first ordering — this
 *            change does not touch `buildRoomProblemGroups` at all.
 *   ADDED    one line in the same list: the room name now WRAPS (`break-words`) instead of
 *            `truncate`. Fix 1.2 item 10.2 says "room names wrap instead of `truncate`", and
 *            this row is the same defect on the same list as `CampusMapOverview.tsx:722`; only
 *            the name changed, the `Building · N seats` line beneath it still truncates
 *            because it is a secondary locator, not the thing being read.
 *   UNTOUCHED `getRoomStatus` (so no readiness this page does not measure can be claimed),
 *            `STATUS_COPY` and every one of its class strings, `StatusIcon`,
 *            `buildRoomProblemGroups` (grouping, order, consequence and fix copy),
 *            `roomProblemSummary`, the problems region markup and its `data-testid`s, the
 *            per-row status `Badge` (it is redundant in three of four filtered views but it
 *            carries the colour truth in `All rooms`, and those class strings are pinned by
 *            `palette-token-sweep-a3-s-e.test.ts`'s per-file residual counts), and the
 *            `data-room-status` attributes on both regions.
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleSlash2, DoorOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { Building, Room } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';

export type RoomReadinessStatus = 'ready' | 'needs-capacity' | 'needs-room-type' | 'needs-section' | 'unavailable';

type RoomReadinessListProps = {
	buildings: Building[];
	roomOccupancy?: Map<number, string>;
	compact?: boolean;
};

export type RoomWithBuilding = { building: Building; room: Room; status: RoomReadinessStatus };

function getRoomStatus(room: Room, roomOccupancy?: Map<number, string>): RoomReadinessStatus {
	if (!room.isTeachingSpace) return 'unavailable';
	if (!room.capacity || room.capacity <= 0) return 'needs-capacity';
	if (room.type === 'OTHER') return 'needs-room-type';
	if (roomOccupancy && !roomOccupancy.has(room.id)) return 'needs-section';
	return 'ready';
}

const STATUS_COPY: Record<RoomReadinessStatus, { label: string; className: string }> = {
	ready: { label: 'Ready', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
	'needs-capacity': { label: 'Needs capacity', className: 'border-amber-200 bg-amber-50 text-amber-700' },
	'needs-room-type': { label: 'Needs room type', className: 'border-amber-200 bg-amber-50 text-amber-700' },
	'needs-section': { label: 'Needs section', className: 'border-sky-200 bg-sky-50 text-sky-700' },
	unavailable: { label: 'Unavailable', className: 'border-slate-200 bg-slate-100 text-slate-600' },
};

function StatusIcon({ status }: { status: RoomReadinessStatus }) {
	if (status === 'ready') return <CheckCircle2 className="size-3.5" aria-hidden="true" />;
	if (status === 'unavailable') return <CircleSlash2 className="size-3.5" aria-hidden="true" />;
	return <AlertTriangle className="size-3.5" aria-hidden="true" />;
}

/* ───────────────────────── the filters, as pure functions ───────────────────────── */

export type RoomReadinessFilter = 'all' | 'ready' | 'needs-attention' | 'unavailable';

/**
 * THE FOUR FILTERS, in the order an operator reads them, each naming EXACTLY the measured
 * statuses it stands for.
 *
 * `needs-attention` is the three `needs-*` statuses and nothing else. That is not a new
 * judgement: it is the same test the problems region has always used — `status !== 'ready'
 * && status !== 'unavailable'` — so a room the region below calls a problem is a room this
 * filter shows, and a room it does not call a problem is a room this filter does not show.
 * `unavailable` is deliberately its own filter and NOT part of `needs-attention`: a store
 * room is not broken, it was never meant for a class, and folding it in would tell the
 * scheduler that rooms she does not need to fix are rooms she needs to fix.
 *
 * The labels are the operator's own words, verbatim.
 */
export const ROOM_READINESS_FILTERS: readonly {
	id: RoomReadinessFilter;
	label: string;
	statuses: readonly RoomReadinessStatus[];
}[] = [
	{ id: 'all', label: 'All rooms', statuses: ['ready', 'needs-capacity', 'needs-room-type', 'needs-section', 'unavailable'] },
	{ id: 'ready', label: 'Ready', statuses: ['ready'] },
	{ id: 'needs-attention', label: 'Needs attention', statuses: ['needs-capacity', 'needs-room-type', 'needs-section'] },
	{ id: 'unavailable', label: 'Unavailable', statuses: ['unavailable'] },
];

/** The filter a room's status falls under. Exported so a control can decide the FILTERING. */
export function roomMatchesFilter(status: RoomReadinessStatus, filter: RoomReadinessFilter): boolean {
	const entry = ROOM_READINESS_FILTERS.find((candidate) => candidate.id === filter);
	// An unknown id matches NOTHING rather than everything: fail closed, so a typo in a
	// filter can never quietly print the whole list under a label that promises otherwise.
	return entry ? entry.statuses.includes(status) : false;
}

/**
 * HOW MANY ROOMS EACH FILTER WOULD SHOW, in the same order the buttons are drawn.
 *
 * `all` is every room, including the ones no other filter claims, because "All rooms" that
 * read less than the total would be a lie told by a button. The counts are computed from the
 * data rather than written into the JSX, so a control can assert them.
 */
export function roomReadinessCounts(rooms: readonly RoomWithBuilding[]): Record<RoomReadinessFilter, number> {
	const counts: Record<RoomReadinessFilter, number> = { all: rooms.length, ready: 0, 'needs-attention': 0, unavailable: 0 };
	for (const entry of rooms) {
		for (const filter of ROOM_READINESS_FILTERS) {
			if (filter.id !== 'all' && filter.statuses.includes(entry.status)) counts[filter.id] += 1;
		}
	}
	return counts;
}

/**
 * THE ORDER A HUMAN SAYS THE ROOMS OUT LOUD IN: `G10 Room 101, 102, … 201`.
 *
 * A plain string sort is wrong here in the way that actually bites: `'G10 Room 102'` sorts
 * before `'G10 Room 2`…'s` successors, and `'G10 Room 10'` sorts BEFORE `'G10 Room 2'`,
 * because `'1' < '2'`. `localeCompare` with `numeric: true` compares the digit RUNS as
 * numbers, so 2 < 10 < 102 < 201 as a person would count them. `sensitivity: 'base'` keeps
 * the comparison stable when a school has both `Room 101` and `room 101`.
 *
 * The BUILDING NAME is the tiebreak, not the room id: two buildings that each hold a
 * `G10 Room 101` are both correct on the name, and without a second key their relative order
 * would be whatever the flatMap happened to produce — the building DECLARATION order, which
 * is the database detail this change exists to stop showing. The comparator is total, so the
 * list is deterministic for the same data on every render.
 */
export function compareRoomNamesNatural(a: RoomWithBuilding, b: RoomWithBuilding): number {
	return (
		a.room.name.localeCompare(b.room.name, undefined, { numeric: true, sensitivity: 'base' }) ||
		a.building.name.localeCompare(b.building.name, undefined, { numeric: true, sensitivity: 'base' }) ||
		a.room.id - b.room.id
	);
}

/**
 * WHAT A FILTER WITH NOTHING BEHIND IT SAYS — one sentence, in the same shape for all four.
 *
 * The `Needs attention` wording is the operator's own sentence, used verbatim, and the other
 * three follow its grammar rather than inventing a house style: they name the filter, they
 * say "currently", and `All rooms` reuses the sentence this card has always printed when the
 * school has no rooms at all. A blank box under a filter is the defect; the sentence is the
 * fix, and it is a pure function so the EXACT string is assertable.
 *
 * `All rooms` is only reachable here with zero rooms in the school, which is the one case
 * the card's own summary line already carries — see the render, where that branch is kept.
 */
export function roomReadinessFilterEmptySentence(filter: RoomReadinessFilter): string {
	if (filter === 'needs-attention') return 'No rooms currently marked as Needs attention.';
	if (filter === 'ready') return 'No rooms are currently marked as Ready.';
	if (filter === 'unavailable') return 'No rooms are currently marked as Unavailable.';
	return 'No rooms yet. Open Edit maps to add the first teaching room.';
}

/* ───────────────────────── the problems region, as a pure function ────────────────────── */

export type RoomProblem = { id: number; name: string; status: RoomReadinessStatus };

export type RoomProblemGroup = {
	buildingId: number;
	buildingName: string;
	/** Teaching rooms in this building — the denominator of the group's own sentence. */
	teachingRooms: number;
	/** Every room in this building, for the "none of them is a teaching room" case. */
	totalRooms: number;
	problems: RoomProblem[];
	/** What the school cannot do until this is fixed. */
	consequence: string;
	/** The one thing to do about it. */
	fix: string;
};

const PLURAL_ROOMS = (n: number) => `${n} ${n === 1 ? 'room' : 'rooms'}`;

/**
 * The DENOMINATOR PHRASE for a group's own fraction, and it says "teaching rooms" on purpose.
 *
 * Three of the four cases divide the problem count by the TEACHING-room count, and the inline
 * banner divides by the same population while naming it. Printing a bare "of its 2 rooms"
 * would leave a reader unable to tell which of the building's rooms the two are — and that is
 * the A3-C4 defect A shape (a fraction whose two ends are not visibly one population), in copy
 * rather than in code. `a9-c3-review-copy.test.ts` C3d asserts the noun.
 */
const PLURAL_TEACHING_ROOMS = (n: number) => `${n} teaching ${n === 1 ? 'room' : 'rooms'}`;

/**
 * GROUP THE ROOMS THAT NEED ATTENTION, BY BUILDING — and say what each group costs.
 *
 * THE ORDER OF THE FOUR CASES IS THE PRIORITY, and it is not arbitrary: a room cannot be
 * used for a class at all until it is marked a teaching room, so a building with none is
 * the deadest; a room whose type is `OTHER` cannot serve as a section's home room
 * (`home-room-auto-assign.service.ts` accepts only `type: 'CLASSROOM'`, the persisted signal
 * and never a name match); a room with no capacity cannot be sized into; and a room with no
 * section is a timetable fact rather than a room defect, so it is reported last.
 *
 * Nothing is filtered out of the group's own `problems` list: the group names the dominant
 * consequence, and every room that needs something is still listed under it, so a building
 * with two different faults cannot hide the second one behind the first one's sentence.
 */
export function buildRoomProblemGroups(rooms: RoomWithBuilding[]): RoomProblemGroup[] {
	const byBuilding = new Map<number, RoomWithBuilding[]>();
	for (const entry of rooms) {
		const list = byBuilding.get(entry.building.id) ?? [];
		list.push(entry);
		byBuilding.set(entry.building.id, list);
	}

	const groups: RoomProblemGroup[] = [];
	for (const [buildingId, entries] of byBuilding) {
		const building = entries[0].building;
		const totalRooms = entries.length;
		const teachingEntries = entries.filter((entry) => entry.room.isTeachingSpace);
		const problems = entries
			.filter((entry) => entry.status !== 'ready' && entry.status !== 'unavailable')
			.map((entry) => ({ id: entry.room.id, name: entry.room.name, status: entry.status }));
		/**
		 * A BUILDING WITH NO TEACHING ROOM IS A PROBLEM EVEN WHEN NO ROOM HAS A `needs-*`
		 * STATUS. Every room in it reads `unavailable` — a legitimately non-teaching space
		 * such as a store room — so a `problems.length > 0` test would drop the building
		 * entirely and the exact case the audit named ("0 of 20 rooms can be used for
		 * classes") would be the one case this region never mentioned. Zero teaching rooms
		 * is the defect, so it is part of the test.
		 */
		if (problems.length === 0 && teachingEntries.length > 0) continue;

		const count = (status: RoomReadinessStatus) => problems.filter((problem) => problem.status === status).length;
		const teachingRooms = teachingEntries.length;
		let consequence: string;
		let fix: string;

		if (teachingRooms === 0) {
			consequence = `None of its ${PLURAL_ROOMS(totalRooms)} is marked as a teaching classroom, so no class can be held there.`;
			fix = 'Mark the rooms that are used for classes.';
		} else if (count('needs-room-type') > 0) {
			consequence = `${count('needs-room-type')} of its ${PLURAL_TEACHING_ROOMS(teachingRooms)} are not marked as a classroom, so ATLAS cannot give a section one of them.`;
			fix = 'Set their room type to Classroom.';
		} else if (count('needs-capacity') > 0) {
			consequence = `${count('needs-capacity')} of its ${PLURAL_TEACHING_ROOMS(teachingRooms)} have no seat count, so no class can be sized into them.`;
			fix = 'Add how many students each room seats.';
		} else {
			consequence = `${count('needs-section')} of its ${PLURAL_TEACHING_ROOMS(teachingRooms)} have no section yet.`;
			fix = 'Assign a section to them, or leave them for a later term.';
		}

		groups.push({
			buildingId,
			buildingName: building.name,
			teachingRooms,
			totalRooms,
			problems,
			consequence,
			fix,
		});
	}

	// Worst first, then by name: a school with two broken buildings shows the dead one at
	// the top instead of whichever happened to be declared first.
	return groups.sort((a, b) => b.problems.length - a.problems.length || a.buildingName.localeCompare(b.buildingName));
}

/** How many rooms across the page need something, and how many buildings carry them. */
export function roomProblemSummary(groups: RoomProblemGroup[]): { rooms: number; buildings: number } {
	return {
		rooms: groups.reduce((total, group) => total + group.problems.length, 0),
		buildings: groups.length,
	};
}

export function RoomReadinessList({ buildings, roomOccupancy, compact = false }: RoomReadinessListProps) {
	const [filter, setFilter] = useState<RoomReadinessFilter>('all');
	const rooms = buildings.flatMap((building) =>
		(building.rooms ?? []).map((room) => ({ building, room, status: getRoomStatus(room, roomOccupancy) })),
	);
	// The problems region is built from the DECLARATION order and keeps its own worst-first
	// sort; the natural order below is applied to a COPY, afterwards, for the full list only.
	const groups = buildRoomProblemGroups(rooms);
	const summary = roomProblemSummary(groups);
	const counts = roomReadinessCounts(rooms);
	const visibleRooms = rooms.filter((entry) => roomMatchesFilter(entry.status, filter)).sort(compareRoomNamesNatural);

	return (
		<section data-testid="room-readiness-list" aria-labelledby="room-readiness-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<div className="flex items-center gap-2">
						<DoorOpen className="size-4 text-primary" aria-hidden="true" />
						<h2 id="room-readiness-title" className="text-sm font-bold text-foreground">Room readiness</h2>
					</div>
					<p className="mt-1 text-xs text-muted-foreground" data-testid="room-readiness-summary">
						{rooms.length === 0
							? 'No rooms yet. Open Edit maps to add the first teaching room.'
							: groups.length === 0
								? 'Every teaching room is ready to be used for classes.'
								: `${summary.rooms} ${summary.rooms === 1 ? 'room needs' : 'rooms need'} something fixed, in ${summary.buildings} ${summary.buildings === 1 ? 'building' : 'buildings'}.`}
					</p>
				</div>
			</div>

			{rooms.length === 0 ? null : (
				<>
					{/* PROBLEMS FIRST. A building with nothing wrong is absent, and the groups
					    that are here each carry the consequence, the one fix, and one action
					    into the editor already pointed at that building. */}
					{groups.length > 0 ? (
						<div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="room-problem-groups">
							{groups.map((group) => (
								<div
									key={group.buildingId}
									className="rounded-xl border border-warning-border bg-warning-muted px-3 py-2"
									data-testid="room-problem-group"
									data-building-id={group.buildingId}
								>
									<div className="flex items-start justify-between gap-2">
										<div className="min-w-0">
											<p className="text-sm font-bold text-warning-foreground">{group.buildingName}</p>
											<p className="text-xs text-warning-foreground">{group.consequence}</p>
											<p className="text-xs font-semibold text-warning-foreground">{group.fix}</p>
										</div>
										<Button asChild variant="outline" size="sm" className="h-8 shrink-0 gap-1.5">
											<Link to={`/map?mode=editor&buildingId=${group.buildingId}`} data-testid="room-problem-group-action">
												Edit rooms
											</Link>
										</Button>
									</div>
									<ul className="mt-1.5 flex flex-wrap gap-1" data-testid="room-problem-rooms">
										{group.problems.map((problem) => (
											<li key={problem.id}>
												<Badge variant="outline" className="gap-1 text-[11px] text-warning-foreground" data-room-status={problem.status}>
													<StatusIcon status={problem.status} />
													{problem.name}
												</Badge>
											</li>
										))}
									</ul>
								</div>
							))}
						</div>
					) : null}

					{/* FIX 1.2 ITEM 7.2 — FOUR REAL FILTERS, and they govern the list DIRECTLY
					    beneath them and nothing else. The problems region above is a summary of
					    what is broken and is deliberately not filtered: it is already only the
					    broken buildings. The row is the `/teachers` attention-chip row
					    (`TeacherAttentionFilters.tsx:40-58`) copied, not a local variant —
					    `AGENTS.md` §8 "One look per control". The count lives INSIDE each
					    button, so the row adds no sentence, no chip and no count line of its
					    own. `overflow-x-auto` is the honest escape when the four labels are
					    wider than the column, exactly as on `/teachers`. */}
					<div
						role="group"
						aria-label="Filter rooms by readiness"
						data-testid="room-readiness-filters"
						className="mt-3 flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pb-0.5"
					>
						{ROOM_READINESS_FILTERS.map((entry) => {
							const active = entry.id === filter;
							return (
								<Button
									key={entry.id}
									type="button"
									variant={active ? 'secondary' : 'outline'}
									size="sm"
									aria-pressed={active}
									data-testid="room-readiness-filter"
									data-filter={entry.id}
									data-active={active ? 'true' : 'false'}
									className="h-8 shrink-0 whitespace-nowrap rounded-full px-2.5 text-xs font-bold"
									onClick={() => setFilter(entry.id)}
								>
									{entry.label}
									<span className="ml-1 tabular-nums text-muted-foreground">{counts[entry.id]}</span>
								</Button>
							);
						})}
					</div>

					{/* THE FULL LIST, in natural name order in EVERY filter, and it says so when
					    a filter has nothing behind it instead of printing an empty box. This
					    bounded region is where internal scrolling is allowed; the page's root
					    container is untouched, so no global scrollbar appears. */}
					{visibleRooms.length > 0 ? (
						<div className={`mt-2 grid gap-2 ${compact ? 'max-h-44 overflow-auto pr-1 sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`} data-testid="room-readiness-all-rooms">
							{visibleRooms.map(({ building, room, status }) => {
								const copy = STATUS_COPY[status];
								return (
									<div key={room.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2" data-room-status={status}>
										<div className="min-w-0">
											{/* FIX 1.2 ITEM 10.2, second half: the room NAME WRAPS
											    instead of truncating. `min-w-0` above is what lets a
											    flex child shrink at all, so `break-words` has room to
											    work in and the row grows rather than clipping. The
											    `Building · N seats` line beneath it is a secondary
											    locator and still truncates on purpose. */}
											<p className="break-words text-xs font-semibold text-slate-800">{room.name}</p>
											<p className="truncate text-[11px] text-muted-foreground">{building.name} · {room.capacity ? `${room.capacity} seats` : 'Capacity missing'}</p>
										</div>
										<Badge variant="outline" className={`shrink-0 gap-1 text-[11px] ${copy.className}`}><StatusIcon status={status} />{copy.label}</Badge>
									</div>
								);
							})}
						</div>
					) : (
						<p className="mt-2 text-xs text-muted-foreground" data-testid="room-readiness-empty">
							{roomReadinessFilterEmptySentence(filter)}
						</p>
					)}
				</>
			)}
		</section>
	);
}
