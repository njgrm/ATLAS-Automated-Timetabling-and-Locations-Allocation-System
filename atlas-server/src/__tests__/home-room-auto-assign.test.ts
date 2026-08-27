/**
 * Home-Room Auto-Assign — Service-Level Tests
 *
 * Tests the production computeAutoAssign function by injecting a mock
 * Prisma client via the options.prisma dependency parameter.
 *
 * Run: npx tsx src/__tests__/home-room-auto-assign.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAutoAssign, type AutoAssignResult } from '../services/home-room-auto-assign.service.js';

// ── Mock Prisma ──

type MockSection = {
	id: number;
	externalId: number;
	name: string;
	gradeLevelId: number;
	gradeLevelName: string;
	homeRoomId: number | null;
	buildingZoneId: string | null;
	enrolledCount: number;
	isStale: boolean;
	schoolId: number;
	schoolYearId: number;
	displayOrder: number;
};

type MockRoom = {
	id: number;
	name: string;
	capacity: number | null;
	buildingId: number;
	floor: number;
	floorPosition: number;
	isTeachingSpace: boolean;
	buildingZoneId: string | null;
	building: {
		name: string;
		shortCode: string | null;
		gradeScope: number[];
		schoolId: number;
		isTeachingBuilding: boolean;
	};
};

let mockSections: MockSection[] = [];
let mockRooms: MockRoom[] = [];
let updatedSections: Array<{ id: number; data: Record<string, unknown> }> = [];
let applyCalled = false;

function createMockPrisma() {
	return {
		sectionMirror: {
			findMany: async (opts: any) => {
				return mockSections.filter((s) => {
					if (opts.where?.schoolId && s.schoolId !== opts.where.schoolId) return false;
					if (opts.where?.schoolYearId && s.schoolYearId !== opts.where.schoolYearId) return false;
					if (opts.where?.isStale !== undefined && s.isStale !== opts.where.isStale) return false;
					return true;
				});
			},
			findFirst: async (opts: any) => {
				return mockSections.find((s) => {
					if (opts.where?.externalId && s.externalId !== opts.where.externalId) return false;
					if (opts.where?.schoolId && s.schoolId !== opts.where.schoolId) return false;
					if (opts.where?.schoolYearId && s.schoolYearId !== opts.where.schoolYearId) return false;
					return true;
				}) ?? null;
			},
			update: async (opts: any) => {
				applyCalled = true;
				const section = mockSections.find((s) => s.id === opts.where.id);
				if (section) {
					section.homeRoomId = opts.data.homeRoomId;
					section.buildingZoneId = opts.data.buildingZoneId;
					updatedSections.push({ id: opts.where.id, data: opts.data });
				}
				return section;
			},
		},
		room: {
			findMany: async (opts: any) => {
				return mockRooms.filter((r) => {
					if (opts.where?.isTeachingSpace !== undefined && r.isTeachingSpace !== opts.where.isTeachingSpace) return false;
					if (opts.where?.building?.schoolId && r.building.schoolId !== opts.where.building.schoolId) return false;
					if (opts.where?.building?.isTeachingBuilding !== undefined && r.building.isTeachingBuilding !== opts.where.building.isTeachingBuilding) return false;
					return true;
				});
			},
			findUnique: async (opts: any) => {
				return mockRooms.find((r) => r.id === opts.where.id) ?? null;
			},
		},
		$transaction: async (fn: any) => {
			const tx = createMockPrisma();
			await fn(tx);
		},
	} as any;
}

function setupMock(opts: {
	sections?: Partial<MockSection>[];
	rooms?: Partial<MockRoom>[];
	buildings?: Array<{ id: number; name: string; gradeScope: number[]; schoolId?: number; isTeachingBuilding?: boolean }>;
}) {
	updatedSections = [];
	applyCalled = false;
	const defaultBuilding = { schoolId: 1, isTeachingBuilding: true, shortCode: null };
	const buildings = (opts.buildings ?? []).map((b) => ({ ...defaultBuilding, ...b }));
	const buildingById = new Map(buildings.map((b) => [b.id, b]));

	mockSections = (opts.sections ?? []).map((s, i) => ({
		id: i + 1,
		externalId: i + 1,
		name: `Section ${i + 1}`,
		gradeLevelId: 5,
		gradeLevelName: 'Grade 7',
		homeRoomId: null,
		buildingZoneId: null,
		enrolledCount: 40,
		isStale: false,
		schoolId: 1,
		schoolYearId: 2,
		displayOrder: i,
		...s,
	}));

	mockRooms = (opts.rooms ?? []).map((r, i) => {
		const bId = r.buildingId ?? 1;
		const building = buildingById.get(bId) ?? { id: bId, name: `Building ${bId}`, gradeScope: [], schoolId: 1, isTeachingBuilding: true, shortCode: null };
		return {
			id: i + 100,
			name: `Room ${i + 100}`,
			capacity: 45,
			buildingId: bId,
			floor: 1,
			floorPosition: i,
			isTeachingSpace: true,
			buildingZoneId: null,
			building,
			...r,
		};
	});
}

function mockPrisma() {
	return createMockPrisma();
}

// ── Tests ──

test('preview does not write', async () => {
	setupMock({
		sections: [{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: null }],
		rooms: [{ id: 100, name: 'R100', buildingId: 1 }],
		buildings: [{ id: 1, name: 'B1', gradeScope: [] }],
	});

	const result = await computeAutoAssign({ schoolId: 1, schoolYearId: 2, mode: 'preview', prisma: mockPrisma() });

	assert.equal(applyCalled, false, 'Preview must not call sectionMirror.update');
	assert.equal(result.counts.applied, 0, 'Preview applied count is 0');
	const section = mockSections.find((s) => s.externalId === 1);
	assert.equal(section?.homeRoomId, null, 'Section homeRoomId unchanged after preview');
});

test('apply writes the same assignments returned by preview', async () => {
	const mkData = () => ({
		sections: [
			{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: null },
			{ externalId: 2, name: 'S2', gradeLevelName: 'Grade 8', homeRoomId: null },
		] as Partial<MockSection>[],
		rooms: [
			{ id: 100, name: 'R100', buildingId: 1 },
			{ id: 101, name: 'R101', buildingId: 1 },
		] as Partial<MockRoom>[],
		buildings: [{ id: 1, name: 'B1', gradeScope: [] }],
	});

	setupMock(mkData());
	const preview = await computeAutoAssign({ schoolId: 1, schoolYearId: 2, mode: 'preview', prisma: mockPrisma() });

	setupMock(mkData());
	const apply = await computeAutoAssign({ schoolId: 1, schoolYearId: 2, mode: 'apply', prisma: mockPrisma() });

	assert.equal(preview.assignments.length, apply.assignments.length, 'Preview and apply assign same count');
	assert.equal(apply.counts.applied, 2, 'Apply writes 2 assignments');
	const s1 = mockSections.find((s) => s.externalId === 1);
	assert.notEqual(s1?.homeRoomId, null, 'Section 1 has homeRoomId after apply');
});

test('existing home rooms are preserved by default', async () => {
	setupMock({
		sections: [
			{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: 100 },
			{ externalId: 2, name: 'S2', gradeLevelName: 'Grade 7', homeRoomId: null },
		],
		rooms: [
			{ id: 100, name: 'R100', buildingId: 1 },
			{ id: 101, name: 'R101', buildingId: 1 },
		],
		buildings: [{ id: 1, name: 'B1', gradeScope: [] }],
	});

	const result = await computeAutoAssign({ schoolId: 1, schoolYearId: 2, mode: 'preview', overwriteExisting: false, prisma: mockPrisma() });

	assert.equal(result.counts.existingPreserved, 1, '1 existing preserved');
	assert.equal(result.counts.sectionsConsidered, 1, '1 section considered');
	assert.ok(result.assignments.every((a) => a.sectionId !== 1), 'Section 1 not reassigned');
});

test('overwriteExisting=true can reassign', async () => {
	setupMock({
		sections: [{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: 100 }],
		rooms: [
			{ id: 100, name: 'R100', buildingId: 1 },
			{ id: 101, name: 'R101', buildingId: 1 },
		],
		buildings: [{ id: 1, name: 'B1', gradeScope: [] }],
	});

	const result = await computeAutoAssign({ schoolId: 1, schoolYearId: 2, mode: 'preview', overwriteExisting: true, prisma: mockPrisma() });

	assert.equal(result.counts.sectionsConsidered, 1, 'Existing section considered with overwrite');
	assert.equal(result.counts.existingPreserved, 0, 'No sections preserved with overwrite');
	assert.ok(result.assignments.length >= 1, 'Section reassigned');
});

test('grade-scoped buildings are preferred', async () => {
	setupMock({
		sections: [{ externalId: 1, name: 'G7S1', gradeLevelName: 'Grade 7', homeRoomId: null }],
		rooms: [
			{ id: 100, name: 'G7Room', buildingId: 1 },
			{ id: 101, name: 'AnyRoom', buildingId: 2 },
		],
		buildings: [
			{ id: 1, name: 'G7 Wing', gradeScope: [7] },
			{ id: 2, name: 'Any Wing', gradeScope: [] },
		],
	});

	const result = await computeAutoAssign({ schoolId: 1, schoolYearId: 2, mode: 'preview', prisma: mockPrisma() });

	assert.equal(result.assignments.length, 1, '1 assignment made');
	assert.equal(result.assignments[0].buildingName, 'G7 Wing', 'Grade-scoped building preferred');
	assert.equal(result.assignments[0].reason, 'GRADE_SCOPE_MATCH', 'Reason is GRADE_SCOPE_MATCH');
});

test('cross-grade scoped buildings are blocked by default', async () => {
	setupMock({
		sections: [{ externalId: 1, name: 'G7S1', gradeLevelName: 'Grade 7', homeRoomId: null }],
		rooms: [{ id: 100, name: 'G8Room', buildingId: 1 }],
		buildings: [{ id: 1, name: 'G8 Wing', gradeScope: [8] }],
	});

	const result = await computeAutoAssign({ schoolId: 1, schoolYearId: 2, mode: 'preview', allowCrossGradeFallback: false, prisma: mockPrisma() });

	assert.equal(result.assignments.length, 0, 'No assignments without fallback');
	assert.equal(result.skipped.length, 1, 'Section skipped');
	assert.equal(result.skipped[0].reason, 'NO_GRADE_MATCHING_ROOM', 'Skip reason');
});

test('cross-grade fallback works when enabled', async () => {
	setupMock({
		sections: [{ externalId: 1, name: 'G7S1', gradeLevelName: 'Grade 7', homeRoomId: null }],
		rooms: [{ id: 100, name: 'G8Room', buildingId: 1 }],
		buildings: [{ id: 1, name: 'G8 Wing', gradeScope: [8] }],
	});

	const result = await computeAutoAssign({ schoolId: 1, schoolYearId: 2, mode: 'preview', allowCrossGradeFallback: true, prisma: mockPrisma() });

	assert.equal(result.assignments.length, 1, 'Assignment made with fallback');
	assert.equal(result.assignments[0].reason, 'ANY_GRADE_FALLBACK', 'Reason is ANY_GRADE_FALLBACK');
});

test('empty gradeScope=[] works as any-grade', async () => {
	setupMock({
		sections: [{ externalId: 1, name: 'G7S1', gradeLevelName: 'Grade 7', homeRoomId: null }],
		rooms: [{ id: 100, name: 'AnyRoom', buildingId: 1 }],
		buildings: [{ id: 1, name: 'Any Wing', gradeScope: [] }],
	});

	const result = await computeAutoAssign({ schoolId: 1, schoolYearId: 2, mode: 'preview', prisma: mockPrisma() });

	assert.equal(result.assignments.length, 1, 'Assignment to any-grade building');
	assert.equal(result.assignments[0].reason, 'ANY_GRADE_FALLBACK', 'Reason is ANY_GRADE_FALLBACK');
});

test('non-teaching buildings are ignored', async () => {
	setupMock({
		sections: [{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: null }],
		rooms: [{ id: 100, name: 'OfficeRoom', buildingId: 1 }],
		buildings: [{ id: 1, name: 'Admin', gradeScope: [], isTeachingBuilding: false }],
	});

	const result = await computeAutoAssign({ schoolId: 1, schoolYearId: 2, mode: 'preview', prisma: mockPrisma() });

	assert.equal(result.assignments.length, 0, 'No assignments from non-teaching building');
	assert.equal(result.skipped.length, 1, 'Section skipped');
});

test('non-teaching rooms are ignored', async () => {
	setupMock({
		sections: [{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: null }],
		rooms: [{ id: 100, name: 'Office', buildingId: 1, isTeachingSpace: false }],
		buildings: [{ id: 1, name: 'B1', gradeScope: [] }],
	});

	const result = await computeAutoAssign({ schoolId: 1, schoolYearId: 2, mode: 'preview', prisma: mockPrisma() });

	assert.equal(result.assignments.length, 0, 'No assignments from non-teaching room');
});

test('duplicate room assignment cannot occur', async () => {
	setupMock({
		sections: [
			{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: null },
			{ externalId: 2, name: 'S2', gradeLevelName: 'Grade 7', homeRoomId: null },
		],
		rooms: [{ id: 100, name: 'OnlyRoom', buildingId: 1 }],
		buildings: [{ id: 1, name: 'B1', gradeScope: [] }],
	});

	const result = await computeAutoAssign({ schoolId: 1, schoolYearId: 2, mode: 'preview', prisma: mockPrisma() });

	const roomIds = result.assignments.map((a) => a.homeRoomId);
	assert.equal(roomIds.length, new Set(roomIds).size, 'No duplicate room IDs');
	assert.equal(result.assignments.length, 1, 'Only 1 of 2 sections assigned');
	assert.equal(result.skipped.length, 1, '1 section skipped');
});

test('skipped sections include stable reasons', async () => {
	setupMock({
		sections: [{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: null }],
		rooms: [],
		buildings: [],
	});

	const result = await computeAutoAssign({ schoolId: 1, schoolYearId: 2, mode: 'preview', prisma: mockPrisma() });

	assert.equal(result.skipped.length, 1, 'Section skipped');
	assert.ok(typeof result.skipped[0].reason === 'string' && result.skipped[0].reason.length > 0, 'Skip reason is non-empty string');
	assert.equal(result.skipped[0].sectionId, 1, 'Skip references correct section');
});

test('capacity: too-small room returns ROOM_CAPACITY_TOO_SMALL', async () => {
	setupMock({
		sections: [{ externalId: 1, name: 'BigClass', gradeLevelName: 'Grade 7', homeRoomId: null, enrolledCount: 50 }],
		rooms: [{ id: 100, name: 'SmallRoom', buildingId: 1, capacity: 30 }],
		buildings: [{ id: 1, name: 'B1', gradeScope: [] }],
	});

	const result = await computeAutoAssign({ schoolId: 1, schoolYearId: 2, mode: 'preview', prisma: mockPrisma() });

	assert.equal(result.assignments.length, 0, 'No assignment for oversized section');
	assert.equal(result.skipped.length, 1, 'Section skipped');
	assert.equal(result.skipped[0].reason, 'ROOM_CAPACITY_TOO_SMALL', 'Reason is ROOM_CAPACITY_TOO_SMALL');
});

test('capacity: null-capacity room is eligible', async () => {
	setupMock({
		sections: [{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: null, enrolledCount: 50 }],
		rooms: [{ id: 100, name: 'UnknownCap', buildingId: 1, capacity: null }],
		buildings: [{ id: 1, name: 'B1', gradeScope: [] }],
	});

	const result = await computeAutoAssign({ schoolId: 1, schoolYearId: 2, mode: 'preview', prisma: mockPrisma() });

	assert.equal(result.assignments.length, 1, 'Room with null capacity is eligible');
});

test('capacity: sufficient room is assigned', async () => {
	setupMock({
		sections: [{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: null, enrolledCount: 40 }],
		rooms: [{ id: 100, name: 'BigRoom', buildingId: 1, capacity: 45 }],
		buildings: [{ id: 1, name: 'B1', gradeScope: [] }],
	});

	const result = await computeAutoAssign({ schoolId: 1, schoolYearId: 2, mode: 'preview', prisma: mockPrisma() });

	assert.equal(result.assignments.length, 1, 'Sufficient capacity room assigned');
});

test('grade-scope per grade: all 4 grades match correctly', async () => {
	setupMock({
		sections: [
			{ externalId: 1, name: 'G7', gradeLevelName: 'Grade 7', homeRoomId: null },
			{ externalId: 2, name: 'G8', gradeLevelName: 'Grade 8', homeRoomId: null },
			{ externalId: 3, name: 'G9', gradeLevelName: 'Grade 9', homeRoomId: null },
			{ externalId: 4, name: 'G10', gradeLevelName: 'Grade 10', homeRoomId: null },
		],
		rooms: [
			{ id: 100, name: 'G7R', buildingId: 1 },
			{ id: 101, name: 'G8R', buildingId: 2 },
			{ id: 102, name: 'G9R', buildingId: 3 },
			{ id: 103, name: 'G10R', buildingId: 4 },
		],
		buildings: [
			{ id: 1, name: 'G7 Wing', gradeScope: [7] },
			{ id: 2, name: 'G8 Wing', gradeScope: [8] },
			{ id: 3, name: 'G9 Wing', gradeScope: [9] },
			{ id: 4, name: 'G10 Wing', gradeScope: [10] },
		],
	});

	const result = await computeAutoAssign({ schoolId: 1, schoolYearId: 2, mode: 'preview', prisma: mockPrisma() });

	assert.equal(result.assignments.length, 4, 'All 4 sections assigned');
	for (const a of result.assignments) {
		assert.equal(a.reason, 'GRADE_SCOPE_MATCH', `${a.sectionName} uses GRADE_SCOPE_MATCH`);
	}
	const g7 = result.assignments.find((a) => a.sectionId === 1);
	const g8 = result.assignments.find((a) => a.sectionId === 2);
	const g9 = result.assignments.find((a) => a.sectionId === 3);
	const g10 = result.assignments.find((a) => a.sectionId === 4);
	assert.equal(g7?.buildingName, 'G7 Wing', 'G7 goes to G7 Wing');
	assert.equal(g8?.buildingName, 'G8 Wing', 'G8 goes to G8 Wing');
	assert.equal(g9?.buildingName, 'G9 Wing', 'G9 goes to G9 Wing');
	assert.equal(g10?.buildingName, 'G10 Wing', 'G10 goes to G10 Wing');
});
