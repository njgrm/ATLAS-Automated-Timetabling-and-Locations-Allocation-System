/**
 * A6-TL-DEMAND-SOURCE-C01 — the CLIENT rows: the demand universe and the header
 * figure must come from the server's canonical pair set, never from the client's
 * own `subject × section` walk over `displayOrder`.
 *
 * The live defect: the Teaching Load header read `100% staffed` while generation
 * readiness saw AP gaps, because the client re-derived the pair universe from
 * presentation ordering while canonical demand reads the EnrollPro grade NAME.
 *
 * Rows:
 *  1. `buildSubjectShortage` with `canonicalPairs` uses EXACTLY that universe — a
 *     pair the predicate would miss is included, and a predicate-only pair is
 *     excluded.
 *  2. the fallback predicate still applies when the server pair set is absent
 *     (a pre-A6 cached payload), unchanged.
 *  3. the staffing figure NEVER renders a percentage — nor "every class has a
 *     teacher" — when canonical demand is not ready.
 *  4. the honest positive is preserved when demand IS ready.
 *  5. source guard: the outage hook threads the server's canonical pairs and
 *     readiness into its two derivations.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	buildStaffingFigureLabel,
	buildStaffingTruthFigures,
	buildSubjectShortage,
	STAFFING_FIGURE_CANNOT_CHECK,
} from '@/components/faculty-assignments/teachingLoadOutage';

const here = dirname(fileURLToPath(import.meta.url));

const SUBJECT = (id: number, code: string, gradeLevels: number[], programScopes: string[] = ['REGULAR']): any => ({
	id, code, name: code, isActive: true, gradeLevels, programScopes,
	minMinutesPerWeek: 240, displayOrder: id, isSpecialized: false,
});
const SECTION = (id: number, name: string, displayOrder: number, programType = 'REGULAR'): any => ({
	id, name, displayOrder, programType, isActive: true,
});

test('A6-TL-DEMAND-SOURCE-C01: canonical pairs ARE the shortage universe', () => {
	const ap = SUBJECT(21, 'AP', [9]); // grade name 9 only; displayOrder 12 must not matter
	const reg12 = SUBJECT(22, 'REG12', [12]); // predicate-only match at displayOrder 12
	const section = SECTION(4120, 'Mabini', 12);

	const result = buildSubjectShortage({
		subjects: [ap, reg12],
		sections: [section],
		savedOwnershipMap: {},
		pendingOwnershipMap: {},
		placeholderFacultyIds: new Set<number>(),
		activeFacultyIds: new Set<number>([7001]),
		canonicalPairs: [{ subjectId: 21, sectionId: 4120 }],
	});

	const apEntry = result.entries.find((entry) => entry.subjectId === 21);
	const regEntry = result.entries.find((entry) => entry.subjectId === 22);
	assert.ok(apEntry, 'the canonical AP pair is in the shortage universe');
	assert.equal(regEntry, undefined, 'a predicate-only pair is EXCLUDED by the canonical universe');
});

test('A6-TL-DEMAND-SOURCE-C01: fallback predicate still applies when no canonical pairs are supplied', () => {
	const ap = SUBJECT(21, 'AP', [9]);
	const reg12 = SUBJECT(22, 'REG12', [12]);
	const section = SECTION(4120, 'Mabini', 12);

	const result = buildSubjectShortage({
		subjects: [ap, reg12],
		sections: [section],
		savedOwnershipMap: {},
		pendingOwnershipMap: {},
		placeholderFacultyIds: new Set<number>(),
		activeFacultyIds: new Set<number>([7001]),
	});

	assert.equal(result.entries.find((entry) => entry.subjectId === 21), undefined, 'legacy fallback excludes the grade-9 pair at displayOrder 12');
	assert.ok(result.entries.find((entry) => entry.subjectId === 22), 'legacy fallback includes the grade-12 pair');
});

test('A6-TL-DEMAND-SOURCE-C01: not-ready demand never renders a percentage or an all-staffed claim', () => {
	const figures = buildStaffingTruthFigures({
		realAssignedPairs: 0, syntheticPlaceholderPairs: 0, unassignedPairs: 0, totalPairs: 0,
	});
	const label = buildStaffingFigureLabel({ ...figures, demandReady: false });
	assert.equal(label.figure, STAFFING_FIGURE_CANNOT_CHECK);
	assert.ok(!label.figure.includes('%'), 'no percentage is fabricated');
	assert.equal(label.clause, 'See who needs a teacher');
	assert.ok(!label.label.includes('Every class has a teacher'), 'no all-staffed claim on an unavailable authority');
});

test('A6-TL-DEMAND-SOURCE-C01: ready demand keeps the existing honest figure and positive', () => {
	const figures = buildStaffingTruthFigures({
		realAssignedPairs: 24, syntheticPlaceholderPairs: 0, unassignedPairs: 0, totalPairs: 24,
	});
	const label = buildStaffingFigureLabel({ ...figures, demandReady: true });
	assert.equal(label.figure, '100% staffed');
	assert.equal(label.clause, 'Every class has a teacher');
});

test('A6-TL-DEMAND-SOURCE-C01: the outage hook threads the server canonical pairs + readiness', () => {
	const src = readFileSync(resolve(here, '../../../hooks/useTeachingLoadOutage.ts'), 'utf8');
	assert.match(src, /canonicalPairs:\s*params\.coverageTotals\?\.teachingLoadDemandPairs/);
	assert.match(src, /const demandReady = params\.coverageTotals\?\.teachingLoadDemandReady/);
	const outageSrc = readFileSync(resolve(here, '../teachingLoadOutage.ts'), 'utf8');
	assert.match(outageSrc, /THIS IS A DEGRADED FALLBACK, NOT THE DEMAND/);
});
