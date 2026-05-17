import {
	buildTimetableShapeContract,
	buildUnionClassPeriodSlots,
	constructBaseline,
	type ConstructorInput,
} from '../services/schedule-constructor.js';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`  OK ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  FAIL ${label}`);
}

function buildInput(): ConstructorInput {
	const regularShape = buildTimetableShapeContract({
		gradeLevel: 7,
		programType: 'REGULAR',
		startTime: '07:30',
		endTime: '12:30',
		periodLengthMinutes: 50,
		periodsPerDay: 4,
		basePolicy: {
			maxConsecutiveTeachingMinutesBeforeBreak: 180,
			minBreakMinutesAfterConsecutiveBlock: 20,
			maxTeachingMinutesPerDay: 420,
			earliestStartTime: '07:30',
			latestEndTime: '12:30',
			enableLunchWindow: false,
			enableFlagCeremony: false,
			enableRecess: false,
		},
	});
	const steShape = buildTimetableShapeContract({
		gradeLevel: 7,
		programType: 'STE',
		startTime: '08:00',
		endTime: '12:00',
		periodLengthMinutes: 40,
		periodsPerDay: 5,
		basePolicy: {
			maxConsecutiveTeachingMinutesBeforeBreak: 180,
			minBreakMinutesAfterConsecutiveBlock: 20,
			maxTeachingMinutesPerDay: 420,
			earliestStartTime: '08:00',
			latestEndTime: '12:00',
			enableLunchWindow: false,
			enableFlagCeremony: false,
			enableRecess: false,
		},
	});

	return {
		schoolId: 1,
		schoolYearId: 1,
		roomingStrategy: 'UNIVERSAL',
		sectionsByGrade: [
			{
				gradeLevelId: 7,
				gradeLevelName: 'Grade 7',
				displayOrder: 7,
				sections: [
					{
						id: 101,
						name: 'G7 Regular',
						maxCapacity: 40,
						enrolledCount: 30,
						gradeLevelId: 7,
						gradeLevelName: 'Grade 7',
						displayOrder: 7,
						homeRoomId: null,
						buildingZoneId: null,
						programType: 'REGULAR',
						programCode: 'REG',
						programName: 'Regular',
						isSpecialProgram: false,
					},
					{
						id: 102,
						name: 'G7 STE',
						maxCapacity: 40,
						enrolledCount: 30,
						gradeLevelId: 7,
						gradeLevelName: 'Grade 7',
						displayOrder: 7,
						homeRoomId: null,
						buildingZoneId: null,
						programType: 'STE',
						programCode: 'STE',
						programName: 'STE',
						isSpecialProgram: true,
					},
				],
			},
		],
		subjects: [
			{
				id: 501,
				code: 'SCI',
				name: 'Science',
				minMinutesPerWeek: 80,
				preferredRoomType: 'CLASSROOM',
				sessionPattern: 'ANY',
				gradeLevels: [7],
			},
		],
		cohorts: [],
		faculty: [
			{ id: 1001, maxHoursPerWeek: 30 },
			{ id: 1002, maxHoursPerWeek: 30 },
		],
		facultySubjects: [
			{ facultyId: 1001, subjectId: 501, gradeLevels: [7], sectionIds: [101] },
			{ facultyId: 1002, subjectId: 501, gradeLevels: [7], sectionIds: [102] },
		],
		rooms: [
			{ id: 1, type: 'CLASSROOM', isTeachingSpace: true, capacity: 50 },
			{ id: 2, type: 'CLASSROOM', isTeachingSpace: true, capacity: 50 },
		],
		preferences: [],
		policy: {
			maxConsecutiveTeachingMinutesBeforeBreak: 180,
			minBreakMinutesAfterConsecutiveBlock: 20,
			maxTeachingMinutesPerDay: 420,
			earliestStartTime: '07:30',
			latestEndTime: '12:30',
			enableLunchWindow: false,
			enableFlagCeremony: false,
			enableRecess: false,
		},
		classTemplatePeriods: {
			REGULAR: 50,
			STE: 40,
		},
		timetableShapes: [regularShape, steShape],
	};
}

function run() {
	console.log('\n=== PHASE2-TIMETABLE-SHAPE-CONTRACT ===');
	const input = buildInput();
	const regularShape = input.timetableShapes?.find((shape) => shape.programType === 'REGULAR');
	const steShape = input.timetableShapes?.find((shape) => shape.programType === 'STE');

	assert(Boolean(regularShape && steShape), 'shape contracts created for REGULAR and STE');
	assert(regularShape?.periodSlots.length !== steShape?.periodSlots.length, 'shape contracts expose different grids by program');

	const unionSlots = buildUnionClassPeriodSlots(input.timetableShapes);
	assert(unionSlots.length >= Math.max(regularShape?.periodSlots.length ?? 0, steShape?.periodSlots.length ?? 0), 'union class slots preserves distinct program grids');

	const result = constructBaseline(input);
	const regularEntries = result.entries.filter((entry) => entry.sectionId === 101);
	const steEntries = result.entries.filter((entry) => entry.sectionId === 102);
	assert(regularEntries.length > 0, 'regular section receives assignments');
	assert(steEntries.length > 0, 'STE section receives assignments');

	const regularSlotKeys = new Set((regularShape?.periodSlots ?? []).map((slot) => `${slot.startTime}-${slot.endTime}`));
	const steSlotKeys = new Set((steShape?.periodSlots ?? []).map((slot) => `${slot.startTime}-${slot.endTime}`));
	assert(
		regularEntries.every((entry) => regularSlotKeys.has(`${entry.startTime}-${entry.endTime}`)),
		'regular section assignments remain inside REGULAR shape slots',
	);
	assert(
		steEntries.every((entry) => steSlotKeys.has(`${entry.startTime}-${entry.endTime}`)),
		'STE section assignments remain inside STE shape slots',
	);

	console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
	if (failCount > 0) {
		process.exitCode = 1;
	}
}

run();
