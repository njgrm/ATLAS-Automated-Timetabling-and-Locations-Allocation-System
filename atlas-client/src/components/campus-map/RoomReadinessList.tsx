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
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, CircleSlash2, DoorOpen } from 'lucide-react';
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

type RoomWithBuilding = { building: Building; room: Room; status: RoomReadinessStatus };

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
	const [showAllRooms, setShowAllRooms] = useState(false);
	const rooms = buildings.flatMap((building) =>
		(building.rooms ?? []).map((room) => ({ building, room, status: getRoomStatus(room, roomOccupancy) })),
	);
	const groups = buildRoomProblemGroups(rooms);
	const summary = roomProblemSummary(groups);

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
				{rooms.length > 0 ? (
					<Button
						variant="outline"
						size="sm"
						className="h-8 shrink-0 gap-1.5"
						aria-expanded={showAllRooms}
						data-testid="room-readiness-show-all"
						onClick={() => setShowAllRooms((open) => !open)}
					>
						<ChevronDown className={`size-3.5 transition-transform ${showAllRooms ? 'rotate-180' : ''}`} />
						{showAllRooms ? 'Hide all rooms' : 'Show all rooms'}
					</Button>
				) : null}
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

					{/* THE FULL LIST, unchanged, behind one control. This bounded region is
					    where internal scrolling is allowed; the page's root container is
					    untouched, so no global scrollbar appears. */}
					{showAllRooms ? (
						<div className={`mt-3 grid gap-2 ${compact ? 'max-h-44 overflow-auto pr-1 sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`} data-testid="room-readiness-all-rooms">
							{rooms.map(({ building, room, status }) => {
								const copy = STATUS_COPY[status];
								return (
									<div key={room.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2" data-room-status={status}>
										<div className="min-w-0">
											<p className="truncate text-xs font-semibold text-slate-800">{room.name}</p>
											<p className="truncate text-[11px] text-muted-foreground">{building.name} · {room.capacity ? `${room.capacity} seats` : 'Capacity missing'}</p>
										</div>
										<Badge variant="outline" className={`shrink-0 gap-1 text-[11px] ${copy.className}`}><StatusIcon status={status} />{copy.label}</Badge>
									</div>
								);
							})}
						</div>
					) : null}
				</>
			)}
		</section>
	);
}
