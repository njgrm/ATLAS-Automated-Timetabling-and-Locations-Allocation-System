import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
	matchesOwnershipDepartment,
	ownershipDepartmentEligibility,
	normalizeDepartmentCode,
} from '@/lib/faculty-assignment-helpers';
import { isDepartmentMatch } from '@/lib/grade-labels';
import type { Subject } from '@/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
function source(relativePath: string): string {
	return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function subject(overrides: Partial<Subject> = {}): Subject {
	return { id: 1, code: 'FIL', name: 'Filipino', isActive: true, gradeLevels: [7], programScopes: [], allowedSpecializations: [], ...overrides } as unknown as Subject;
}

/* ================================================================== *
 * R4 blast radius — the widening is blank/unknown department ONLY
 * ================================================================== */

test('blast radius: a known non-matching department is still excluded when owner departments are declared', () => {
	const fil = subject({ ownerDepartment: 'FIL', allowedOwnerDepartments: ['FIL'] });
	for (const department of ['ESP', 'MATH', 'SCI', 'ENG', 'AP', 'TLE', 'MAPEH', 'SPS', 'UNKNOWN-DEPT']) {
		assert.equal(
			ownershipDepartmentEligibility(department, fil),
			'ineligible',
			`${department} must remain ineligible for a FIL-owned subject`,
		);
		assert.equal(matchesOwnershipDepartment(department, fil), false, `${department} must stay hidden`);
	}
});

test('blast radius: only blank/unknown departments become visible', () => {
	const fil = subject({ ownerDepartment: 'FIL', allowedOwnerDepartments: ['FIL'] });
	// The exact widened set.
	for (const blank of [null, undefined, '', '   ', '\t']) {
		assert.equal(ownershipDepartmentEligibility(blank, fil), 'unknown', `${JSON.stringify(blank)} must be unknown`);
		assert.equal(matchesOwnershipDepartment(blank, fil), true, `${JSON.stringify(blank)} must stay visible`);
	}
	// A department that normalizes to a non-empty code is never "unknown".
	for (const known of ['FIL', 'ESP', 'MATH']) {
		assert.notEqual(ownershipDepartmentEligibility(known, fil), 'unknown');
	}
});

test('blast radius: joining allowed owner departments never widens a known non-member', () => {
	const multi = subject({ ownerDepartment: 'FIL', allowedOwnerDepartments: ['ESP'] });
	assert.equal(ownershipDepartmentEligibility('FIL', multi), 'eligible');
	assert.equal(ownershipDepartmentEligibility('ESP', multi), 'eligible');
	assert.equal(ownershipDepartmentEligibility('MATH', multi), 'ineligible');
	assert.equal(ownershipDepartmentEligibility(null, multi), 'unknown');
});

test('blast radius: with no declared owner departments, known departments keep the legacy verdict exactly', () => {
	const noAuthority = subject({ code: 'MATH', name: 'Mathematics' });
	for (const department of ['MATH', 'FIL', 'ESP', 'SCI', 'ENG', 'AP', 'TLE', 'SPS']) {
		const legacy = isDepartmentMatch(department, noAuthority.code, noAuthority.name);
		assert.equal(
			ownershipDepartmentEligibility(department, noAuthority),
			legacy ? 'eligible' : 'ineligible',
			`${department} must keep the legacy verdict`,
		);
		assert.equal(matchesOwnershipDepartment(department, noAuthority), legacy, `${department} boolean parity`);
	}
	// Only the blank case is new.
	assert.equal(ownershipDepartmentEligibility(null, noAuthority), 'unknown');
	assert.equal(matchesOwnershipDepartment(null, noAuthority), true);
	// Homeroom Guidance is matched regardless of department (pre-existing rule).
	const hg = subject({ code: 'HG', name: 'Homeroom Guidance' });
	assert.equal(ownershipDepartmentEligibility('ESP', hg), 'eligible');
});

test('blast radius: the shared predicate still normalizes codes before deciding', () => {
	assert.equal(normalizeDepartmentCode('fil'), 'FIL');
	assert.equal(normalizeDepartmentCode('  Filipino '), 'FIL');
	assert.equal(normalizeDepartmentCode('Values Education'), 'ESP');
	const fil = subject({ ownerDepartment: 'FIL', allowedOwnerDepartments: [] });
	assert.equal(matchesOwnershipDepartment('fil', fil), true);
	assert.equal(matchesOwnershipDepartment('FILIPINO', fil), true);
});

test('blast radius: the timetable consumer is untouched and still uses the shared boolean API', () => {
	// We must not edit timetable files; this asserts the consumer still resolves
	// the same exported predicate (and that we did not fork or duplicate it).
	const dock = source('src/components/timetable/TacticalSandboxDock.helpers.ts');
	assert.match(dock, /import \{ matchesOwnershipDepartment \} from '@\/lib\/faculty-assignment-helpers'/);
	assert.match(dock, /matchesOwnershipDepartment\(faculty\.department, subject\)/);
	// No local re-implementation of department eligibility was introduced there.
	assert.doesNotMatch(dock, /ownershipDepartmentEligibility/);
});
