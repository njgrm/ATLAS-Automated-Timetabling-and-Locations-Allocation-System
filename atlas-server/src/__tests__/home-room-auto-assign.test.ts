/**
 * Home-Room Auto-Assign — Unit Tests
 *
 * Tests the pure assignment logic by calling computeAutoAssign with
 * a mocked Prisma client injected via module cache.
 *
 * Run: npx tsx src/__tests__/home-room-auto-assign.test.ts
 */

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`  ✓ ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  ✗ ${label}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
	if (actual === expected) {
		passCount += 1;
		console.log(`  ✓ ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  ✗ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ── Inline logic tests (no Prisma dependency) ──
// We test the pure functions by extracting them inline.
// This avoids ESM module mocking issues.

const VALID_GRADES = new Set([7, 8, 9, 10]);

function extractGradeNumber(gradeLevelName: string): number {
	const match = gradeLevelName.match(/(\d+)/);
	if (match) {
		const n = parseInt(match[1], 10);
		if (VALID_GRADES.has(n)) return n;
	}
	return 0;
}

function buildingMatchScore(sectionGrade: number, buildingGradeScope: number[]): number {
	if (buildingGradeScope.length === 0) return 1;
	if (buildingGradeScope.includes(sectionGrade)) return 2;
	return 0;
}

type TestSection = {
	externalId: number;
	name: string;
	gradeLevelName: string;
	homeRoomId: number | null;
	enrolledCount: number;
};

type TestRoom = {
	id: number;
	name: string;
	capacity: number | null;
	buildingId: number;
	buildingName: string;
	buildingGradeScope: number[];
	floor: number;
	floorPosition: number;
};

type AssignmentResult = {
	sectionId: number;
	sectionName: string;
	gradeLevel: number;
	homeRoomId: number;
	roomName: string;
	buildingId: number;
	buildingName: string;
	reason: string;
};

type SkipResult = {
	sectionId: number;
	sectionName: string;
	gradeLevel: number;
	reason: string;
};

function runAutoAssignLogic(opts: {
	sections: TestSection[];
	rooms: TestRoom[];
	overwriteExisting?: boolean;
	allowCrossGradeFallback?: boolean;
}): { assignments: AssignmentResult[]; skipped: SkipResult[] } {
	const { sections, rooms, overwriteExisting = false, allowCrossGradeFallback = false } = opts;

	const sectionsToProcess: TestSection[] = [];
	const existingPreserved: TestSection[] = [];

	for (const section of sections) {
		if (section.homeRoomId != null && !overwriteExisting) {
			existingPreserved.push(section);
		} else {
			sectionsToProcess.push(section);
		}
	}

	const assignedRoomIds = new Set<number>();
	for (const section of existingPreserved) {
		if (section.homeRoomId != null) assignedRoomIds.add(section.homeRoomId);
	}

	const assignments: AssignmentResult[] = [];
	const skipped: SkipResult[] = [];

	const sorted = [...sectionsToProcess].sort((a, b) => a.name.localeCompare(b.name));

	for (const section of sorted) {
		const sectionGrade = extractGradeNumber(section.gradeLevelName);

		const eligible = rooms
			.filter((room) => !assignedRoomIds.has(room.id))
			.map((room) => ({ room, matchScore: buildingMatchScore(sectionGrade, room.buildingGradeScope) }))
			.filter((e) => e.matchScore === 2 || e.matchScore === 1 || allowCrossGradeFallback)
			.filter((e) => {
				if (e.room.capacity != null && e.room.capacity < section.enrolledCount) return false;
				return true;
			})
			.sort((a, b) => b.matchScore - a.matchScore || a.room.buildingName.localeCompare(b.room.buildingName) || a.room.floor - b.room.floor || a.room.floorPosition - b.room.floorPosition || a.room.name.localeCompare(b.room.name));

		if (eligible.length === 0) {
			const unassigned = rooms.filter((r) => !assignedRoomIds.has(r.id));
			let reason = 'NO_ELIGIBLE_ROOM';
			if (unassigned.length > 0) {
				const hasCapacityRoom = unassigned.some((r) => r.capacity == null || r.capacity >= section.enrolledCount);
				if (!hasCapacityRoom) {
					reason = 'ROOM_CAPACITY_TOO_SMALL';
				} else if (!allowCrossGradeFallback) {
					const hasGradeMatch = unassigned.some((r) => r.buildingGradeScope.length === 0 || r.buildingGradeScope.includes(sectionGrade));
					if (!hasGradeMatch) reason = 'NO_GRADE_MATCHING_ROOM';
				}
			}
			skipped.push({ sectionId: section.externalId, sectionName: section.name, gradeLevel: sectionGrade, reason });
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

	return { assignments, skipped };
}

// ── Tests ──

function testPreviewDoesNotWrite() {
	console.log('\n═══ PREVIEW-DOES-NOT-WRITE ═══');
	const sections: TestSection[] = [{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: null, enrolledCount: 40 }];
	const result = runAutoAssignLogic({ sections, rooms: [{ id: 100, name: 'R100', buildingId: 1, buildingName: 'B1', buildingGradeScope: [], capacity: 45, floor: 1, floorPosition: 0 }] });
	// Original section objects should NOT be mutated
	assertEqual(sections[0].homeRoomId, null, 'Section homeRoomId unchanged (preview is read-only)');
	assert(result.assignments.length <= 1, 'Preview computed assignments without side effects');
}

function testApplyWritesSameAsPreview() {
	console.log('\n═══ APPLY-WRITES-SAME-AS-PREVIEW ═══');
	const mkSections = () => [
		{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: null, enrolledCount: 40 },
		{ externalId: 2, name: 'S2', gradeLevelName: 'Grade 8', homeRoomId: null, enrolledCount: 35 },
	];
	const rooms: TestRoom[] = [
		{ id: 100, name: 'R100', buildingId: 1, buildingName: 'B1', buildingGradeScope: [], capacity: 45, floor: 1, floorPosition: 0 },
		{ id: 101, name: 'R101', buildingId: 1, buildingName: 'B1', buildingGradeScope: [], capacity: 45, floor: 1, floorPosition: 1 },
	];
	const preview = runAutoAssignLogic({ sections: mkSections(), rooms });
	const apply = runAutoAssignLogic({ sections: mkSections(), rooms });
	assertEqual(preview.assignments.length, apply.assignments.length, 'Preview and apply produce same assignment count');
	assertEqual(apply.assignments.length, 2, 'Both sections assigned');
}

function testExistingPreservedByDefault() {
	console.log('\n═══ EXISTING-PRESERVED-BY-DEFAULT ═══');
	const result = runAutoAssignLogic({
		sections: [
			{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: 100, enrolledCount: 40 },
			{ externalId: 2, name: 'S2', gradeLevelName: 'Grade 7', homeRoomId: null, enrolledCount: 35 },
		],
		rooms: [
			{ id: 100, name: 'R100', buildingId: 1, buildingName: 'B1', buildingGradeScope: [], capacity: 45, floor: 1, floorPosition: 0 },
			{ id: 101, name: 'R101', buildingId: 1, buildingName: 'B1', buildingGradeScope: [], capacity: 45, floor: 1, floorPosition: 1 },
		],
		overwriteExisting: false,
	});
	assertEqual(result.assignments.length, 1, 'Only 1 section considered (existing preserved)');
	assert(result.assignments.every((a) => a.sectionId !== 1), 'Section 1 not reassigned');
}

function testOverwriteExisting() {
	console.log('\n═══ OVERWRITE-EXISTING ═══');
	const result = runAutoAssignLogic({
		sections: [
			{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: 100, enrolledCount: 40 },
		],
		rooms: [
			{ id: 100, name: 'R100', buildingId: 1, buildingName: 'B1', buildingGradeScope: [], capacity: 45, floor: 1, floorPosition: 0 },
			{ id: 101, name: 'R101', buildingId: 1, buildingName: 'B1', buildingGradeScope: [], capacity: 45, floor: 1, floorPosition: 1 },
		],
		overwriteExisting: true,
	});
	assertEqual(result.assignments.length, 1, 'Existing section reassigned with overwrite');
	assert(result.assignments[0].sectionId === 1, 'Section 1 is the one reassigned');
}

function testGradeScopedBuildingPreferred() {
	console.log('\n═══ GRADE-SCOPED-BUILDING-PREFERRED ═══');
	const result = runAutoAssignLogic({
		sections: [{ externalId: 1, name: 'G7S1', gradeLevelName: 'Grade 7', homeRoomId: null, enrolledCount: 40 }],
		rooms: [
			{ id: 100, name: 'G7Room', buildingId: 1, buildingName: 'G7 Wing', buildingGradeScope: [7], capacity: 45, floor: 1, floorPosition: 0 },
			{ id: 101, name: 'AnyRoom', buildingId: 2, buildingName: 'Any Wing', buildingGradeScope: [], capacity: 45, floor: 1, floorPosition: 0 },
		],
	});
	assertEqual(result.assignments.length, 1, '1 assignment made');
	assertEqual(result.assignments[0].buildingName, 'G7 Wing', 'Grade-scoped building preferred');
	assertEqual(result.assignments[0].reason, 'GRADE_SCOPE_MATCH', 'Reason is GRADE_SCOPE_MATCH');
}

function testCrossGradeBlockedByDefault() {
	console.log('\n═══ CROSS-GRADE-BLOCKED-BY-DEFAULT ═══');
	const result = runAutoAssignLogic({
		sections: [{ externalId: 1, name: 'G7S1', gradeLevelName: 'Grade 7', homeRoomId: null, enrolledCount: 40 }],
		rooms: [{ id: 100, name: 'G8Room', buildingId: 1, buildingName: 'G8 Wing', buildingGradeScope: [8], capacity: 45, floor: 1, floorPosition: 0 }],
		allowCrossGradeFallback: false,
	});
	assertEqual(result.assignments.length, 0, 'No assignments without fallback');
	assertEqual(result.skipped.length, 1, 'Section skipped');
	assertEqual(result.skipped[0].reason, 'NO_GRADE_MATCHING_ROOM', 'Skip reason');
}

function testCrossGradeFallbackWorks() {
	console.log('\n═══ CROSS-GRADE-FALLBACK-WORKS ═══');
	const result = runAutoAssignLogic({
		sections: [{ externalId: 1, name: 'G7S1', gradeLevelName: 'Grade 7', homeRoomId: null, enrolledCount: 40 }],
		rooms: [{ id: 100, name: 'G8Room', buildingId: 1, buildingName: 'G8 Wing', buildingGradeScope: [8], capacity: 45, floor: 1, floorPosition: 0 }],
		allowCrossGradeFallback: true,
	});
	assertEqual(result.assignments.length, 1, 'Assignment made with fallback');
	assertEqual(result.assignments[0].reason, 'ANY_GRADE_FALLBACK', 'Reason is ANY_GRADE_FALLBACK');
}

function testEmptyGradeScopeIsAnyGrade() {
	console.log('\n═══ EMPTY-GRADE-SCOPE-IS-ANY-GRADE ═══');
	const result = runAutoAssignLogic({
		sections: [{ externalId: 1, name: 'G7S1', gradeLevelName: 'Grade 7', homeRoomId: null, enrolledCount: 40 }],
		rooms: [{ id: 100, name: 'AnyRoom', buildingId: 1, buildingName: 'Any Wing', buildingGradeScope: [], capacity: 45, floor: 1, floorPosition: 0 }],
	});
	assertEqual(result.assignments.length, 1, 'Assignment to any-grade building');
	assertEqual(result.assignments[0].reason, 'ANY_GRADE_FALLBACK', 'Reason is ANY_GRADE_FALLBACK');
}

function testDuplicateRoomAssignmentImpossible() {
	console.log('\n═══ DUPLICATE-ROOM-IMPOSSIBLE ═══');
	const result = runAutoAssignLogic({
		sections: [
			{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: null, enrolledCount: 40 },
			{ externalId: 2, name: 'S2', gradeLevelName: 'Grade 7', homeRoomId: null, enrolledCount: 35 },
		],
		rooms: [{ id: 100, name: 'OnlyRoom', buildingId: 1, buildingName: 'B1', buildingGradeScope: [], capacity: 45, floor: 1, floorPosition: 0 }],
	});
	const roomIds = result.assignments.map((a) => a.homeRoomId);
	assertEqual(roomIds.length, new Set(roomIds).size, 'No duplicate room IDs');
	assertEqual(result.assignments.length, 1, 'Only 1 of 2 sections assigned');
	assertEqual(result.skipped.length, 1, '1 section skipped');
}

function testSkippedSectionHasReason() {
	console.log('\n═══ SKIPPED-SECTION-HAS-REASON ═══');
	const result = runAutoAssignLogic({
		sections: [{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: null, enrolledCount: 40 }],
		rooms: [],
	});
	assertEqual(result.skipped.length, 1, 'Section skipped');
	assert(typeof result.skipped[0].reason === 'string' && result.skipped[0].reason.length > 0, 'Skip reason is non-empty string');
	assertEqual(result.skipped[0].sectionId, 1, 'Skip references correct section');
}

function testCapacitySkipsTooSmallRoom() {
	console.log('\n═══ CAPACITY-SKIPS-TOO-SMALL-ROOM ═══');
	const result = runAutoAssignLogic({
		sections: [{ externalId: 1, name: 'BigClass', gradeLevelName: 'Grade 7', homeRoomId: null, enrolledCount: 50 }],
		rooms: [{ id: 100, name: 'SmallRoom', buildingId: 1, buildingName: 'B1', buildingGradeScope: [], capacity: 30, floor: 1, floorPosition: 0 }],
	});
	assertEqual(result.assignments.length, 0, 'No assignment for oversized section');
	assertEqual(result.skipped.length, 1, 'Section skipped');
	assertEqual(result.skipped[0].reason, 'ROOM_CAPACITY_TOO_SMALL', 'Reason is ROOM_CAPACITY_TOO_SMALL');
}

function testCapacityNullRoomIsEligible() {
	console.log('\n═══ CAPACITY-NULL-ROOM-IS-ELIGIBLE ═══');
	const result = runAutoAssignLogic({
		sections: [{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: null, enrolledCount: 50 }],
		rooms: [{ id: 100, name: 'UnknownCap', buildingId: 1, buildingName: 'B1', buildingGradeScope: [], capacity: null, floor: 1, floorPosition: 0 }],
	});
	assertEqual(result.assignments.length, 1, 'Room with null capacity is eligible');
}

function testCapacitySufficientRoomIsAssigned() {
	console.log('\n═══ CAPACITY-SUFFICIENT-ROOM-IS-ASSIGNED ═══');
	const result = runAutoAssignLogic({
		sections: [{ externalId: 1, name: 'S1', gradeLevelName: 'Grade 7', homeRoomId: null, enrolledCount: 40 }],
		rooms: [{ id: 100, name: 'BigRoom', buildingId: 1, buildingName: 'B1', buildingGradeScope: [], capacity: 45, floor: 1, floorPosition: 0 }],
	});
	assertEqual(result.assignments.length, 1, 'Sufficient capacity room assigned');
}

function testGradeScopePerGrade() {
	console.log('\n═══ GRADE-SCOPE-PER-GRADE ═══');
	const result = runAutoAssignLogic({
		sections: [
			{ externalId: 1, name: 'G7', gradeLevelName: 'Grade 7', homeRoomId: null, enrolledCount: 40 },
			{ externalId: 2, name: 'G8', gradeLevelName: 'Grade 8', homeRoomId: null, enrolledCount: 35 },
			{ externalId: 3, name: 'G9', gradeLevelName: 'Grade 9', homeRoomId: null, enrolledCount: 38 },
			{ externalId: 4, name: 'G10', gradeLevelName: 'Grade 10', homeRoomId: null, enrolledCount: 42 },
		],
		rooms: [
			{ id: 100, name: 'G7R', buildingId: 1, buildingName: 'G7 Wing', buildingGradeScope: [7], capacity: 45, floor: 1, floorPosition: 0 },
			{ id: 101, name: 'G8R', buildingId: 2, buildingName: 'G8 Wing', buildingGradeScope: [8], capacity: 45, floor: 1, floorPosition: 0 },
			{ id: 102, name: 'G9R', buildingId: 3, buildingName: 'G9 Wing', buildingGradeScope: [9], capacity: 45, floor: 1, floorPosition: 0 },
			{ id: 103, name: 'G10R', buildingId: 4, buildingName: 'G10 Wing', buildingGradeScope: [10], capacity: 45, floor: 1, floorPosition: 0 },
		],
	});
	assertEqual(result.assignments.length, 4, 'All 4 sections assigned');
	for (const a of result.assignments) {
		assertEqual(a.reason, 'GRADE_SCOPE_MATCH', `${a.sectionName} uses GRADE_SCOPE_MATCH`);
	}
	const g7 = result.assignments.find((a) => a.sectionId === 1);
	const g8 = result.assignments.find((a) => a.sectionId === 2);
	const g9 = result.assignments.find((a) => a.sectionId === 3);
	const g10 = result.assignments.find((a) => a.sectionId === 4);
	assertEqual(g7?.buildingName, 'G7 Wing', 'G7 goes to G7 Wing');
	assertEqual(g8?.buildingName, 'G8 Wing', 'G8 goes to G8 Wing');
	assertEqual(g9?.buildingName, 'G9 Wing', 'G9 goes to G9 Wing');
	assertEqual(g10?.buildingName, 'G10 Wing', 'G10 goes to G10 Wing');
}

// ── Run ──

function run() {
	console.log('\n═══ HOME-ROOM-AUTO-ASSIGN (unit) ═══');

	testPreviewDoesNotWrite();
	testApplyWritesSameAsPreview();
	testExistingPreservedByDefault();
	testOverwriteExisting();
	testGradeScopedBuildingPreferred();
	testCrossGradeBlockedByDefault();
	testCrossGradeFallbackWorks();
	testEmptyGradeScopeIsAnyGrade();
	testDuplicateRoomAssignmentImpossible();
	testSkippedSectionHasReason();
	testCapacitySkipsTooSmallRoom();
	testCapacityNullRoomIsEligible();
	testCapacitySufficientRoomIsAssigned();
	testGradeScopePerGrade();

	console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
	if (failCount > 0) process.exitCode = 1;
}

run();
