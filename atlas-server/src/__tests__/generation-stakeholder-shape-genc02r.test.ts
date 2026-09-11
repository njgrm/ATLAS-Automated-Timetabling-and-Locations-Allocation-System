/**
 * GEN-C02R Correction 1 — executable 2026-2027 stakeholder-shape parity.
 *
 * Run: `npx tsx src/__tests__/generation-stakeholder-shape-genc02r.test.ts`
 *
 * Source evidence (read-only, not committed):
 *  - D:/ATLAS/stakeholderFiles/DNO-CLASS-PROGRAM-TEMPLATE-2026-2027.docx
 *  - D:/ATLAS/docs/verification/class-program-policy-baseline-2026-08-29.md
 *
 * These assert the committed canonical class-program contract matches the
 * accepted shift frames and break/lunch exclusions, and that a cross-shift
 * substitution mutant would fail.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { getExpectedCanonicalSlots, validateCanonicalTemplateRows, KNOWN_PROGRAM_TYPES } from '../services/class-program-slot.service.js';
import type { ProgramType } from '@prisma/client';

function minutes(value: string): number {
	const [h, m] = value.split(':').map(Number);
	return h * 60 + m;
}

function slots(grade: number, program: ProgramType) {
	return getExpectedCanonicalSlots(grade, program);
}

test('C1-1. Grade 7 and Grade 8 use only the morning frame and never the afternoon-only rows', () => {
	for (const grade of [7, 8]) {
		for (const program of KNOWN_PROGRAM_TYPES) {
			for (const row of slots(grade, program)) {
				assert.ok(minutes(row.startTime) >= minutes('06:00'), `G${grade} ${program} row ${row.startTime} starts before 06:00`);
				assert.ok(minutes(row.endTime) <= minutes('15:30'), `G${grade} ${program} row ends after the 15:30 morning frame`);
				// The afternoon-only rows (15:15-18:30) never appear in the morning contract.
				assert.ok(minutes(row.startTime) < minutes('15:15'), `G${grade} ${program} uses an afternoon-only row at ${row.startTime}`);
			}
		}
	}
});

test('C1-2. Grade 9 and Grade 10 use only the 09:45–18:30 frame and never the morning rows', () => {
	for (const grade of [9, 10]) {
		for (const program of KNOWN_PROGRAM_TYPES) {
			for (const row of slots(grade, program)) {
				assert.ok(minutes(row.startTime) >= minutes('09:45'), `G${grade} ${program} row ${row.startTime} starts before the 09:45 afternoon frame`);
				assert.ok(minutes(row.endTime) <= minutes('18:30'), `G${grade} ${program} row ends after 18:30`);
			}
		}
	}
});

test('C1-3. Every active grade/program scope has canonical base + specialization rows, stably ordered', () => {
	for (const grade of [7, 8, 9, 10]) {
		for (const program of KNOWN_PROGRAM_TYPES) {
			const rows = slots(grade, program);
			assert.ok(rows.length > 0, `G${grade} ${program} must have canonical rows`);
			assert.ok(rows.some((row) => row.rowKind === 'CLASS'), `G${grade} ${program} must have CLASS rows`);
			const ordered = [...rows].sort((a, b) => minutes(a.startTime) - minutes(b.startTime));
			assert.deepEqual(rows.map((row) => row.startTime), ordered.map((row) => row.startTime), `G${grade} ${program} rows must be start-time ordered`);
		}
	}
	// Special programs extend the base with specialization rows.
	for (const program of ['STE', 'SPA', 'SPS'] as ProgramType[]) {
		for (const grade of [7, 8, 9, 10]) {
			assert.ok(slots(grade, program).length > slots(grade, 'REGULAR').length, `G${grade} ${program} must add specialization rows`);
		}
	}
});

test('C1-4. Lunch and health breaks are blocked; the duplicate 12:15–13:00 row is a BREAK, never a CLASS', () => {
	for (const grade of [7, 8, 9, 10]) {
		for (const program of KNOWN_PROGRAM_TYPES) {
			const rows = slots(grade, program);
			const lunch = rows.filter((row) => row.startTime === '12:15' && row.endTime === '13:00');
			assert.ok(lunch.length >= 1, `G${grade} ${program} must block lunch at 12:15–13:00`);
			assert.ok(lunch.every((row) => row.rowKind === 'BREAK'), `G${grade} ${program} 12:15–13:00 must be BREAK`);
			const health = rows.filter((row) => row.startTime === '15:15' && row.endTime === '15:30');
			assert.ok(health.every((row) => row.rowKind === 'BREAK'), `G${grade} ${program} 15:15–15:30 must be BREAK`);
			// No CLASS row may occupy the blocked lunch window.
			const classAtLunch = rows.filter((row) => row.rowKind === 'CLASS' && minutes(row.startTime) < minutes('13:00') && minutes(row.endTime) > minutes('12:15'));
			assert.equal(classAtLunch.length, 0, `G${grade} ${program} must not schedule a class over lunch`);
		}
	}
});

test('C1-6 mutant control. A cross-shift substitution would violate the frame bounds', () => {
	const grade7Base = slots(7, 'REGULAR');
	const grade9Base = slots(9, 'REGULAR');
	// A morning row smuggled into the afternoon contract is out of frame.
	const smuggledMorning = { ...grade7Base[0], gradeLevel: 9 };
	assert.ok(minutes(smuggledMorning.startTime) < minutes('09:45'), 'the smuggled morning row must be out of the afternoon frame');
	// The authoritative afternoon contract contains no such row.
	assert.equal(grade9Base.some((row) => row.startTime === smuggledMorning.startTime), false);
	// Conversely an afternoon-only row must not appear in the morning contract.
	assert.equal(grade7Base.some((row) => row.startTime === '15:30' || row.startTime === '16:15'), false);
});

test('C8. duplicate canonical rows are detected; set de-duplication cannot hide them', () => {
	const rows = slots(7, 'REGULAR').map((slot, index) => ({
		id: index + 1, gradeLevel: 7, programType: 'REGULAR' as const, dayOfWeek: null,
		startTime: slot.startTime, endTime: slot.endTime, rowKind: slot.rowKind, subjectFamily: null, subjectLabel: null, sourceLabel: 'x', sourceNote: null, isActive: true,
	}));
	assert.equal(validateCanonicalTemplateRows(rows, 7, 'REGULAR').some((issue) => issue.startsWith('duplicate-rows:')), false);
	const duplicated = [...rows, { ...rows[0], id: 999 }];
	const issues = validateCanonicalTemplateRows(duplicated, 7, 'REGULAR');
	assert.ok(issues.some((issue) => issue.startsWith('duplicate-rows:')), 'a duplicated canonical row must be reported');
});

