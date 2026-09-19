import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ExplainabilityDrawer } from '../../components/ExplainabilityDrawer';
import { ViolationGroup } from '../../components/timetable/TimetableShared';
import {
	VIOLATION_PRESENTATION,
	getViolationPresentation,
} from '../violation-presentation';
import type { Violation, ViolationCode } from '../../types';

const clientRoot = resolve(import.meta.dirname, '../../..');
const serverValidator = readFileSync(resolve(clientRoot, '../atlas-server/src/services/constraint-validator.ts'), 'utf8');
const canonicalCodes = Array.from(
	serverValidator.match(/export const VIOLATION_CODES = \[([\s\S]*?)\] as const;/)?.[1].matchAll(/'([^']+)'/g) ?? [],
).map((match) => match[1]);

function violation(code: ViolationCode, message = 'Faculty 16 has an issue on MONDAY.'): Violation {
	return {
		code,
		severity: 'SOFT',
		message,
		schoolId: 1,
		schoolYearId: 10,
		runId: 316,
		entities: { facultyId: 16, day: 'MONDAY', entryIds: ['entry-1::t1'] },
		meta: { termIndex: 1 },
	};
}

test('R1: every canonical server violation code has a plain title, meaning, and next action', () => {
	assert.ok(canonicalCodes.length >= 20, 'the test must enumerate the production canonical set');
	for (const code of canonicalCodes) {
		const copy = VIOLATION_PRESENTATION[code as ViolationCode];
		assert.ok(copy, `${code} needs operator copy`);
		assert.ok(copy.title.trim().length > 0, `${code} needs a title`);
		assert.ok(copy.meaning.trim().length > 0, `${code} needs a meaning`);
		assert.ok(copy.action.trim().length > 0, `${code} needs a next action`);
		assert.doesNotMatch(`${copy.title} ${copy.meaning} ${copy.action}`, new RegExp(code, 'i'));
	}
});

test('R2: the rendered group and explanation use plain operator copy without leaking the raw code', () => {
	const item = violation('FACULTY_CONSECUTIVE_LIMIT_EXCEEDED', 'Ms. Dela Cruz teaches 180 minutes (4 consecutive periods), above the 135-minute limit.');
	const copy = getViolationPresentation(item.code);
	const group = renderToStaticMarkup(createElement(ViolationGroup, {
		code: item.code,
		violations: [item],
		selectedViolation: null,
		onSelect: () => {},
		labels: Object.fromEntries(Object.entries(VIOLATION_PRESENTATION).map(([code, value]) => [code, value.title])) as Record<ViolationCode, string>,
	}));
	const drawer = renderToStaticMarkup(createElement(ExplainabilityDrawer, { open: true, onClose: () => {}, violation: item }));
	assert.match(group, new RegExp(copy.title));
	assert.match(drawer, new RegExp(copy.meaning.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
	assert.match(drawer, new RegExp(copy.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
	assert.doesNotMatch(`${group}${drawer}`, /FACULTY_CONSECUTIVE_LIMIT_EXCEEDED/);
});

test('R2/R6: copy explains minutes as periods and floor movement in readable terms', () => {
	const consecutive = getViolationPresentation('FACULTY_CONSECUTIVE_LIMIT_EXCEEDED');
	assert.match(`${consecutive.meaning} ${consecutive.action}`, /period/i);
	const floor = getViolationPresentation('FACULTY_FLOOR_TRANSITION');
	assert.match(`${floor.meaning} ${floor.action}`, /floor/i);
	assert.doesNotMatch(`${floor.meaning} ${floor.action}`, /transition buffer|configured threshold/i);
});

