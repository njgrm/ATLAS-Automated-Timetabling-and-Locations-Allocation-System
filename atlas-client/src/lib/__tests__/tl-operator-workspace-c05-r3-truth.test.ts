import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { TooltipProvider } from '@/ui/tooltip';
import { TeachingLoadTruthPanel } from '@/components/faculty-assignments/TeachingLoadTruthPanel';
import {
	buildTeachingLoadTruthModel,
	isKnown,
	minutesToHours,
	type TeachingLoadAuthorityDiagnosticsPayload,
	type TruthMetric,
} from '@/lib/teaching-load-authority-truth';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
function source(relativePath: string): string {
	return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function demandPair(sectionId: number, subjectId: number) {
	return {
		key: `${subjectId}:${sectionId}`,
		subjectId,
		subjectCode: subjectId === 21 ? 'FIL' : 'ESP',
		sectionId,
		gradeLevel: 7,
		programType: 'REGULAR',
		weeklyMinutes: 240,
	};
}

function diagnostics(
	overrides: Partial<TeachingLoadAuthorityDiagnosticsPayload> = {},
): TeachingLoadAuthorityDiagnosticsPayload {
	return {
		schoolId: 1,
		schoolYearId: 9,
		sourceRevision: 'rev-abc',
		fingerprint: 'fp-abc',
		generatedAt: '2031-01-01T00:00:00.000Z',
		demandedSubjectSectionPairs: [demandPair(1001, 21), demandPair(1001, 22), demandPair(1002, 21)],
		ownedSubjectSectionPairs: [
			{ ownershipId: 1, pairKey: '21:1001', subjectId: 21, subjectCode: 'FIL', sectionId: 1001, facultyId: 101 },
			{ ownershipId: 2, pairKey: '22:1001', subjectId: 22, subjectCode: 'ESP', sectionId: 1001, facultyId: 900 },
		],
		unownedActiveFaculty: [
			{ facultyId: 103, name: 'Zero Load Filipino', department: 'FIL', specialization: null },
		],
		validAdviserMappings: [{ facultyId: 101, name: 'Adviser One', sectionId: 1001 }],
		legacyHgOwnershipRows: [{ ownershipId: 7, subjectId: 1, sectionId: 1001, facultyId: 101 }],
		advisoryCreditEligibility: [
			{ facultyId: 101, name: 'Adviser One', sectionId: 1001, eligible: true, creditMinutes: 300, reason: 'Eligible adviser' },
			{ facultyId: 102, name: 'Not Adviser', sectionId: null, eligible: false, creditMinutes: 0, reason: 'Not an adviser' },
		],
		overloadCapacityTotals: {
			policyStatus: 'CONFIGURED',
			teachingStandardMinutes: 1800,
			hardCapMinutes: 2400,
			// FIVE active faculty rows (incl. zero-load) totalling 7500 minutes.
			// Deliberately not the owned-pair count (2), and per-faculty excess is
			// 900 + 1800 = 2700 — not `7500 - 1800`.
			beforeTeachingMinutes: 7500,
			afterTeachingMinutes: 7500,
			beforeOverStandardCount: 2,
			afterOverStandardCount: 2,
			beforeOverHardCapCount: 2,
			afterOverHardCapCount: 2,
			capacityMinutes: 9000,
			beforeExcessMinutes: 2700,
		},
		candidateCountsByDepartment: [],
		unresolvedReasons: [{ code: 'UNOWNED_PAIR', scope: 'PAIR', message: 'FIL G7-1002 has no qualified owner.' }],
		...overrides,
	};
}

const PLACEHOLDERS = new Set([900]);

function renderPanel(payload: TeachingLoadAuthorityDiagnosticsPayload | null, workloadPolicyStatus: 'CONFIGURED' | 'UNCONFIGURED' = 'CONFIGURED') {
	const model = buildTeachingLoadTruthModel({
		diagnostics: payload,
		placeholderFacultyIds: PLACEHOLDERS,
		workloadPolicyStatus,
	});
	const markup = renderToStaticMarkup(
		createElement(TooltipProvider, null,
			createElement(TeachingLoadTruthPanel, {
				model,
				loading: false,
				sourceRevision: payload?.sourceRevision ?? null,
				unresolvedReasons: (payload?.unresolvedReasons ?? []).map((reason) => ({ code: reason.code, message: reason.message })),
			}),
		),
	);
	return { model, markup };
}

function chipText(markup: string, testId: string): string {
	const index = markup.indexOf(`data-testid="${testId}"`);
	if (index < 0) return '';
	const end = markup.indexOf('</div>', index);
	return markup.slice(index, end < 0 ? undefined : end);
}

function metricState(markup: string, testId: string): string | null {
	return chipText(markup, testId).match(/data-metric-state="([a-z]+)"/)?.[1] ?? null;
}

/* ================================================================== *
 * R3 — canonical truth, positive path
 * ================================================================== */

test('R3 the rendered panel shows every canonical metric with its authoritative value', () => {
	const { markup } = renderPanel(diagnostics());

	const expected: Array<[string, string]> = [
		['teaching-load-truth-required-pairs', '3'],
		['teaching-load-truth-assigned-pairs', '2 (1 real, 1 temp)'],
		['teaching-load-truth-unresolved-pairs', '1'],
		['teaching-load-truth-actual-hours', '125h'],
		['teaching-load-truth-standard', '30h'],
		['teaching-load-truth-hard-cap', '40h'],
		['teaching-load-truth-over-standard', '2 (+45h)'],
		['teaching-load-truth-over-hard-cap', '2'],
		['teaching-load-truth-remaining', '25h'],
		['teaching-load-truth-zero-load', '1'],
		['teaching-load-truth-advisers', '1'],
		['teaching-load-truth-advisory-credit', '5h'],
		['teaching-load-truth-hg-excluded', '1'],
	];
	for (const [testId, value] of expected) {
		assert.equal(metricState(markup, testId), 'known', `${testId} must be known`);
		assert.ok(
			chipText(markup, testId).includes(`>${value}<`),
			`${testId} must render "${value}" (got: ${chipText(markup, testId)})`,
		);
	}

	// Zero-load and advisory detail stays on demand, never in the default wall.
	assert.match(markup, /teaching-load-truth-details/);
	assert.match(markup, /teaching-load-truth-zero-load-note/);
});

test('R3 required pairs come from canonical demand, never a client re-derivation', () => {
	const payload = diagnostics();
	const { model, markup } = renderPanel(payload);
	assert.ok(isKnown(model.requiredPairs));
	assert.equal(model.requiredPairs.value, payload.demandedSubjectSectionPairs.length);
	assert.ok(chipText(markup, 'teaching-load-truth-required-pairs').includes(`>${payload.demandedSubjectSectionPairs.length}<`));

	// Adding demand moves the metric exactly; nothing is cached or approximated.
	const bigger = diagnostics({
		demandedSubjectSectionPairs: [...payload.demandedSubjectSectionPairs, demandPair(1003, 21), demandPair(1003, 22)],
	});
	assert.equal(buildTeachingLoadTruthModel({ diagnostics: bigger, placeholderFacultyIds: PLACEHOLDERS }).requiredPairs.state, 'known');
	const biggerModel = buildTeachingLoadTruthModel({ diagnostics: bigger, placeholderFacultyIds: PLACEHOLDERS });
	assert.ok(isKnown(biggerModel.requiredPairs));
	assert.equal(biggerModel.requiredPairs.value, 5);
});

test('R3 unresolved pairs are a canonical set difference, not an aggregate subtraction', () => {
	// An owned pair that is NOT part of demand must not reduce the unresolved count.
	const payload = diagnostics({
		ownedSubjectSectionPairs: [
			{ ownershipId: 1, pairKey: '21:1001', subjectId: 21, subjectCode: 'FIL', sectionId: 1001, facultyId: 101 },
			{ ownershipId: 9, pairKey: '99:9999', subjectId: 99, subjectCode: 'XX', sectionId: 9999, facultyId: 101 },
		],
	});
	const model = buildTeachingLoadTruthModel({ diagnostics: payload, placeholderFacultyIds: PLACEHOLDERS });
	assert.ok(isKnown(model.unresolvedPairs));
	assert.equal(model.unresolvedPairs.value, 2, 'two demanded pairs remain unowned');
});

test('R3 assigned pairs separate real ownership from placeholder rows', () => {
	const model = buildTeachingLoadTruthModel({ diagnostics: diagnostics(), placeholderFacultyIds: PLACEHOLDERS });
	assert.ok(isKnown(model.assignedPairs));
	assert.deepEqual(model.assignedPairs.value, { real: 1, placeholder: 1, total: 2 });
});

test('R3 minutes convert to hours only for display', () => {
	assert.equal(minutesToHours(1800), 30);
	assert.equal(minutesToHours(3900), 65);
	assert.equal(minutesToHours(0), 0);
});

/* ================================================================== *
 * C-2 — corrected capacity/excess math (unit-coherent with the producer)
 * ================================================================== */

test('C-2 remaining capacity uses the canonical capacityMinutes basis, not the owned-pair count', () => {
	const payload = diagnostics();
	const totals = payload.overloadCapacityTotals;
	const { model } = renderPanel(payload);

	// The fixture deliberately separates the two candidate bases.
	assert.notEqual(payload.ownedSubjectSectionPairs.length, 5);

	// The retired formula multiplied the standard by the owned-PAIR count.
	const retiredMixedUnitRemaining = Math.max(
		0,
		(totals.teachingStandardMinutes as number) * payload.ownedSubjectSectionPairs.length - totals.beforeTeachingMinutes,
	);
	assert.equal(retiredMixedUnitRemaining, 0);

	assert.ok(isKnown(model.remainingCapacityMinutes));
	assert.equal(model.remainingCapacityMinutes.value, (totals.capacityMinutes as number) - totals.beforeTeachingMinutes);
	assert.equal(model.remainingCapacityMinutes.value, 1500);
	assert.notEqual(model.remainingCapacityMinutes.value, retiredMixedUnitRemaining);
});

test('C-2 excess uses the per-faculty sum, not the aggregate minus one standard', () => {
	const payload = diagnostics();
	const totals = payload.overloadCapacityTotals;
	const { model } = renderPanel(payload);

	const retiredMixedUnitExcess = Math.max(0, totals.beforeTeachingMinutes - (totals.teachingStandardMinutes as number));
	assert.equal(retiredMixedUnitExcess, 5700);

	assert.ok(isKnown(model.overload));
	assert.equal(model.overload.value.excessMinutes, totals.beforeExcessMinutes);
	assert.equal(model.overload.value.excessMinutes, 2700);
	assert.notEqual(model.overload.value.excessMinutes, retiredMixedUnitExcess);
});

test('C-2 a configured policy with a null canonical basis fails closed per metric', () => {
	const base = diagnostics();
	const payload = diagnostics({
		overloadCapacityTotals: { ...base.overloadCapacityTotals, capacityMinutes: null, beforeExcessMinutes: null },
	});
	const { model } = renderPanel(payload);
	assert.equal(model.remainingCapacityMinutes.state, 'unknown');
	assert.equal(model.overload.state, 'unknown');
	// The other policy metrics stay truthful.
	assert.ok(isKnown(model.policyCapacity));
	assert.ok(isKnown(model.actualTeachingMinutes));
});

/* ================================================================== *
 * R3 — fail-closed controls
 * ================================================================== */

test('R3 a missing canonical authority renders typed unknown, never a fabricated number', () => {
	const { model, markup } = renderPanel(null);
	for (const [key, metric] of Object.entries(model)) {
		assert.equal((metric as TruthMetric<unknown>).state, 'unknown', `${key} must be unknown without authority`);
	}
	assert.equal(metricState(markup, 'teaching-load-truth-required-pairs'), 'unknown');
	assert.equal(metricState(markup, 'teaching-load-truth-assigned-pairs'), 'unknown');
	assert.equal(metricState(markup, 'teaching-load-truth-standard'), 'unknown');
	// No invented 0/30h/5h anywhere in the surface.
	assert.doesNotMatch(markup, />0</);
	assert.doesNotMatch(markup, />30h</);
	assert.doesNotMatch(markup, />5h</);
});

test('R3 an UNCONFIGURED workload policy fails closed for capacity, overload, and remaining', () => {
	const { markup } = renderPanel(diagnostics({
		overloadCapacityTotals: {
			policyStatus: 'UNCONFIGURED',
			teachingStandardMinutes: null,
			hardCapMinutes: null,
			beforeTeachingMinutes: 0,
			afterTeachingMinutes: 0,
			beforeOverStandardCount: 0,
			afterOverStandardCount: 0,
			beforeOverHardCapCount: 0,
			afterOverHardCapCount: 0,
			capacityMinutes: null,
			beforeExcessMinutes: null,
		},
	}), 'UNCONFIGURED');

	for (const testId of [
		'teaching-load-truth-standard',
		'teaching-load-truth-hard-cap',
		'teaching-load-truth-over-standard',
		'teaching-load-truth-over-hard-cap',
		'teaching-load-truth-remaining',
		'teaching-load-truth-actual-hours',
		'teaching-load-truth-advisory-credit',
	]) {
		assert.equal(metricState(markup, testId), 'unknown', `${testId} must be unknown when policy is unconfigured`);
	}
	// Adviser identity is roster authority and stays truthful without a policy.
	assert.equal(metricState(markup, 'teaching-load-truth-advisers'), 'known');
	// The operator sees why, and the demand metrics remain truthful.
	assert.match(markup, /teaching-load-truth-policy-unknown/);
	assert.match(markup, /not configured/i);
	assert.equal(metricState(markup, 'teaching-load-truth-required-pairs'), 'known');
	// The invented defaults must never appear.
	assert.doesNotMatch(markup, />30h</);
	assert.doesNotMatch(markup, />40h</);
	assert.doesNotMatch(markup, />5h</);
});

test('R3 a summary that reports UNCONFIGURED overrides a stale configured totals block', () => {
	const { model } = renderPanel(diagnostics(), 'UNCONFIGURED');
	assert.equal(model.policyCapacity.state, 'unknown');
	assert.equal(model.overload.state, 'unknown');
	assert.equal(model.remainingCapacityMinutes.state, 'unknown');
});

test('R3 a zero teaching standard is not a configured policy', () => {
	const model = buildTeachingLoadTruthModel({
		diagnostics: diagnostics({
			overloadCapacityTotals: {
				policyStatus: 'CONFIGURED',
				teachingStandardMinutes: 0,
				hardCapMinutes: 2400,
				beforeTeachingMinutes: 1000,
				afterTeachingMinutes: 1000,
				beforeOverStandardCount: 0,
				afterOverStandardCount: 0,
				beforeOverHardCapCount: 0,
				afterOverHardCapCount: 0,
				capacityMinutes: 0,
				beforeExcessMinutes: 0,
			},
		}),
		placeholderFacultyIds: PLACEHOLDERS,
		workloadPolicyStatus: 'CONFIGURED',
	});
	assert.equal(model.policyCapacity.state, 'unknown');
});

/* ================================================================== *
 * R3 — zero write dispatch
 * ================================================================== */

test('R3 the truth surface dispatches zero writes and never calls the auto-creating policy GET', () => {
	const dataHook = source('src/hooks/useTeachingLoadData.ts');
	assert.match(dataHook, /'\/faculty-assignments\/authority-diagnostics'/);
	assert.doesNotMatch(dataHook, /policies\/scheduling/);

	// The diagnostics wiring is a GET only: no post/put/patch/delete anywhere in
	// the hook.
	assert.doesNotMatch(dataHook, /atlasApi\.post\(/);
	assert.doesNotMatch(dataHook, /atlasApi\.put\(/);
	assert.doesNotMatch(dataHook, /atlasApi\.delete\(/);
	assert.doesNotMatch(dataHook, /atlasApi\.patch\(/);

	// The panel and its model are pure: no network import at all.
	for (const file of ['src/lib/teaching-load-authority-truth.ts', 'src/components/faculty-assignments/TeachingLoadTruthPanel.tsx']) {
		const text = source(file);
		assert.doesNotMatch(text, /atlasApi/);
		assert.doesNotMatch(text, /policies\/scheduling/);
	}
});

/* ================================================================== *
 * R3 — shell, progressive disclosure, and size caps
 * ================================================================== */

test('R3 the truth panel preserves the no-scroll shell contract', () => {
	const panel = source('src/components/faculty-assignments/TeachingLoadTruthPanel.tsx');
	// Horizontal overflow only, inside a shrink-0 strip; it never introduces a
	// nested vertical scroll trap or a global scrollbar.
	assert.doesNotMatch(panel, /overflow-y-auto/);
	assert.doesNotMatch(panel, /h-screen/);

	const page = source('src/pages/TeachingLoad.tsx');
	assert.match(page, /h-\[calc\(100svh-3\.5rem\)\]/);
	assert.match(page, /<TeachingLoadTruthPanel/);
	// The summary strip is suppressed on very short viewports to protect space.
	assert.match(page, /\[@media\(max-height:640px\)\]:hidden[\s\S]{0,400}<TeachingLoadTruthPanel/);
});

test('R3 every Touch target and detail affordance is a real shadcn control', () => {
	const panel = source('src/components/faculty-assignments/TeachingLoadTruthPanel.tsx');
	// Progressive disclosure uses Popover/Tooltip, never a raw <details> or an
	// HTML `title` attribute on a rendered element.
	assert.doesNotMatch(panel, /<details/);
	assert.doesNotMatch(panel, /<(div|span|p|button|section|li|ul)[^>]*\stitle=/);
	assert.match(panel, /PopoverContent/);
	assert.match(panel, /TooltipContent/);
});

test('R3 component files stay under the 1000 physical line cap', () => {
	for (const file of [
		'src/components/faculty-assignments/TeachingLoadTruthPanel.tsx',
		'src/pages/TeachingLoad.tsx',
		'src/lib/teaching-load-authority-truth.ts',
	]) {
		const lines = source(file).split('\n').length;
		assert.ok(lines < 1000, `${file} is ${lines} lines (cap 1000)`);
	}
});
