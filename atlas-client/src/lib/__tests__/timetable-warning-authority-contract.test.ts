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
import { UNLABELLED_RULE_SENTENCE } from '../../lib/timetable-plain-language';
import {
	isBlockingHardViolation,
	isInformationalHardViolation,
} from '../../components/timetable/simplePublishReadiness';
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
	// J2J3-RECONCILE (B1): this row used to pin the de-snake-cased string
	// 'some future code'. That string is the engine token with underscores
	// replaced: it adds no meaning and reads on screen as a label ATLAS wrote
	// for a rule it cannot name. The shared degradation rule is now
	// absent -> em dash, known -> its one canonical label, unmapped -> the one
	// honest sentence, so the readable degradation is that sentence. The legacy
	// map still wins over it, which the next assertion pins.
	assert.equal(resolveViolationLabel(unknown), UNLABELLED_RULE_SENTENCE);
	// The rule is "readable", not merely non-throwing, and it must never be a
	// de-snake-cased token again.
	assert.doesNotMatch(resolveViolationLabel(unknown), /some future code/i);
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
	// Filtering preserves the server's violation ordering (display conservation).
	const ordered = [
		violation({ code: 'ROOM_TIME_CONFLICT' }),
		violation({ code: 'ROOM_FEATURE_MISMATCH' }),
		violation({ code: 'FACULTY_FLOOR_TRANSITION' }),
	];
	assert.deepEqual(
		ordered.filter((v) => matchesViolationSearch(v, '')).map((v) => v.code),
		['ROOM_TIME_CONFLICT', 'ROOM_FEATURE_MISMATCH', 'FACULTY_FLOOR_TRANSITION'],
	);
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
			runWide: { total: 4, hard: 3, blockingHard: 2, soft: 1, byCode: { FACULTY_TIME_CONFLICT: 2 } },
		},
	};
	assert.equal(resolveHardViolationCount(report, displayed), 2, 'the gate must use the allowlist-filtered run-wide count');
	assert.equal(resolveHardViolationCount(null, displayed), 0, 'fallback uses the display list when runWide is absent');
	assert.equal(resolveHardViolationCount({ counts: {} }, displayed), 0);
	// A legacy payload without blockingHard falls back to the unfiltered run-wide hard count (fail-closed).
	assert.equal(resolveHardViolationCount({ counts: { runWide: { hard: 3 } } }, displayed), 3);
	const withDisplayedHard = [...displayed, violation({ code: 'ROOM_TIME_CONFLICT', severity: 'HARD' })];
	assert.equal(resolveHardViolationCount(null, withDisplayedHard), 1);
});

test('F2: non-allowlisted HARD codes are informational, never publish blockers', () => {
	const retired = violation({ code: 'FACULTY_EXCESSIVE_TRAVEL_DISTANCE', severity: 'HARD' });
	const structural = violation({ code: 'ROOM_TIME_CONFLICT', severity: 'HARD' });
	const soft = violation({ code: 'FACULTY_FLOOR_TRANSITION', severity: 'SOFT' });
	assert.equal(isBlockingHardViolation(structural), true);
	assert.equal(isBlockingHardViolation(retired), false, 'a retired metric HARD must not block publish');
	assert.equal(isBlockingHardViolation(soft), false);
	assert.equal(isInformationalHardViolation(retired), true);
	assert.equal(isInformationalHardViolation(structural), false);
	assert.equal(isInformationalHardViolation(soft), false);
});

test('R7 source control: the rail search and gate no longer index the label map unguarded', () => {
	const source = readFileSync(resolve(clientRoot, 'src/hooks/useTimetableData.ts'), 'utf8');
	assert.equal(/VIOLATION_LABELS\[v\.code\]/.test(source), false, 'the unguarded label index must be removed');
	assert.ok(source.includes('resolveViolationLabel'), 'the guarded resolver must be used');
	assert.ok(source.includes('resolveHardViolationCount'), 'the run-wide gate resolver must be used');
});
