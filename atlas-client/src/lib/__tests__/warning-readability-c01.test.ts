import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ExplainabilityDrawer } from '../../components/ExplainabilityDrawer';
import { ViolationGroup } from '../../components/timetable/TimetableShared';
import { resolveWarningPanelSizing } from '../../components/timetable/ViolationsSidebar';
import { VIOLATION_LABELS as RAIL_LABELS } from '../../components/timetable/ScheduleReviewWorkspace.constants';
import {
	VIOLATION_PRESENTATION,
	formatIdentityFallbackText,
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

// WARNING-READABILITY-C01-R1 (F1): the drawer rendered violation.message
// verbatim, so a realistic validator string reached the operator unchanged.
// This control fails if any raw id, bare unit, or shouted day survives.
const RAW_VALIDATOR_MESSAGE = 'Faculty 16 has 101 min idle gaps on MONDAY, exceeds limit of 120 min.';
const FACULTY_ID_PATTERN = /\bFaculty\s+#?\d+\b/;
const BARE_MIN_PATTERN = /\d+\s*min(?!utes)\b/;
const BARE_HOUR_PATTERN = /\d+\s*h(?!ours)\b/;
const SHOUTED_DAY_PATTERN = /\b(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\b/;

/** Operator-visible "What happened" paragraph of a rendered drawer. */
function whatHappenedText(drawerMarkup: string): string {
	const match = drawerMarkup.match(/What happened<\/h4>\s*<p[^>]*>(.*?)<\/p>/s);
	assert.ok(match, 'drawer must render a "What happened" paragraph');
	return match[1];
}

/** Tag-stripped operator-visible text (attributes such as Tailwind class names excluded). */
function drawerText(drawerMarkup: string): string {
	return drawerMarkup.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]*>/g, ' ');
}

test('R2/drawer: the explainability drawer formats raw validator wording (F1)', () => {
	// Mutant control: the raw validator string WOULD fail this gate, so the
	// assertions below discriminate — they pass only because the drawer
	// formats before rendering.
	assert.match(RAW_VALIDATOR_MESSAGE, FACULTY_ID_PATTERN);
	assert.match(RAW_VALIDATOR_MESSAGE, BARE_MIN_PATTERN);
	assert.match(RAW_VALIDATOR_MESSAGE, SHOUTED_DAY_PATTERN);
	const item = violation('FACULTY_EXCESSIVE_IDLE_GAP', RAW_VALIDATOR_MESSAGE);
	const drawer = renderToStaticMarkup(createElement(ExplainabilityDrawer, { open: true, onClose: () => {}, violation: item }));
	// NOTE: assertions run against the operator-visible "What happened" text,
	// not the raw markup — Tailwind class names in attributes (e.g. `flex-1
	// min-h-0`) legitimately contain digit+`min` sequences.
	const happened = whatHappenedText(drawer);
	assert.doesNotMatch(happened, FACULTY_ID_PATTERN, 'drawer must not leak Faculty ids');
	assert.doesNotMatch(happened, BARE_MIN_PATTERN, 'drawer must expand bare min');
	assert.doesNotMatch(happened, BARE_HOUR_PATTERN, 'drawer must expand bare h');
	assert.doesNotMatch(happened, SHOUTED_DAY_PATTERN, 'drawer must not shout weekdays');
	assert.match(happened, /this teacher/, 'drawer falls back to plain words without a map');
	assert.match(happened, /101 minutes/, 'drawer expands the observed gap');
	assert.match(happened, /on Monday/, 'drawer title-cases the day');
	assert.doesNotMatch(drawerText(drawer), FACULTY_ID_PATTERN, 'no Faculty id anywhere in drawer text');
});

test('R2/drawer-formatter: a caller-supplied map-backed formatter reaches drawer text (F1)', () => {
	const item = violation('FACULTY_EXCESSIVE_IDLE_GAP', RAW_VALIDATOR_MESSAGE);
	// Production-like: the workspace resolves the known teacher id to a name
	// before units/days are normalized.
	const productionLike = (message: string): string =>
		formatWarningMessageText(message.replace(/\bFaculty\s+#?16\b/gi, 'Dela Cruz, Maria'));
	const drawer = renderToStaticMarkup(createElement(ExplainabilityDrawer, {
		open: true,
		onClose: () => {},
		violation: item,
		formatMessage: productionLike,
	}));
	const happened = whatHappenedText(drawer);
	assert.match(happened, /Dela Cruz, Maria/, 'drawer shows the resolved teacher name');
	assert.doesNotMatch(happened, FACULTY_ID_PATTERN, 'drawer must not leak Faculty ids');
	assert.doesNotMatch(happened, BARE_MIN_PATTERN, 'drawer must expand bare min');
	assert.doesNotMatch(happened, SHOUTED_DAY_PATTERN, 'drawer must not shout weekdays');
});

test('R2/drawer-fallback-units: the map-less identity fallback preserves unit/day formatting (F1)', () => {
	const formatted = formatWarningMessageText(formatIdentityFallbackText(RAW_VALIDATOR_MESSAGE));
	assert.equal(formatted, 'this teacher has 101 minutes idle gaps on Monday, exceeds limit of 120 minutes.');
});

test('R2/siblings: every operator surface that renders a violation message formats it (F1)', () => {
	const drawerSrc = readFileSync(resolve(clientRoot, 'src/components/ExplainabilityDrawer.tsx'), 'utf8');
	assert.doesNotMatch(drawerSrc, /\{violation\.message\}/, 'drawer must not render the raw message');
	const overlaysSrc = readFileSync(resolve(clientRoot, 'src/components/timetable/ScheduleReviewWorkspaceOverlays.tsx'), 'utf8');
	assert.match(overlaysSrc, /formatDrawerMessage/, 'overlays must pass the map-backed formatter to the drawer');
	const manualSrc = readFileSync(resolve(clientRoot, 'src/components/ManualEditPanel.tsx'), 'utf8');
	assert.doesNotMatch(manualSrc, /\{v\.message\}/, 'manual-edit panel must not render the raw message');
	assert.match(manualSrc, /formatPanelViolationMessage/, 'manual-edit panel must format violation messages');
});

// WARNING-UNITS-FIX-20260921: verbatim real surface string from run 316
// (live Tailnet surface, 1366x768 and 390x844). The number and the unit have
// words between them ("180 consecutive teaching min"), so the old
// digit-adjacent-only pattern left the token in place. This fixture differs
// from the invented R2 fixture above ('Ms. Dela Cruz teaches 180 minutes…',
// which already contains the expanded word) and from RAW_VALIDATOR_MESSAGE
// ('101 min idle gaps…', digit-adjacent): it carries a NON-digit-adjacent
// bare `min`, which is exactly what the old formatter missed.
const REAL_RUN316_CONSECUTIVE_STRING =
	'FERNANDEZ, JANELLA MARIE has 180 consecutive teaching min on Monday, exceeds limit 135 minutes.';

/** Bare standalone unit tokens, hyphen-guarded so `minutes`, `minimum`, `min-h-0`, and `135-minute` do not match. */
const BARE_MIN_TOKEN = /(?<![\w-])min(?![\w-])/;
const BARE_H_TOKEN = /(?<![\w-])h(?![\w-])/;

test('R2/run316: non-digit-adjacent bare min from the real surface expands (units-fix)', () => {
	// Discriminating control: the pre-fix digit-adjacent-only pattern leaves
	// the real string untouched, so these assertions fail against old
	// behaviour and pass only after the fix.
	const preFix = REAL_RUN316_CONSECUTIVE_STRING.replace(/(\d+)\s*min\b/g, '$1 minutes').replace(
		/(\d+)\s*h\b/g,
		'$1 hours',
	);
	assert.match(preFix, BARE_MIN_TOKEN, 'pre-fix formatter must still leak the bare min (control)');
	assert.equal(
		formatWarningMessageText(REAL_RUN316_CONSECUTIVE_STRING),
		'FERNANDEZ, JANELLA MARIE has 180 consecutive teaching minutes on Monday, exceeds limit 135 minutes.',
	);
	const item = violation('FACULTY_CONSECUTIVE_LIMIT_EXCEEDED', REAL_RUN316_CONSECUTIVE_STRING);
	const drawer = renderToStaticMarkup(createElement(ExplainabilityDrawer, { open: true, onClose: () => {}, violation: item }));
	const happened = whatHappenedText(drawer);
	assert.doesNotMatch(happened, BARE_MIN_TOKEN, 'rendered text must contain no bare min');
	assert.doesNotMatch(happened, BARE_H_TOKEN, 'rendered text must contain no bare h');
	assert.match(happened, /180 consecutive teaching minutes/, 'rendered text expands the legacy unit');
});

test('R2/run316: unit expansion never fires inside unrelated tokens (units-fix)', () => {
	assert.equal(formatWarningMessageText('keep the minimum stay'), 'keep the minimum stay');
	assert.equal(formatWarningMessageText('check minWidth before render'), 'check minWidth before render');
	assert.equal(
		formatWarningMessageText('<div class="flex-1 min-h-0">180 min</div>'),
		'<div class="flex-1 min-h-0">180 minutes</div>',
		'hyphenated class tokens survive while the real unit still expands',
	);
	assert.equal(
		formatWarningMessageText('above the 135-minute limit'),
		'above the 135-minute limit',
		'hyphenated compounds survive',
	);
	assert.equal(
		formatWarningMessageText('teach 40 h a week'),
		'teach 40 hours a week',
		'digit-adjacent h still expands',
	);
});

// ZONE-WARNING-REMOVAL-C01: the zone warning has no producer. Stored rows
// render as history (the FACULTY_EXCESSIVE_TRAVEL_DISTANCE precedent), the
// complete rail record keeps its neutral label, and the actionable readiness
// map drops the entry. Fails against the old actionable copy ("Most classes
// are in one campus zone" + "Move some of this term's classes to rooms in
// another campus zone") and against a readiness entry.
test('ZONE-WARNING-REMOVAL-C01: the retired zone warning renders as history, not action', () => {
	const copy = getViolationPresentation('ZONE_IMBALANCE_WARNING');
	assert.match(copy.meaning, /older run recorded/i, 'meaning says an older run recorded it');
	assert.match(copy.meaning, /no longer calculates/i, 'meaning says it is no longer calculated');
	assert.match(copy.action, /before acting on this historical warning/i, 'action defers to regeneration, never to rebalancing');
	assert.doesNotMatch(
		`${copy.title} ${copy.meaning} ${copy.action}`,
		/Move some of this term/,
		'the old rebalancing action is gone',
	);
	assert.match(RAIL_LABELS.ZONE_IMBALANCE_WARNING, /campus zone/i, 'the complete rail record keeps the neutral historical label');
	const readinessSrc = readFileSync(resolve(clientRoot, 'src/components/timetable/simplePublishReadiness.ts'), 'utf8');
	assert.doesNotMatch(readinessSrc, /ZONE_IMBALANCE_WARNING/, 'the actionable readiness map drops the retired warning (travel precedent)');
	const panelSrc = readFileSync(resolve(clientRoot, 'src/components/BuildingPanel.tsx'), 'utf8');
	assert.doesNotMatch(panelSrc, /Zone \/ Annex/, 'no config surface keeps the old term');
	assert.match(panelSrc, /groups rooms by part of campus/, 'the zone input carries its one-sentence help line');
});
