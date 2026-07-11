import assert from 'node:assert/strict';
import test from 'node:test';

import { resolvePublicSectionGrade } from '../public-schedule-grade';

test('uses a direct grade number only when it is a supported junior-high grade', () => {
	assert.equal(resolvePublicSectionGrade(7, 'Grade 7', 'Rizal'), 7);
	assert.equal(resolvePublicSectionGrade(10, 'Grade 10', 'Sirius'), 10);
});

test('does not display an upstream grade-level identifier as a grade number', () => {
	assert.equal(resolvePublicSectionGrade(107, 'Grade 7', 'Andres Bonifacio'), 7);
	assert.equal(resolvePublicSectionGrade(110, 'Grade 10', 'Sirius'), 10);
});

test('falls back to section names and returns null when no grade is present', () => {
	assert.equal(resolvePublicSectionGrade(null, null, '8 - Kalayaan'), 8);
	assert.equal(resolvePublicSectionGrade(208, null, 'Unassigned section'), null);
});
