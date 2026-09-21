import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ExplainabilityDrawer } from '../../components/ExplainabilityDrawer';
import { ViolationGroup } from '../../components/timetable/TimetableShared';
import { resolveWarningPanelSizing } from '../../components/timetable/ViolationsSidebar';
import {
	VIOLATION_PRESENTATION,
	formatWarningMessageText,
	getViolationPresentation,
	sortViolationGroupsHardFirst,
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

test('R4: one grouped warning exposes the supporting check instead of silently discarding it', () => {
	const item = violation('FACULTY_CONSECUTIVE_LIMIT_EXCEEDED', 'Ms. Dela Cruz teaches four consecutive periods.');
	item.meta = {
		termIndex: 1,
		relatedCodes: ['FACULTY_CONSECUTIVE_LIMIT_EXCEEDED', 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER'],
		relatedMessages: [
			'Ms. Dela Cruz teaches four consecutive periods.',
			'Ms. Dela Cruz also has no time to change buildings.',
		],
	};
	const markup = renderToStaticMarkup(createElement(ViolationGroup, {
		code: item.code,
		violations: [item],
		selectedViolation: null,
		onSelect: () => {},
		formatConstraintMessage: (message: string) => message,
		labels: Object.fromEntries(Object.entries(VIOLATION_PRESENTATION).map(([code, value]) => [code, value.title])) as Record<ViolationCode, string>,
	}));
	assert.match(markup, /Combines 2 related checks/);
	assert.match(markup, /no time to change buildings/);
});

test('R9: warning panel remains readable at the required desktop and mobile viewport widths', () => {
	assert.deepEqual(resolveWarningPanelSizing(1366), { minSize: 22, maxSize: 42, defaultSize: 28 });
	assert.deepEqual(resolveWarningPanelSizing(390), { minSize: 72, maxSize: 82, defaultSize: 72 });
});

function renderOperatorSurface(code: ViolationCode, labels: Record<ViolationCode, string>): string {
	const item = violation(code);
	const group = renderToStaticMarkup(createElement(ViolationGroup, {
		code: item.code,
		violations: [item],
		selectedViolation: null,
		onSelect: () => {},
		labels,
	}));
	const drawer = renderToStaticMarkup(createElement(ExplainabilityDrawer, { open: true, onClose: () => {}, violation: item }));
	return `${group}${drawer}`;
}

test('R2/all-codes: every canonical warning renders with plain copy and no raw code', () => {
	assert.ok(canonicalCodes.length >= 20, 'the test must enumerate the production canonical set');
	const labels = Object.fromEntries(Object.entries(VIOLATION_PRESENTATION).map(([code, value]) => [code, value.title])) as Record<ViolationCode, string>;
	for (const code of canonicalCodes) {
		const markup = renderOperatorSurface(code as ViolationCode, labels);
		assert.doesNotMatch(markup, new RegExp(code), `${code} must not leak to the operator surface`);
	}
});

test('R2/all-codes mutant: the leak check fires when a label is missing', () => {
	const target = canonicalCodes[0];
	const labels = Object.fromEntries(Object.entries(VIOLATION_PRESENTATION).map(([code, value]) => [code, value.title])) as Record<ViolationCode, string>;
	delete (labels as Record<string, string>)[target];
	assert.throws(() => {
		const markup = renderOperatorSurface(target as ViolationCode, labels);
		assert.doesNotMatch(markup, new RegExp(target), `${target} must not leak to the operator surface`);
	}, new RegExp(target));
});

test('R2: operator messages expand bare minute abbreviations and shout-free days', () => {
	const raw = 'Faculty 16 teaches 180 min on MONDAY, above the 135-minute limit (40 h week).';
	const formatted = formatWarningMessageText(raw);
	assert.notEqual(formatted, raw, 'the formatter must change raw validator wording');
	assert.match(formatted, /180 minutes/);
	assert.match(formatted, /on Monday/);
	assert.match(formatted, /40 hours/);
	assert.doesNotMatch(formatted, /MONDAY/);
	assert.doesNotMatch(formatted, /\bmin\b/);
	assert.doesNotMatch(formatted, /\bh\b/);
});

test('R7: HARD groups lead soft groups and equal severity keeps its order', () => {
	const soft = (code: ViolationCode): Violation => violation(code);
	const hard = (code: ViolationCode): Violation => ({ ...violation(code), severity: 'HARD' });
	const groups: Array<[ViolationCode, Violation[]]> = [
		['FACULTY_EXCESSIVE_IDLE_GAP', [soft('FACULTY_EXCESSIVE_IDLE_GAP')]],
		['FACULTY_TIME_CONFLICT', [hard('FACULTY_TIME_CONFLICT')]],
		['ROOM_TIME_CONFLICT', [hard('ROOM_TIME_CONFLICT')]],
		['ZONE_IMBALANCE_WARNING', [soft('ZONE_IMBALANCE_WARNING')]],
	];
	const ordered = sortViolationGroupsHardFirst(groups).map(([code]) => code);
	assert.deepEqual(ordered, ['FACULTY_TIME_CONFLICT', 'ROOM_TIME_CONFLICT', 'FACULTY_EXCESSIVE_IDLE_GAP', 'ZONE_IMBALANCE_WARNING']);
});

test('R2/tooltip: the constraint-context tooltip uses full words, not abbreviations', () => {
	const shared = readFileSync(resolve(clientRoot, 'src/components/timetable/TimetableShared.tsx'), 'utf8');
	assert.doesNotMatch(shared, /Building trans/);
	assert.doesNotMatch(shared, /(\d|\}) min[ ·<]/);
	assert.match(shared, /minutes/);
});
