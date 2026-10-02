import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_FLAG_HGP_OVERLAYS, projectFlagHgpOverlays } from '../FlagHgpOverlaySettings';

test('P07 projects exactly two scoped Flag/HGP rows and treats missing rows as disabled drafts', () => {
	const rows = projectFlagHgpOverlays([]);
	assert.deepEqual(rows.map(({ gradeGroup, enabled }) => ({ gradeGroup, enabled })), [
		{ gradeGroup: '7-8', enabled: false },
		{ gradeGroup: '9-10', enabled: false },
	]);
	assert.equal(rows.length, 2);
	assert.deepEqual(rows, DEFAULT_FLAG_HGP_OVERLAYS);
});

test('P07 projects each scope independently and ignores global and unrelated event rows', () => {
	const rows = projectFlagHgpOverlays([
		{ eventType: 'FLAG_OR_HGP', gradeGroup: null, programType: null, startTime: '07:00', endTime: '07:30', enabled: true },
		{ eventType: 'FLAG_OR_HGP', gradeGroup: '7-8', programType: null, startTime: '06:50', endTime: '07:20', enabled: true },
		{ eventType: 'LUNCH_BREAK', gradeGroup: '9-10', programType: null, startTime: '12:00', endTime: '13:00', enabled: true },
	]);
	assert.deepEqual(rows, [
		{ gradeGroup: '7-8', enabled: true, startTime: '06:50', endTime: '07:20' },
		{ gradeGroup: '9-10', enabled: false, startTime: '12:15', endTime: '13:00' },
	]);
});
