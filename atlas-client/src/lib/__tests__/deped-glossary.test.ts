import assert from 'node:assert/strict';
import test from 'node:test';

import {
	DEPARTMENT_LABELS,
	PROGRAM_LABELS,
	TEACHER_X_LABEL,
	departmentLabel,
	gradeCompact,
	gradeLong,
	programFullLabel,
	programShortLabel,
} from '../deped-glossary';

test('deped-glossary: every department code maps to a plain DepEd name', () => {
	for (const [code, label] of Object.entries(DEPARTMENT_LABELS)) {
		assert.ok(label.length > 0, `Department ${code} must have a label`);
		// Real DepEd acronyms are allowed to remain (AP, ESP, MAPEH, TLE); made-up
		// codes (SCI, ENG, FIL, MATH) must be expanded to a real word.
		const madeUpCodes = ['SCI', 'ENG', 'FIL', 'MATH', 'GENERAL'];
		if (madeUpCodes.includes(code)) {
			assert.ok(
				!/^[A-Z]{2,6}$/.test(label),
				`Department ${code} must expand to a real name, got raw code "${label}"`,
			);
		}
	}
	assert.equal(DEPARTMENT_LABELS.FIL, 'Filipino');
	assert.equal(DEPARTMENT_LABELS.SCI, 'Science');
	assert.equal(DEPARTMENT_LABELS.ENG, 'English');
});

test('deped-glossary: departmentLabel falls back to the raw value for unknown codes', () => {
	assert.equal(departmentLabel('SCI'), 'Science');
	assert.equal(departmentLabel('UNKNOWN'), 'UNKNOWN');
	assert.equal(departmentLabel(null), 'General');
	assert.equal(departmentLabel(''), 'General');
});

test('deped-glossary: every program scope carries a short and full descriptor', () => {
	for (const [code, descriptor] of Object.entries(PROGRAM_LABELS)) {
		assert.ok(descriptor.short.length > 0, `Program ${code} short label missing`);
		assert.ok(descriptor.full.length > 0, `Program ${code} full label missing`);
	}
	assert.equal(programShortLabel('STE'), 'STE');
	assert.equal(programFullLabel('SPA'), 'Special Program in the Arts');
	assert.equal(programFullLabel('SPS'), 'Special Program in Sports');
	assert.equal(programFullLabel('SPTVE'), 'Special Program in Technical-Vocational Education');
	assert.equal(programShortLabel('UNKNOWN'), 'UNKNOWN');
	assert.equal(programFullLabel('UNKNOWN'), 'UNKNOWN');
});

test('deped-glossary: grade compact form is GR{grade} and never G{grade}', () => {
	assert.equal(gradeCompact(7), 'GR7');
	assert.equal(gradeCompact(10), 'GR10');
	assert.equal(gradeLong(7), 'Grade 7');
	assert.equal(gradeLong(10), 'Grade 10');
	assert.ok(!gradeCompact(7).startsWith('G7'));
});

test('deped-glossary: TEACHER_X_LABEL is plain language, not the brand string', () => {
	assert.equal(TEACHER_X_LABEL, 'Temporary (to be hired)');
	assert.ok(!TEACHER_X_LABEL.includes('Teacher X'));
});