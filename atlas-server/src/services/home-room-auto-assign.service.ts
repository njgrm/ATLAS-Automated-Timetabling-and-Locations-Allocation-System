import { prisma } from '../lib/prisma.js';

const VALID_GRADES = new Set([7, 8, 9, 10]);

export type AutoAssignMode = 'preview' | 'apply';

export type AutoAssignOptions = {
	schoolId: number;
	schoolYearId: number;
	mode: AutoAssignMode;
	overwriteExisting?: boolean;
	allowCrossGradeFallback?: boolean;
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
};

type RoomRow = {
	id: number;
	name: string;
	capacity: number | null;
	buildingId: number;
	buildingName: string;
	buildingGradeScope: number[];
	floor: number;
	floorPosition: number;
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
	// 0 = no match (cross-grade), 1 = any-grade building, 2 = exact grade match
	if (buildingGradeScope.length === 0) return 1; // any-grade
	if (buildingGradeScope.includes(sectionGrade)) return 2; // exact match
	return 0; // no match
}

function sortKey(section: SectionRow, room: RoomRow, matchScore: number) {
	return {
		grade: extractGradeNumber(section.gradeLevelName),
		sectionName: section.name,
		matchScore: -matchScore, // higher match first
		buildingName: room.buildingName,
		floor: room.floor,
		floorPosition: room.floorPosition,
		roomName: room.name,
	};
}

export async function computeAutoAssign(options: AutoAssignOptions): Promise<AutoAssignResult> {
	const { schoolId, schoolYearId, mode, overwriteExisting = false, allowCrossGradeFallback = false } = options;

	// Fetch sections
	const sectionRows = await prisma.sectionMirror.findMany({
		where: { schoolId, schoolYearId, isStale: false },
		select: {
			id: true,
			externalId: true,
			name: true,
			gradeLevelId: true,
			gradeLevelName: true,
			homeRoomId: true,
		},
		orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
	});

	// Fetch eligible rooms (teaching space in teaching buildings)
	const roomRows = await prisma.room.findMany({
		where: {
			isTeachingSpace: true,
			building: { schoolId, isTeachingBuilding: true },
		},
		select: {
			id: true,
			name: true,
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

	const rooms: RoomRow[] = roomRows.map((r) => ({
		id: r.id,
		name: r.name,
		capacity: r.capacity,
		buildingId: r.buildingId,
		buildingName: r.building.name,
		buildingGradeScope: r.building.gradeScope,
		floor: r.floor,
		floorPosition: r.floorPosition,
	}));

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

	// Sort sections by grade then name for deterministic output
	const sortedSections = [...sectionsToProcess].sort(
		(a, b) => a.gradeLevelId - b.gradeLevelId || a.name.localeCompare(b.name),
	);

	// Categorize rooms by grade match
	for (const section of sortedSections) {
		const sectionGrade = extractGradeNumber(section.gradeLevelName);

		// Find eligible rooms, sorted by match quality
		const eligible = rooms
			.filter((room) => !assignedRoomIds.has(room.id))
			.map((room) => ({
				room,
				matchScore: buildingMatchScore(sectionGrade, room.buildingGradeScope),
			}))
			.filter((entry) => {
				if (entry.matchScore === 2) return true; // exact grade match
				if (entry.matchScore === 1) return true; // any-grade building
				// matchScore === 0 means cross-grade (non-matching scope)
				return allowCrossGradeFallback;
			})
			.sort((a, b) => {
				const scoreDiff = b.matchScore - a.matchScore;
				if (scoreDiff !== 0) return scoreDiff;
				const keyA = sortKey(section, a.room, a.matchScore);
				const keyB = sortKey(section, b.room, b.matchScore);
				return (
					keyA.grade - keyB.grade ||
					keyA.sectionName.localeCompare(keyB.sectionName) ||
					keyA.matchScore - keyB.matchScore ||
					keyA.buildingName.localeCompare(keyB.buildingName) ||
					keyA.floor - keyB.floor ||
					keyA.floorPosition - keyB.floorPosition ||
					keyA.roomName.localeCompare(keyB.roomName)
				);
			});

		if (eligible.length === 0) {
			let reason = 'NO_ELIGIBLE_ROOM';
			// Check if there are rooms but none match grade
			const anyRoomExists = rooms.some((r) => !assignedRoomIds.has(r.id));
			if (anyRoomExists && !allowCrossGradeFallback) {
				reason = 'NO_GRADE_MATCHING_ROOM';
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
		await prisma.$transaction(async (tx) => {
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
