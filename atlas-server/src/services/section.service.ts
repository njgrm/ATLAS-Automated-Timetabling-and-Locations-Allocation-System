/**
 * Section service — Wave 5 Durable Mirroring
 * Bridges to section adapter and maintains a local SectionMirror
 * for high availability and local overrides.
 */

import { prisma } from '../lib/prisma.js';
import { sectionAdapter, type SectionSummary, type SectionFetchResult } from './section-adapter.js';

type HomeRoomProgramType = 'REGULAR' | 'STE' | 'SPS' | 'SPA' | 'SPJ' | 'SPFL' | 'SPTVE' | 'OTHER';

type HomeRoomControlSection = {
	id: number;
	externalId: number;
	name: string;
	gradeLevelId: number;
	gradeLevelName: string;
	programType: HomeRoomProgramType;
	homeRoomId: number | null;
	buildingZoneId: string | null;
};

type HomeRoomControlRoom = {
	id: number;
	name: string;
	type: string;
	capacity: number | null;
	buildingId: number;
	buildingName: string;
	shortCode: string | null;
	buildingZoneId: string | null;
};

export type HomeRoomControlPayload = {
	schoolId: number;
	schoolYearId: number;
	sections: HomeRoomControlSection[];
	rooms: HomeRoomControlRoom[];
};

export async function syncSectionsFromExternal(
	schoolId: number,
	schoolYearId: number,
	authToken?: string
): Promise<{ synced: boolean; count: number; removed: number; source: string; fetchedAt: Date }> {
	let result: SectionFetchResult;
	try {
		result = await sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken);
	} catch (err) {
		// Auto-fallback to snapshot is handled by adapter.
		// If it still fails, we'll re-throw or return false.
		throw err;
	}

	const externalSections = result.gradeLevels.flatMap(gl => gl.sections);
	const externalIds = new Set(externalSections.map(s => s.id));

	// Upsert into mirror
	for (const gl of result.gradeLevels) {
		for (const s of gl.sections) {
			await prisma.sectionMirror.upsert({
				where: {
					schoolId_schoolYearId_externalId: {
						schoolId,
						schoolYearId,
						externalId: s.id,
					}
				},
				update: {
					name: s.name,
					gradeLevelId: gl.gradeLevelId,
					gradeLevelName: gl.gradeLevelName,
					displayOrder: gl.displayOrder,
					maxCapacity: s.maxCapacity,
					enrolledCount: s.enrolledCount,
					programType: s.programType,
					programCode: s.programCode,
					programName: s.programName,
					isSpecialProgram: s.isSpecialProgram ?? false,
					lastSyncedAt: result.fetchedAt,
					isStale: false,
					staleReason: null,
				},
				create: {
					externalId: s.id,
					schoolId,
					schoolYearId,
					name: s.name,
					gradeLevelId: gl.gradeLevelId,
					gradeLevelName: gl.gradeLevelName,
					displayOrder: gl.displayOrder,
					maxCapacity: s.maxCapacity,
					enrolledCount: s.enrolledCount,
					programType: s.programType,
					programCode: s.programCode,
					programName: s.programName,
					isSpecialProgram: s.isSpecialProgram ?? false,
					lastSyncedAt: result.fetchedAt,
				}
			});
		}
	}

	// Hard-delete sections that no longer exist in EnrollPro.
	// EnrollPro is the source of truth — stale rows must not persist.
	const { count: deletedCount } = await prisma.sectionMirror.deleteMany({
		where: {
			schoolId,
			schoolYearId,
			externalId: { notIn: Array.from(externalIds) },
		},
	});

	return {
		synced: true,
		count: externalSections.length,
		removed: deletedCount,
		source: result.source,
		fetchedAt: result.fetchedAt,
	};
}

export async function getSectionSummary(schoolYearId: number, schoolId: number, authToken?: string): Promise<SectionSummary> {
	// For Wave 5, we prefer reading from the Mirror first to ensure speed, 
	// but we might want to auto-sync if the mirror is empty.
	
	let mirrors = await prisma.sectionMirror.findMany({
		where: { schoolId, schoolYearId, isStale: false },
		orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }]
	});

	if (mirrors.length === 0) {
		// Initial sync
		await syncSectionsFromExternal(schoolId, schoolYearId, authToken);
		mirrors = await prisma.sectionMirror.findMany({
			where: { schoolId, schoolYearId, isStale: false },
			orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }]
		});
	}

	const byGradeLevel: Record<number, number> = {};
	const enrolledByGradeLevel: Record<number, number> = {};
	const sections: SectionSummary['sections'] = [];
	let totalEnrolled = 0;

	// Group mirrors by grade level to reconstruct the gradeLevels array
	const glMap = new Map<number, any>();

	for (const m of mirrors) {
		if (!glMap.has(m.gradeLevelId)) {
			glMap.set(m.gradeLevelId, {
				gradeLevelId: m.gradeLevelId,
				gradeLevelName: m.gradeLevelName,
				displayOrder: m.displayOrder,
				sections: []
			});
		}
		
		const sec = {
			mirrorId: m.id,
			id: m.externalId,
			name: m.name,
			maxCapacity: m.maxCapacity,
			enrolledCount: m.enrolledCount,
			gradeLevelId: m.gradeLevelId,
			gradeLevelName: m.gradeLevelName,
			displayOrder: m.displayOrder,
			homeRoomId: m.homeRoomId,
			buildingZoneId: m.buildingZoneId,
			programType: m.programType as any,
			programCode: m.programCode,
			programName: m.programName,
			isSpecialProgram: m.isSpecialProgram,
		};
		
		glMap.get(m.gradeLevelId).sections.push(sec);
		sections.push(sec);
		
		byGradeLevel[m.displayOrder] = (byGradeLevel[m.displayOrder] || 0) + 1;
		enrolledByGradeLevel[m.displayOrder] = (enrolledByGradeLevel[m.displayOrder] || 0) + m.enrolledCount;
		totalEnrolled += m.enrolledCount;
	}

	const gradeLevels = Array.from(glMap.values()).sort((a, b) => a.displayOrder - b.displayOrder);

	return {
		schoolId,
		schoolYearId,
		totalSections: sections.length,
		totalEnrolled,
		byGradeLevel,
		enrolledByGradeLevel,
		gradeLevels,
		sections,
		source: 'enrollpro', // Re-evaluate if we want to track 'cached' here
		fetchedAt: mirrors[0]?.lastSyncedAt ?? new Date(),
		isStale: false,
	};
}

export async function getHomeRoomControlData(schoolYearId: number, schoolId: number): Promise<HomeRoomControlPayload> {
	const [sections, rooms] = await Promise.all([
		prisma.sectionMirror.findMany({
			where: { schoolId, schoolYearId, isStale: false },
			select: {
				id: true,
				externalId: true,
				name: true,
				gradeLevelId: true,
				gradeLevelName: true,
				programType: true,
				homeRoomId: true,
				buildingZoneId: true,
			},
			orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
		}),
		prisma.room.findMany({
			where: {
				isTeachingSpace: true,
				building: { schoolId, isTeachingBuilding: true },
			},
			select: {
				id: true,
				name: true,
				type: true,
				capacity: true,
				buildingId: true,
				buildingZoneId: true,
				building: {
					select: { name: true, shortCode: true },
				},
			},
			orderBy: [{ buildingId: 'asc' }, { floor: 'asc' }, { floorPosition: 'asc' }, { id: 'asc' }],
		}),
	]);

	return {
		schoolId,
		schoolYearId,
		sections: sections.map((section) => ({
			id: section.id,
			externalId: section.externalId,
			name: section.name,
			gradeLevelId: section.gradeLevelId,
			gradeLevelName: section.gradeLevelName,
			programType: (section.programType as HomeRoomProgramType) ?? 'REGULAR',
			homeRoomId: section.homeRoomId,
			buildingZoneId: section.buildingZoneId,
		})),
		rooms: rooms.map((room) => ({
			id: room.id,
			name: room.name,
			type: room.type,
			capacity: room.capacity,
			buildingId: room.buildingId,
			buildingName: room.building.name,
			shortCode: room.building.shortCode,
			buildingZoneId: room.buildingZoneId,
		})),
	};
}

export async function updateSectionHomeRooms(
	schoolId: number,
	schoolYearId: number,
	assignments: Array<{ sectionId: number; homeRoomId: number | null }>,
): Promise<{ updated: number }> {
	if (assignments.length === 0) return { updated: 0 };

	const uniqueSectionIds = [...new Set(assignments.map((assignment) => assignment.sectionId))];
	const requestedRoomIds = [...new Set(assignments.map((assignment) => assignment.homeRoomId).filter((value): value is number => value != null))];

	const [sections, rooms] = await Promise.all([
		prisma.sectionMirror.findMany({
			where: { id: { in: uniqueSectionIds }, schoolId, schoolYearId },
			select: { id: true },
		}),
		requestedRoomIds.length === 0
			? Promise.resolve([])
			: prisma.room.findMany({
					where: {
						id: { in: requestedRoomIds },
						isTeachingSpace: true,
						building: { schoolId, isTeachingBuilding: true },
					},
					select: { id: true, buildingZoneId: true },
				}),
	]);

	const sectionIdSet = new Set(sections.map((section) => section.id));
	const roomById = new Map(rooms.map((room) => [room.id, room]));

	let updated = 0;
	await prisma.$transaction(async (tx) => {
		for (const assignment of assignments) {
			if (!sectionIdSet.has(assignment.sectionId)) continue;

			const homeRoomId = assignment.homeRoomId;
			const room = homeRoomId == null ? null : roomById.get(homeRoomId);
			if (homeRoomId != null && !room) continue;

			await tx.sectionMirror.update({
				where: { id: assignment.sectionId },
				data: {
					homeRoomId,
					buildingZoneId: room?.buildingZoneId ?? null,
				},
			});
			updated += 1;
		}
	});

	return { updated };
}
