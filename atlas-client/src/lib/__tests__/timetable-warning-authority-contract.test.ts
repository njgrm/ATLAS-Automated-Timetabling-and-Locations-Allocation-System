/**
 * TT-WARNING-AUTHORITY-C04 client contract tests (R7).
 *
 * Run: `npx tsx --test src/lib/__tests__/timetable-warning-authority-contract.test.ts`
 *
 * Failing-first controls for the client warning contract: new codes are labelled,
 * an unknown code can never throw the rail search, and the publish gate consumes
 * run-wide hard truth while the displayed rail list stays selected-term scoped.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
	matchesViolationSearch,
	resolveHardViolationCount,
	resolveViolationLabel,
} from '../../hooks/useTimetableData';
import { VIOLATION_LABELS as RAIL_LABELS } from '../../components/timetable/ScheduleReviewWorkspace.constants';
import type { Violation } from '../../types';

const clientRoot = resolve(import.meta.dirname, '../../..');

function violation(overrides: Partial<Violation> & Pick<Violation, 'code'>): Violation {
	return {
		severity: 'SOFT',
		message: 'message',
		schoolId: 1,
		schoolYearId: 1,
		runId: 1,
		entities: {},
		...overrides,
	};
}

test('R7: ROOM_FEATURE_MISMATCH and FACULTY_FLOOR_TRANSITION have labels in every client map', () => {
	assert.equal(typeof RAIL_LABELS.ROOM_FEATURE_MISMATCH, 'string');
	assert.equal(typeof RAIL_LABELS.FACULTY_FLOOR_TRANSITION, 'string');
	assert.equal(resolveViolationLabel('ROOM_FEATURE_MISMATCH'), RAIL_LABELS.ROOM_FEATURE_MISMATCH);
	assert.equal(resolveViolationLabel('FACULTY_FLOOR_TRANSITION'), RAIL_LABELS.FACULTY_FLOOR_TRANSITION);
});

test('R7 (failing-first): an unknown/legacy code never throws and degrades to a readable label', () => {
	const unknown = 'SOME_FUTURE_CODE' as Violation['code'];
	assert.doesNotThrow(() => resolveViolationLabel(unknown));
	assert.equal(resolveViolationLabel(unknown), 'some future code');
	assert.equal(resolveViolationLabel('FACULTY_EXCESSIVE_TRAVEL_DISTANCE'), 'Excessive Travel Distance');
});

test('R7: rail search resolves new labels and tolerates an unknown code', () => {
	assert.equal(matchesViolationSearch(violation({ code: 'ROOM_FEATURE_MISMATCH' }), 'room feature'), true);
	assert.equal(matchesViolationSearch(violation({ code: 'FACULTY_FLOOR_TRANSITION' }), 'cross-floor'), true);
	assert.equal(matchesViolationSearch(violation({ code: 'FACULTY_FLOOR_TRANSITION' }), 'idle'), false);
	const unknown = violation({ code: 'SOME_FUTURE_CODE' as Violation['code'] });
	assert.doesNotThrow(() => matchesViolationSearch(unknown, 'future'));
	assert.equal(matchesViolationSearch(unknown, 'future'), true);
	assert.equal(matchesViolationSearch(violation({ code: 'ROOM_TIME_CONFLICT' }), ''), true);
});

test('R7: the client gate consumes run-wide hard counts while display stays term-scoped', () => {
	const displayed = [
		violation({ code: 'FACULTY_FLOOR_TRANSITION', severity: 'SOFT' }),
		violation({ code: 'FACULTY_EXCESSIVE_IDLE_GAP', severity: 'SOFT' }),
	];
	const report = {
		runId: 1,
		status: 'COMPLETED',
		violations: displayed,
		counts: {
			total: 2,
			byCode: { FACULTY_FLOOR_TRANSITION: 1, FACULTY_EXCESSIVE_IDLE_GAP: 1 },
			scope: 'SELECTED_TERM' as const,
			// Two run-wide HARD conflicts live in an unselected term.
			runWide: { total: 4, hard: 2, soft: 2, byCode: { FACULTY_TIME_CONFLICT: 2 } },
		},
	};
	assert.equal(resolveHardViolationCount(report, displayed), 2, 'the gate must not miss hidden-term hard blockers');
	assert.equal(resolveHardViolationCount(null, displayed), 0, 'fallback uses the display list when runWide is absent');
	assert.equal(resolveHardViolationCount({ counts: {} }, displayed), 0);
	const withDisplayedHard = [...displayed, violation({ code: 'ROOM_TIME_CONFLICT', severity: 'HARD' })];
	assert.equal(resolveHardViolationCount(null, withDisplayedHard), 1);
});

test('R7 source control: the rail search and gate no longer index the label map unguarded', () => {
	const source = readFileSync(resolve(clientRoot, 'src/hooks/useTimetableData.ts'), 'utf8');
	assert.equal(/VIOLATION_LABELS\[v\.code\]/.test(source), false, 'the unguarded label index must be removed');
	assert.ok(source.includes('resolveViolationLabel'), 'the guarded resolver must be used');
	assert.ok(source.includes('resolveHardViolationCount'), 'the run-wide gate resolver must be used');
});
