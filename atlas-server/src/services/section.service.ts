/**
 * Section service — Wave 5 Durable Mirroring
 * Bridges to section adapter and maintains a local SectionMirror
 * for high availability and local overrides.
 */

import { prisma } from '../lib/prisma.js';
import { resolveRuntimeContext } from './runtime-context.service.js';
import { sectionAdapter, type SectionSummary, type SectionFetchResult } from './section-adapter.js';

type RuntimeSectionSourceOptions = {
	authToken?: string;
	preferLocalEvidenceFirst?: boolean;
};

async function loadMirrorBackedSectionFetchResult(
	schoolId: number,
	schoolYearId: number,
	fallbackReason: string,
): Promise<SectionFetchResult | null> {
	const mirrors = await prisma.sectionMirror.findMany({
		where: { schoolId, schoolYearId, isStale: false },
		orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
		select: {
			externalId: true,
			name: true,
			gradeLevelId: true,
			gradeLevelName: true,
			displayOrder: true,
			maxCapacity: true,
			enrolledCount: true,
			programType: true,
			programCode: true,
			programName: true,
			isSpecialProgram: true,
			tleProgramId: true,
			tleSpecialization: true,
			tleProgramCategory: true,
			lastSyncedAt: true,
		},
	});

	if (mirrors.length === 0) {
		return null;
	}

	const groupedByGrade = new Map<number, SectionFetchResult['gradeLevels'][number]>();
	for (const mirror of mirrors) {
		const gradeEntry = groupedByGrade.get(mirror.gradeLevelId) ?? {
			gradeLevelId: mirror.gradeLevelId,
			gradeLevelName: mirror.gradeLevelName,
			displayOrder: mirror.displayOrder,
			sections: [],
		};

		gradeEntry.sections.push({
			id: mirror.externalId,
			name: mirror.name,
			maxCapacity: mirror.maxCapacity,
			enrolledCount: mirror.enrolledCount,
			gradeLevelId: mirror.gradeLevelId,
			gradeLevelName: mirror.gradeLevelName,
			displayOrder: mirror.displayOrder,
			programType: (mirror.programType as any) ?? 'REGULAR',
			programCode: mirror.programCode,
			programName: mirror.programName,
			isSpecialProgram: mirror.isSpecialProgram,
			tleProgramId: mirror.tleProgramId,
			tleSpecialization: mirror.tleSpecialization,
			tleProgramCategory: mirror.tleProgramCategory,
		});

		groupedByGrade.set(mirror.gradeLevelId, gradeEntry);
	}

	const gradeLevels = Array.from(groupedByGrade.values()).sort((left, right) => left.displayOrder - right.displayOrder);
	for (const grade of gradeLevels) {
		grade.sections.sort((left, right) => left.name.localeCompare(right.name) || left.id - right.id);
	}

	return {
		gradeLevels,
		source: 'cached-enrollpro',
		fetchedAt: mirrors[0].lastSyncedAt,
		fallbackReason,
		isStale: false,
	};
}

async function loadSnapshotBackedSectionFetchResult(
	schoolId: number,
	schoolYearId: number,
	fallbackReason: string,
): Promise<SectionFetchResult | null> {
	const snapshot = await prisma.sectionSnapshot.findUnique({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
		select: { payload: true, fetchedAt: true },
	});

	if (!snapshot) {
		return null;
	}

	return {
		gradeLevels: (snapshot.payload as unknown as SectionFetchResult['gradeLevels']) ?? [],
		source: 'cached-enrollpro',
		fetchedAt: snapshot.fetchedAt,
		fallbackReason,
		isStale: true,
	};
}

export async function fetchSectionsForRuntimeControls(
	schoolId: number,
	schoolYearId: number,
	options?: RuntimeSectionSourceOptions,
): Promise<SectionFetchResult> {
	const authToken = options?.authToken;
	const preferLocalEvidenceFirst = options?.preferLocalEvidenceFirst !== false;

	if (preferLocalEvidenceFirst) {
		const mirrorResult = await loadMirrorBackedSectionFetchResult(
			schoolId,
			schoolYearId,
			'atlas-mirror-preferred-runtime-control',
		);
		if (mirrorResult) {
			return mirrorResult;
		}

		const snapshotResult = await loadSnapshotBackedSectionFetchResult(
			schoolId,
			schoolYearId,
			'atlas-snapshot-preferred-runtime-control',
		);
		if (snapshotResult) {
			return snapshotResult;
		}
	}

	try {
		return await sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken);
	} catch (error) {
		const fallbackReason = error instanceof Error ? error.message : String(error);
		const mirrorResult = await loadMirrorBackedSectionFetchResult(schoolId, schoolYearId, fallbackReason);
		if (mirrorResult) {
			return mirrorResult;
		}

		const snapshotResult = await loadSnapshotBackedSectionFetchResult(schoolId, schoolYearId, fallbackReason);
		if (snapshotResult) {
			return snapshotResult;
		}

		throw error;
	}
}

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
): Promise<{ synced: boolean; count: number; removed: number; skipped: number; source: 'enrollpro'; fetchedAt: Date }> {
	let result: SectionFetchResult;
	try {
		result = await sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken);
	} catch (err) {
		// Auto-fallback to snapshot is handled by adapter.
		// If it still fails, we'll re-throw or return false.
		throw err;
	}

	const externalSections = result.gradeLevels.flatMap(gl => gl.sections);
	const validSections: typeof externalSections = [];
	let skipped = 0;

	for (const gl of result.gradeLevels) {
		for (const s of gl.sections) {
			const hasValidId = typeof s.id === 'number' && s.id > 0;
			const hasValidName = typeof s.name === 'string' && s.name.trim().length > 0;
			const hasValidGrade = typeof gl.gradeLevelId === 'number' && gl.gradeLevelId > 0;
			const hasValidProgram = typeof s.programType === 'string' && s.programType.trim().length > 0;

			if (!hasValidId || !hasValidName || !hasValidGrade || !hasValidProgram) {
				skipped += 1;
				continue;
			}
			validSections.push(s);
		}
	}

	const externalIds = new Set(validSections.map(s => s.id));

	// Upsert into mirror
	for (const gl of result.gradeLevels) {
		const validGlSections = gl.sections.filter(s => externalIds.has(s.id));
		for (const s of validGlSections) {
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
					tleProgramId: s.tleProgramId ?? null,
					tleSpecialization: s.tleSpecialization ?? null,
					tleProgramCategory: s.tleProgramCategory ?? null,
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
					tleProgramId: s.tleProgramId ?? null,
					tleSpecialization: s.tleSpecialization ?? null,
					tleProgramCategory: s.tleProgramCategory ?? null,
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
		count: validSections.length,
		removed: deletedCount,
		skipped,
		source: 'enrollpro',
		fetchedAt: result.fetchedAt,
	};
}

export async function getSectionSummary(schoolYearId: number, schoolId: number, authToken?: string): Promise<SectionSummary> {
	// For Wave 5, we prefer reading from the Mirror first to ensure speed, 
	// but we might want to auto-sync if the mirror is empty.
	let source: SectionSummary['source'] = 'atlas-mirror';

	const runtimeCtx = await resolveRuntimeContext(schoolId);
	const isUpstreamVerified = runtimeCtx?.source === 'enrollpro-verified' && runtimeCtx?.activeSchoolYearId === schoolYearId;

	if (isUpstreamVerified) {
		source = 'enrollpro';
	}

	let mirrors = await prisma.sectionMirror.findMany({
		where: { schoolId, schoolYearId, isStale: false },
		orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }]
	});

	if (mirrors.length === 0) {
		// Initial sync
		const syncResult = await syncSectionsFromExternal(schoolId, schoolYearId, authToken);
		source = syncResult.source;
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
			tleProgramId: m.tleProgramId,
			tleSpecialization: m.tleSpecialization,
			tleProgramCategory: m.tleProgramCategory,
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
		source,
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
			where: { externalId: { in: uniqueSectionIds }, schoolId, schoolYearId },
			select: { id: true, externalId: true },
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

	const sectionIdSet = new Set(sections.map((section) => section.externalId));
	const roomById = new Map(rooms.map((room) => [room.id, room]));
	const mirrorIdByExternalId = new Map(sections.map((s) => [s.externalId, s.id]));

	let updated = 0;
	await prisma.$transaction(async (tx) => {
		for (const assignment of assignments) {
			if (!sectionIdSet.has(assignment.sectionId)) continue;
			const mirrorId = mirrorIdByExternalId.get(assignment.sectionId);
			if (!mirrorId) continue;

			const homeRoomId = assignment.homeRoomId;
			const room = homeRoomId == null ? null : roomById.get(homeRoomId);
			if (homeRoomId != null && !room) continue;

			await tx.sectionMirror.update({
				where: { id: mirrorId },
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

type SpecialProgramPlacementIssueCode = 'NO_PROGRAM_ROOM_AVAILABLE';

type SpecialProgramPlacementIssue = {
	sectionId: number;
	externalId: number;
	gradeLevelId: number;
	programType: 'SPA' | 'SPS';
	sectionName: string;
	issueCode: SpecialProgramPlacementIssueCode;
	message: string;
};

type SpecialProgramPlacementResult = {
	affectedSections: number;
	missingHomeRoomBefore: number;
	missingBuildingZoneBefore: number;
	updated: number;
	remainingMissingHomeRoom: number;
	remainingMissingBuildingZone: number;
	issues: SpecialProgramPlacementIssue[];
	assignments: Array<{
		sectionId: number;
		externalId: number;
		gradeLevelId: number;
		programType: 'SPA' | 'SPS';
		sectionName: string;
		homeRoomId: number;
		buildingZoneId: string;
		roomName: string;
	}>;
};

function normalizeProgramCode(value: string | null | undefined): 'SPA' | 'SPS' | null {
	const normalized = (value ?? '').trim().toUpperCase();
	if (normalized === 'SPA' || normalized === 'SPS') return normalized;
	return null;
}

function roomTypePriority(type: string): number {
	if (type === 'CLASSROOM') return 0;
	if (type === 'LABORATORY') return 1;
	if (type === 'COMPUTER_LAB') return 2;
	if (type === 'GYMNASIUM') return 3;
	return 9;
}

export async function applySpecialProgramPlacementOverlay(
	schoolId: number,
	schoolYearId: number,
): Promise<SpecialProgramPlacementResult> {
	const sections = await prisma.sectionMirror.findMany({
		where: {
			schoolId,
			schoolYearId,
			isStale: false,
			programType: { in: ['SPA', 'SPS'] },
		},
		select: {
			id: true,
			externalId: true,
			name: true,
			gradeLevelId: true,
			programType: true,
			homeRoomId: true,
			buildingZoneId: true,
		},
		orderBy: [{ gradeLevelId: 'asc' }, { programType: 'asc' }, { name: 'asc' }],
	});

	const missingHomeRoomBefore = sections.filter((section) => section.homeRoomId == null).length;
	const missingBuildingZoneBefore = sections.filter((section) => !section.buildingZoneId).length;

	const targetSections = sections.filter((section) => section.homeRoomId == null || !section.buildingZoneId);
	if (targetSections.length === 0) {
		return {
			affectedSections: sections.length,
			missingHomeRoomBefore,
			missingBuildingZoneBefore,
			updated: 0,
			remainingMissingHomeRoom: 0,
			remainingMissingBuildingZone: 0,
			issues: [],
			assignments: [],
		};
	}

	const [rooms, currentlyAssignedRows] = await Promise.all([
		prisma.room.findMany({
			where: {
				isTeachingSpace: true,
				building: { schoolId, isTeachingBuilding: true },
			},
			select: {
				id: true,
				name: true,
				type: true,
				buildingZoneId: true,
				building: {
					select: {
						shortCode: true,
					},
				},
			},
		}),
		prisma.sectionMirror.findMany({
			where: {
				schoolId,
				schoolYearId,
				homeRoomId: { not: null },
			},
			select: { homeRoomId: true },
		}),
	]);

	const assignedRoomIds = new Set<number>(
		currentlyAssignedRows
			.map((row) => row.homeRoomId)
			.filter((roomId): roomId is number => roomId != null),
	);

	type CandidateRoom = {
		id: number;
		name: string;
		type: string;
		buildingZoneId: string | null;
		buildingShortCode: string | null;
		programCode: 'SPA' | 'SPS' | null;
	};

	const candidates: CandidateRoom[] = rooms
		.map((room) => {
			const buildingShortCode = room.building.shortCode?.trim().toUpperCase() ?? null;
			const zoneCode = room.buildingZoneId?.trim().toUpperCase() ?? null;
			return {
				id: room.id,
				name: room.name,
				type: room.type,
				buildingZoneId: room.buildingZoneId,
				buildingShortCode: room.building.shortCode,
				programCode: normalizeProgramCode(buildingShortCode) ?? normalizeProgramCode(zoneCode),
			};
		})
		.filter((room) => room.programCode != null)
		.sort((a, b) => {
			const byProgram = String(a.programCode).localeCompare(String(b.programCode));
			if (byProgram !== 0) return byProgram;
			const byType = roomTypePriority(a.type) - roomTypePriority(b.type);
			if (byType !== 0) return byType;
			return a.id - b.id;
		});

	const candidatesByProgram = new Map<'SPA' | 'SPS', CandidateRoom[]>();
	for (const room of candidates) {
		const programCode = room.programCode as 'SPA' | 'SPS';
		const list = candidatesByProgram.get(programCode) ?? [];
		list.push(room);
		candidatesByProgram.set(programCode, list);
	}

	const updates: Array<{ sectionId: number; homeRoomId: number; buildingZoneId: string; roomName: string; programType: 'SPA' | 'SPS'; externalId: number; gradeLevelId: number; sectionName: string }> = [];
	const issues: SpecialProgramPlacementIssue[] = [];

	for (const section of targetSections) {
		const programType = normalizeProgramCode(section.programType ?? null);
		if (!programType) continue;

		const roomList = candidatesByProgram.get(programType) ?? [];
		const room = roomList.find((candidate) => !assignedRoomIds.has(candidate.id));
		if (!room) {
			issues.push({
				sectionId: section.id,
				externalId: section.externalId,
				gradeLevelId: section.gradeLevelId,
				programType,
				sectionName: section.name,
				issueCode: 'NO_PROGRAM_ROOM_AVAILABLE',
				message: `No available ${programType} teaching room is currently available for overlay assignment.`,
			});
			continue;
		}

		const buildingZoneId = room.buildingZoneId?.trim() || room.buildingShortCode?.trim() || programType;
		updates.push({
			sectionId: section.id,
			homeRoomId: room.id,
			buildingZoneId,
			roomName: room.name,
			programType,
			externalId: section.externalId,
			gradeLevelId: section.gradeLevelId,
			sectionName: section.name,
		});
		assignedRoomIds.add(room.id);
	}

	if (updates.length > 0) {
		await prisma.$transaction(
			updates.map((update) =>
				prisma.sectionMirror.update({
					where: { id: update.sectionId },
					data: {
						homeRoomId: update.homeRoomId,
						preferredRoomId: update.homeRoomId,
						buildingZoneId: update.buildingZoneId,
					},
				}),
			),
		);
	}

	const after = await prisma.sectionMirror.findMany({
		where: {
			schoolId,
			schoolYearId,
			isStale: false,
			programType: { in: ['SPA', 'SPS'] },
		},
		select: {
			homeRoomId: true,
			buildingZoneId: true,
		},
	});

	return {
		affectedSections: sections.length,
		missingHomeRoomBefore,
		missingBuildingZoneBefore,
		updated: updates.length,
		remainingMissingHomeRoom: after.filter((section) => section.homeRoomId == null).length,
		remainingMissingBuildingZone: after.filter((section) => !section.buildingZoneId).length,
		issues,
		assignments: updates.map((update) => ({
			sectionId: update.sectionId,
			externalId: update.externalId,
			gradeLevelId: update.gradeLevelId,
			programType: update.programType,
			sectionName: update.sectionName,
			homeRoomId: update.homeRoomId,
			buildingZoneId: update.buildingZoneId,
			roomName: update.roomName,
		})),
	};
}
