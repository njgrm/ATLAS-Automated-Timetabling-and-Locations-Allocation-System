import test from 'node:test';
import assert from 'node:assert/strict';

import {
	findRegularSwapCandidate,
	resolveDraftPlacementFromEntry,
	resolvePreGenSlotDisplacement,
} from '@/lib/timetable-swap-routing';
import type { DraftPlacement, ScheduledEntry } from '@/types';

function makePlacement(overrides: Partial<DraftPlacement>): DraftPlacement {
	return {
		id: 1,
		schoolId: 1,
		schoolYearId: 55,
		entryKind: 'SECTION',
		sectionId: 101,
		subjectId: 501,
		facultyId: 1001,
		roomId: 201,
		day: 'MONDAY',
		startTime: '07:30',
		endTime: '08:20',
		cohortCode: null,
		status: 'DRAFT',
		lockedRunId: null,
		notes: null,
		version: 1,
		createdBy: 1,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides,
	};
}

function makeEntry(overrides: Partial<ScheduledEntry>): ScheduledEntry {
	return {
		entryId: 'entry-1',
		facultyId: 1001,
		roomId: 201,
		subjectId: 501,
		sectionId: 101,
		day: 'MONDAY',
		startTime: '07:30',
		endTime: '08:20',
		durationMinutes: 50,
		entryKind: 'SECTION',
		...overrides,
	};
}

test('resolveDraftPlacementFromEntry resolves non-draft-placement id using slot identity in pre-generation', () => {
	const placements = [
		makePlacement({ id: 21, sectionId: 501, subjectId: 701, day: 'WEDNESDAY', startTime: '10:00', endTime: '10:50' }),
	];
	const entry = makeEntry({
		entryId: 'entry-legacy-shape',
		sectionId: 501,
		subjectId: 701,
		day: 'WEDNESDAY',
		startTime: '10:00',
		endTime: '10:50',
	});

	const resolved = resolveDraftPlacementFromEntry(entry, placements);
	assert.equal(resolved?.id, 21);
});

test('resolvePreGenSlotDisplacement reports single occupied-slot displacement for swap prompt', () => {
	const placements = [
		makePlacement({ id: 11, day: 'TUESDAY', startTime: '09:10', endTime: '10:00' }),
		makePlacement({ id: 12, day: 'WEDNESDAY', startTime: '09:10', endTime: '10:00' }),
	];

	const result = resolvePreGenSlotDisplacement(placements, { day: 'TUESDAY', startTime: '09:10', endTime: '10:00' });
	assert.equal(result.kind, 'single');
	assert.equal(result.placement?.id, 11);
});

test('resolvePreGenSlotDisplacement blocks ambiguous multi-occupancy instead of silent overlap fallback', () => {
	const placements = [
		makePlacement({ id: 11, day: 'THURSDAY', startTime: '11:40', endTime: '12:30' }),
		makePlacement({ id: 12, day: 'THURSDAY', startTime: '11:40', endTime: '12:30', sectionId: 102 }),
	];

	const result = resolvePreGenSlotDisplacement(placements, { day: 'THURSDAY', startTime: '11:40', endTime: '12:30' });
	assert.equal(result.kind, 'multiple');
	assert.equal(result.count, 2);
});

test('findRegularSwapCandidate prefers true conflict entity in occupied slot', () => {
	const source = makeEntry({ entryId: 'entry-a', sectionId: 5001, facultyId: 7001, roomId: 9001 });
	const occupants = [
		makeEntry({ entryId: 'entry-b', sectionId: 4000, facultyId: 7100, roomId: 9001 }),
		makeEntry({ entryId: 'entry-c', sectionId: 5001, facultyId: 7200, roomId: 9010 }),
	];

	const candidate = findRegularSwapCandidate(source, occupants);
	assert.equal(candidate?.entryId, 'entry-c');
});
