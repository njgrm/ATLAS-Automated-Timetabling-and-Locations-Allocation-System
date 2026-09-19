import type { RoomType } from '@prisma/client';

import { getDataContext } from '../lib/data-context.js';
import { prisma } from '../lib/prisma.js';

const VALID_GRADES = new Set([7, 8, 9, 10]);

/**
 * HOME-ROOM-AUTO-ASSIGN-C01 (R4): a home room is a general classroom. The
 * specialist teaching spaces in the Science and Innovation Center, the MAPEH
 * and Wellness Hub, and the TLE and Livelihood Center are laboratories,
 * computer labs, workshops, and gyms — not home rooms. They are excluded by the
 * persisted `Room.type` signal, never by a building-name match. The same
 * predicate is pushed into the SQL query below; this in-memory copy keeps the
 * rule observable on the exact production mapping path.
 */
const HOME_ROOM_ELIGIBLE_TYPES: ReadonlySet<RoomType> = new Set<RoomType>(['CLASSROOM']);

export type AutoAssignMode = 'preview' | 'apply';

export type AutoAssignOptions = {
	schoolId: number;
	schoolYearId: number;
	mode: AutoAssignMode;
	overwriteExisting?: boolean;
	allowCrossGradeFallback?: boolean;
	/** Optional Prisma client override for testing. */
	prisma?: typeof prisma;
};

export type AutoAssignResult = {
	schoolId: number;
	schoolYearId: number;
	mode: AutoAssignMode;
	overwriteExisting: boolean;
	allowCrossGradeFallback: boolean;
	assignments: Array<{
		sectionId: number;
		sectionName: string;
		gradeLevel: number;
		homeRoomId: number;
		roomName: string;
		buildingId: number;
		buildingName: string;
		reason: string;
	}>;
	skipped: Array<{
		sectionId: number;
		sectionName: string;
		gradeLevel: number;
		reason: string;
	}>;
	counts: {
		sectionsConsidered: number;
		assigned: number;
		skipped: number;
		existingPreserved: number;
		applied: number;
	};
};

type SectionRow = {
	id: number;
	externalId: number;
	name: string;
	gradeLevelId: number;
	gradeLevelName: string;
	homeRoomId: number | null;
	enrolledCount: number;
};

type RoomRow = {
	id: number;
	name: string;
	type: RoomType;
	capacity: number | null;
	buildingId: number;
	buildingName: string;
	buildingGradeScope: number[];
	floor: number;
	floorPosition: number;
};

type RoomCandidate = {
	room: RoomRow;
	matchScore: number;
};

function extractGradeNumber(gradeLevelName: string): number {
	// "Grade 7" -> 7, "Grade 10" -> 10
	const match = gradeLevelName.match(/(\d+)/);
	if (match) {
		const n = parseInt(match[1], 10);
		if (VALID_GRADES.has(n)) return n;
	}
	return 0;
}

function buildingMatchScore(sectionGrade: number, buildingGradeScope: number[]): number {
	// 0 = no match (cross-grade), 1 = any-grade building, 2 = exact grade match.
	// R2: an empty scope is deliberately any-grade (1) and must never outrank a
	// declared exact match (2). Do not change these semantics.
	if (buildingGradeScope.length === 0) return 1; // any-grade
	if (buildingGradeScope.includes(sectionGrade)) return 2; // exact match
	return 0; // no match
}

/**
 * R1: deterministic, non-lexicographic, numeric-aware string ordering. Splits a
 * value into digit and non-digit tokens so "Grade 7 Academic Wing" sorts before
 * "Grade 10 Academic Wing" (the old `localeCompare` put "10" first because
 * '1' < '7'). Pure function of its inputs — no locale or ICU dependency — so
 * identical inputs always yield identical output across processes.
 */
function naturalCompare(a: string, b: string): number {
	const ax = a.match(/\d+|\D+/g) ?? [];
	const bx = b.match(/\d+|\D+/g) ?? [];
	const len = Math.max(ax.length, bx.length);
	for (let i = 0; i < len; i += 1) {
		const x = ax[i];
		const y = bx[i];
		if (x === undefined) return -1;
		if (y === undefined) return 1;
		const xNumeric = /^\d+$/.test(x);
		const yNumeric = /^\d+$/.test(y);
		if (xNumeric && yNumeric) {
			const xValue = Number(x);
			const yValue = Number(y);
			if (xValue !== yValue) return xValue < yValue ? -1 : 1;
			// Same numeric value: fewer leading zeros sorts first.
			if (x.length !== y.length) return x.length - y.length;
		} else if (x !== y) {
			return x < y ? -1 : 1;
		}
	}
	return 0;
}

/**
 * R1 capacity fit: prefer a known capacity over an unknown one, then the
 * tightest adequate capacity. Rooms smaller than the section's enrolled count
 * are already filtered out, so this only orders rooms that all fit.
 */
function compareCapacity(a: number | null, b: number | null): number {
	if (a == null && b == null) return 0;
	if (a == null) return 1;
	if (b == null) return -1;
	return a - b;
}

/**
 * R1: explicit total-order tiebreak chain. No comparator step returns an
 * "equal" result for distinct rooms, so the sort is stable and independent of
 * the order rows arrive in (determinism control).
 */
function compareRoomCandidates(a: RoomCandidate, b: RoomCandidate): number {
	return (
		b.matchScore - a.matchScore || // 1. exact grade scope (2) before any-grade (1) before cross-grade (0)
		compareCapacity(a.room.capacity, b.room.capacity) || // 2. tightest capacity fit
		naturalCompare(a.room.buildingName, b.room.buildingName) || // 3. numeric-aware building name
		a.room.buildingId - b.room.buildingId || // 4. building id
		a.room.floor - b.room.floor || // 5. floor
		a.room.floorPosition - b.room.floorPosition || // 6. floor position
		naturalCompare(a.room.name, b.room.name) || // 7. numeric-aware room name
		a.room.id - b.room.id // 8. room id
	);
}

export async function computeAutoAssign(options: AutoAssignOptions): Promise<AutoAssignResult> {
	const { schoolId, schoolYearId, mode, overwriteExisting = false, allowCrossGradeFallback = false } = options;
	const db: typeof prisma = options.prisma ?? getDataContext<typeof prisma>();

	// Fetch sections (include enrolledCount for capacity checks)
	const sectionRows = await db.sectionMirror.findMany({
		where: { schoolId, schoolYearId, isStale: false },
		select: {
			id: true,
			externalId: true,
			name: true,
			gradeLevelId: true,
			gradeLevelName: true,
			homeRoomId: true,
			enrolledCount: true,
		},
		orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
	});

	// Fetch eligible home-room candidates: general classrooms (R4) that are
	// teaching space inside a teaching building. The `type` predicate is pushed
	// into SQL and re-applied in memory on the mapped rows below.
	const roomRows = await db.room.findMany({
		where: {
			isTeachingSpace: true,
			type: 'CLASSROOM',
			building: { schoolId, isTeachingBuilding: true },
		},
		select: {
			id: true,
			name: true,
			type: true,
			capacity: true,
			buildingId: true,
			floor: true,
			floorPosition: true,
			building: {
				select: { name: true, gradeScope: true },
			},
		},
		orderBy: [{ buildingId: 'asc' }, { floor: 'asc' }, { floorPosition: 'asc' }, { id: 'asc' }],
	});

	const rooms: RoomRow[] = roomRows
		.map((r) => ({
			id: r.id,
			name: r.name,
			type: r.type,
			capacity: r.capacity,
			buildingId: r.buildingId,
			buildingName: r.building.name,
			buildingGradeScope: r.building.gradeScope,
			floor: r.floor,
			floorPosition: r.floorPosition,
		}))
		.filter((room) => HOME_ROOM_ELIGIBLE_TYPES.has(room.type));

	// Determine which sections need assignment
	const sectionsToProcess: SectionRow[] = [];
	const existingPreserved: SectionRow[] = [];

	for (const section of sectionRows) {
		if (section.homeRoomId != null && !overwriteExisting) {
			existingPreserved.push(section);
		} else {
			sectionsToProcess.push(section);
		}
	}

	// Track assigned rooms to avoid duplicates
	const assignedRoomIds = new Set<number>();
	// Also include rooms already used by preserved sections
	for (const section of existingPreserved) {
		// We don't know which room is used by preserved sections from this query alone,
		// but we can check against the room list
		if (section.homeRoomId != null) {
			assignedRoomIds.add(section.homeRoomId);
		}
	}

	const assignments: AutoAssignResult['assignments'] = [];
	const skipped: AutoAssignResult['skipped'] = [];

	// Sort sections by grade then numeric-aware name; `id` closes the order so the
	// processed sequence is independent of the order rows arrive in.
	const sortedSections = [...sectionsToProcess].sort(
		(a, b) =>
			extractGradeNumber(a.gradeLevelName) - extractGradeNumber(b.gradeLevelName) ||
			naturalCompare(a.name, b.name) ||
			a.id - b.id,
	);

	// Categorize rooms by grade match
	for (const section of sortedSections) {
		const sectionGrade = extractGradeNumber(section.gradeLevelName);

		// Find eligible rooms, sorted by the explicit R1 tiebreak chain
		const eligible = rooms
			.filter((room) => !assignedRoomIds.has(room.id))
			.map((room): RoomCandidate => ({
				room,
				matchScore: buildingMatchScore(sectionGrade, room.buildingGradeScope),
			}))
			.filter((entry) => {
				if (entry.matchScore === 2) return true; // exact grade match
				if (entry.matchScore === 1) return true; // any-grade building
				// matchScore === 0 means cross-grade (non-matching scope)
				return allowCrossGradeFallback;
			})
			.filter((entry) => {
				// Capacity check: skip rooms with known capacity smaller than enrolled count
				// Rooms with capacity=null are treated as unknown and remain eligible
				if (entry.room.capacity != null && entry.room.capacity < section.enrolledCount) {
					return false;
				}
				return true;
			})
			.sort(compareRoomCandidates);

		if (eligible.length === 0) {
			// Determine dominant skip reason from unassigned rooms
			const unassigned = rooms.filter((r) => !assignedRoomIds.has(r.id));
			let reason = 'NO_ELIGIBLE_ROOM';
			if (unassigned.length > 0) {
				const hasCapacityRoom = unassigned.some(
					(r) => r.capacity == null || r.capacity >= section.enrolledCount,
				);
				if (!hasCapacityRoom) {
					reason = 'ROOM_CAPACITY_TOO_SMALL';
				} else if (!allowCrossGradeFallback) {
					const hasGradeMatch = unassigned.some((r) =>
						r.buildingGradeScope.length === 0 || r.buildingGradeScope.includes(sectionGrade),
					);
					if (!hasGradeMatch) {
						reason = 'NO_GRADE_MATCHING_ROOM';
					}
				}
			}
			skipped.push({
				sectionId: section.externalId,
				sectionName: section.name,
				gradeLevel: sectionGrade,
				reason,
			});
			continue;
		}

		const best = eligible[0];
		assignedRoomIds.add(best.room.id);

		assignments.push({
			sectionId: section.externalId,
			sectionName: section.name,
			gradeLevel: sectionGrade,
			homeRoomId: best.room.id,
			roomName: best.room.name,
			buildingId: best.room.buildingId,
			buildingName: best.room.buildingName,
			reason: best.matchScore === 2 ? 'GRADE_SCOPE_MATCH' : 'ANY_GRADE_FALLBACK',
		});
	}

	const result: AutoAssignResult = {
		schoolId,
		schoolYearId,
		mode,
		overwriteExisting,
		allowCrossGradeFallback,
		assignments,
		skipped,
		counts: {
			sectionsConsidered: sectionsToProcess.length,
			assigned: assignments.length,
			skipped: skipped.length,
			existingPreserved: existingPreserved.length,
			applied: 0,
		},
	};

	// Apply if mode is 'apply'
	if (mode === 'apply' && assignments.length > 0) {
		let applied = 0;
		await db.$transaction(async (tx) => {
			for (const assignment of assignments) {
				const mirror = await tx.sectionMirror.findFirst({
					where: { externalId: assignment.sectionId, schoolId, schoolYearId },
					select: { id: true },
				});
				if (!mirror) continue;

				const room = await tx.room.findUnique({
					where: { id: assignment.homeRoomId },
					select: { buildingZoneId: true },
				});

				await tx.sectionMirror.update({
					where: { id: mirror.id },
					data: {
						homeRoomId: assignment.homeRoomId,
						buildingZoneId: room?.buildingZoneId ?? null,
					},
				});
				applied += 1;
			}
		});
		result.counts.applied = applied;
	}

	return result;
}
