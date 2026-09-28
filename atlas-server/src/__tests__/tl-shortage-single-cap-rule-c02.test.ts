import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { resolveRealFacultyCapMinutes } from '../services/teaching-load-capacity.service.js';

/**
 * A8 TL-SHORTAGE-C02 item 1 — there is ONE cap definition, not three.
 *
 * Fails closed by SOURCE SHAPE as well as by value: a third copy of the rule
 * anywhere in the server is a defect, because the live bug was exactly that
 * (auto-fill 30h branch, auto-fill 40h branch, and the proposal-apply receiver
 * cap each re-derived `min(...)` independently).
 */

const SERVICES_DIR = fileURLToPath(new URL('../services/', import.meta.url));
const POLICY = { teachingStandardMinutes: 1800, hardCapMinutes: 2400 };

function capFor(maxHoursPerWeek: number, mode: 'REAL_FACULTY_STANDARD' | 'REAL_FACULTY_HARD_CAP') {
	return resolveRealFacultyCapMinutes({
		maxHoursPerWeek,
		mode,
		policyStandardMinutes: POLICY.teachingStandardMinutes,
		policyHardCapMinutes: POLICY.hardCapMinutes,
		nonTeachingMinutes: null,
	});
}

test('the auto-fill capacity gate and the proposal-apply receiver cap resolve identically', async () => {
	const { __testResolveEffectiveCapMinutes } = await import('../services/teaching-load-automation.service.js');

	for (const hours of [20, 25, 30, 35, 40, 45]) {
		// The auto-fill gate, for both coverage modes.
		assert.equal(
			__testResolveEffectiveCapMinutes(hours, 'REAL_FACULTY_STANDARD', 0),
			capFor(hours, 'REAL_FACULTY_STANDARD'),
			`auto-fill 30h-mode cap agrees with the shared rule for a ${hours}h teacher`,
		);
		assert.equal(
			__testResolveEffectiveCapMinutes(hours, 'REAL_FACULTY_HARD_CAP', 0),
			capFor(hours, 'REAL_FACULTY_HARD_CAP'),
			`auto-fill 40h-mode cap agrees with the shared rule for a ${hours}h teacher`,
		);
	}
});

test('a 30h teacher is not over-provisioned by either coverage mode', () => {
	// The regression that shipped: the 40h branch ignored the teacher entirely.
	assert.equal(capFor(30, 'REAL_FACULTY_HARD_CAP'), 1800);
	// A 45h teacher is still bounded by the policy hard cap.
	assert.equal(capFor(45, 'REAL_FACULTY_HARD_CAP'), 2400);
});

test('no server service re-derives the receiver/auto-fill cap inline', () => {
	const servicesDir = SERVICES_DIR;
	// The one legitimate definition lives in the shared capacity module.
	const allowed = new Set(['teaching-load-capacity.service.ts']);
	const offenders: string[] = [];

	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const absolute = join(dir, entry.name);
			if (entry.isDirectory()) { walk(absolute); continue; }
			if (!entry.name.endsWith('.ts')) continue;
			if (allowed.has(entry.name)) continue;
			const source = readFileSync(absolute, 'utf8');
			// A third copy would look like: maxHoursPerWeek multiplied into
			// minutes and immediately min'd against a policy cap.
			if (/maxHoursPerWeek\s*\*\s*60/.test(source) && /Math\.min\([^)]{0,200}(teachingStandardMinutes|hardCapMinutes|STANDARD_CAP_MIN|HARD_CAP_MIN)/s.test(source)) {
				offenders.push(entry.name);
			}
		}
	};
	walk(servicesDir);

	assert.deepEqual(
		offenders,
		[],
		`a third inline definition of the weekly cap rule exists; route it through `
		+ `teaching-load-capacity.service.ts:\n  ${offenders.join('\n  ')}`,
	);
});

test('both callers import the one shared rule', () => {
	const automation = readFileSync(join(SERVICES_DIR, 'teaching-load-automation.service.ts'), 'utf8');
	const proposal = readFileSync(join(SERVICES_DIR, 'teaching-load-suggestion-proposal.service.ts'), 'utf8');

	assert.match(automation, /from '\.\/teaching-load-capacity\.service\.js'/, 'auto-fill imports the shared cap rule');
	assert.match(proposal, /from '\.\/teaching-load-capacity\.service\.js'/, 'proposal apply imports the shared cap rule');
	assert.match(automation, /resolveRealFacultyCapMinutes as resolveRealFacultyCapMinutesShared/, 'auto-fill delegates to the shared rule');
});
