/**
 * TT-WARNING-SURFACE-C07B — client warning and publish-readiness truth.
 *
 * Run: `npx tsx --test src/lib/__tests__/tt-warning-surface-realism-c07b.test.ts`
 *
 * Decisive, rendered controls for B1–B7:
 *   B1 run-wide gate decides publish readiness (never the selected-term list)
 *   B2 selected-term rails are labelled and never merge run-wide totals
 *   B3 every displayed blocker action resolves to a real destination
 *   B4 "Treat as Hard"/"Blocks publish" only for the server promotable allowlist
 *   B5 ExplainabilityDrawer uses server publication semantics
 *   B6 PublishChecklistContent groups real production codes
 *   B7 retired-code client residue is gone
 *
 * Correction R1 (TT-WARNING-SURFACE-C07B) adds rendered controls for:
 *   F1 the blocked sentence is driven by the HARD/unresolved pair (never
 *      "0 sessions still need fixing" while listing affected sessions)
 *   F3 aggregate warning rows expose every affected entry
 *   F2 the publish task reaches the real publish-readiness surface (no
 *      corrected-but-unreachable component)
 *   F5 a placement blocker honors the destination unresolved reason
 *
 * Correction R2 (TT-WARNING-SURFACE-C07B) closes the whole sentence-authority
 * contract with PRODUCER-SHAPED fixtures (real `unassignedItems`), because the
 * R1 fixtures built from `draftReport()` had an empty unresolved queue and could
 * not observe the fold of the queue into the hard-blocker count:
 *   - the hard clause is driven only by the hard-violation authority;
 *   - the unresolved clause is the only place unresolved groups appear;
 *   - the sentence/summaryText never contradict the rendered run-wide gate.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import {
	deriveSimplePublishReadiness,
	isBlockingHardViolation,
	isInformationalHardViolation,
	isPublicationBlockingCode,
	resolveBlockerDestination,
	resolvePlacementReasonFilter,
} from '../../components/timetable/simplePublishReadiness';
import { SimplePublishReadinessSheetContent } from '../../components/timetable/SimplePublishReadinessSheet';
import { TimetableTaskDrawer } from '../../components/timetable/TimetableTaskDrawer';
import { resolvePublishTaskDispatch } from '../../components/timetable/simple/SimpleHeaderHelpers';
import { GeneratedViolationsPanel } from '../../components/timetable/GeneratedRunRailPanels';
import type { LeftRailContentContext } from '../../components/timetable/timetableContexts.types';
import { ExplainabilityDrawer } from '../../components/ExplainabilityDrawer';
import { ConstraintRow, SOFT_CONSTRAINT_LABELS, DEFAULT_CONSTRAINT_CONFIG } from '../../components/scheduling-policy/PolicyPanePrimitives';
import { PublishChecklistContent, buildBlockerGroups, UNASSIGNED_GROUP_MAP } from '../../components/timetable/simple/SimpleTaskDrawerHelpers';
import type { DraftReport, UnassignedItem, Violation, ViolationReport } from '../../types';
import { resolveViolationLabel } from '../../hooks/useTimetableData';

const clientRoot = resolve(import.meta.dirname, '../../..');
const repoRoot = resolve(clientRoot, '..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}
function serverSource(path: string): string {
	return readFileSync(resolve(repoRoot, path), 'utf8');
}
function mountedRoutes(): Set<string> {
	const app = source('src/App.tsx');
	return new Set(
		Array.from(app.matchAll(/path:\s*'([^']+)'/g)).map((match) => `/${match[1].replace(/^\//, '')}`),
	);
}

function violation(code: string, severity: 'HARD' | 'SOFT', entities: Violation['entities'] = {}): Violation {
	return { code, severity, message: `${code} message`, entities, schoolId: 1, schoolYearId: 9, runId: 42 } as unknown as Violation;
}

function draftReport(overrides: Record<string, unknown> = {}): DraftReport {
	return {
		runId: 42,
		status: 'COMPLETED',
		entries: [],
		unassignedItems: [],
		summary: {},
		version: 3,
		finishedAt: null,
		createdAt: '2031-01-01T00:00:00.000Z',
		...overrides,
	} as unknown as DraftReport;
}

/** Real `ViolationReport` shape as returned by `GET /generation/.../violations`. */
function violationReport(runWide: NonNullable<ViolationReport['counts']['runWide']>): ViolationReport {
	return {
		runId: 42,
		status: 'COMPLETED',
		violations: [],
		counts: {
			total: 0,
			byCode: {},
			scope: 'SELECTED_TERM',
			runWide,
		},
	};
}

const label = (prefix: string) => (id: number) => `${prefix} ${id}`;

function renderSheet(props: Record<string, unknown>): string {
	return renderToStaticMarkup(
		createElement(MemoryRouter, null,
			createElement(SimplePublishReadinessSheetContent, {
				draft: draftReport(),
				violations: [],
				sectionLabel: label('Section'),
				subjectLabel: label('Subject'),
				facultyLabel: label('Teacher'),
				onNavigateToRepair: () => {},
				onRequestClose: () => {},
				...props,
			}),
		),
	);
}

// ───────────────────────── B1 — run-wide gate ─────────────────────────

test('B1 a run-wide blocking HARD blocks publish even when the selected term is clean', () => {
	const report = violationReport({ total: 3, hard: 3, blockingHard: 2, soft: 1, byCode: { ROOM_TIME_CONFLICT: 2 } });
	const readiness = deriveSimplePublishReadiness(
		draftReport(),
		[], // selected term shows nothing
		label('Section'),
		label('Subject'),
		label('Teacher'),
		{ blockingHardCount: report.counts.runWide?.blockingHard, unassignedCount: 0, softCount: report.counts.runWide?.soft },
	);
	assert.equal(readiness.runWideBlockingHard, 2, 'the gate reads counts.runWide.blockingHard');
	assert.equal(readiness.selectedTermBlockingHard, 0, 'the selected term is genuinely clean');
	assert.equal(readiness.hasBlockers, true);
	assert.equal(readiness.isClean, false);
	assert.doesNotMatch(readiness.summaryText, /Ready to publish/);
});

test('B1 the run-wide gate is clean only when blockingHard and unassigned are both zero', () => {
	const clean = deriveSimplePublishReadiness(
		draftReport(),
		[],
		label('Section'),
		label('Subject'),
		label('Teacher'),
		{ blockingHardCount: 0, unassignedCount: 0, softCount: 0 },
	);
	assert.equal(clean.isClean, true);
	assert.match(clean.summaryText, /Ready to publish/);

	const unassigned = deriveSimplePublishReadiness(
		draftReport(),
		[],
		label('Section'),
		label('Subject'),
		label('Teacher'),
		{ blockingHardCount: 0, unassignedCount: 3, softCount: 0 },
	);
	assert.equal(unassigned.isClean, false);
	assert.equal(unassigned.totalUnresolved, 3);
	assert.equal(unassigned.hasBlockers, true);
});

test('B1 a legacy run summary (blockingHardViolationCount) is consumed when the report is absent', () => {
	const readiness = deriveSimplePublishReadiness(
		draftReport({ summary: { hardViolationCount: 4, blockingHardViolationCount: 1, unassignedCount: 0, softViolationCount: 0 } }),
		[violation('FACULTY_TIME_CONFLICT', 'HARD')],
		label('Section'),
		label('Subject'),
		label('Teacher'),
		null,
	);
	assert.equal(readiness.runWideBlockingHard, 1, 'the persisted summary blocking count is the fallback authority');
	assert.equal(readiness.isClean, false);
});

test('B1 rendered: the sheet never claims ready while the run-wide gate is blocked', () => {
	const blocked = renderSheet({
		runWide: { blockingHardCount: 2, unassignedCount: 0, softCount: 0 },
	});
	assert.match(blocked, /data-testid="timetable-simple-readiness-scope"/, 'the run-wide scope is rendered');
	assert.match(blocked, /data-testid="timetable-simple-run-wide-blocking">2</, 'the run-wide blocking count is shown');
	assert.doesNotMatch(blocked, /data-testid="timetable-simple-ready-to-publish"/);
	assert.doesNotMatch(blocked, /Ready to publish/);

	const clean = renderSheet({ runWide: { blockingHardCount: 0, unassignedCount: 0, softCount: 0 } });
	assert.match(clean, /data-testid="timetable-simple-ready-to-publish"/);
});

// ───────────────────── B2 — labelled selected-term rails ─────────────────────

function railContext(overrides: Record<string, unknown>): LeftRailContentContext {
	const hard = (overrides.violations as Violation[]) ?? [];
	return {
		leftTab: 'violations',
		isPreGenerationWorkspace: false,
		hardViolationCount: 3,
		runWideBlockingHardCount: 3,
		violationScopeLabel: 'Term 2',
		topBlockers: hard,
		violations: hard,
		handleViolationSelect: () => {},
		setSeverityFilter: () => {},
		severityFilter: 'all',
		VIOLATION_LABELS: {},
		violationSearch: '',
		setViolationSearch: () => {},
		filteredViolations: hard,
		violationsByCode: new Map(),
		violationsGroupPage: 10,
		setViolationsGroupPage: () => {},
		selectedViolation: null,
		setDrawerViolation: () => {},
		formatConstraintMessage: (m: string) => m,
		draftBoard: null,
		isDesktop: true,
		setDragItem: () => {},
		toast: { info: () => {}, error: () => {} },
		summary: { classesProcessed: 5, assignedCount: 5, unassignedCount: 0 },
		filteredUnassignedItems: [],
		programKindFilteredUnassignedItems: [],
		unassignedPageSize: 50,
		setUnassignedPageSize: () => {},
		UNASSIGNED_REASON_LABELS: {},
		unassignedReasonFilter: 'all',
		setUnassignedReasonFilter: () => {},
		resolveEntryProgramType: () => null,
		resolveEntryProgramCode: () => null,
		sectionLabel: label('Section'),
		subjectLabel: label('Subject'),
		kbSelectedSource: null,
		buildUnassignedKey: () => 'k',
		followUps: new Set(),
		...overrides,
	} as unknown as LeftRailContentContext;
}

test('B2 the rail labels the selected term and never merges run-wide totals into one number', () => {
	const displayed = [
		violation('ROOM_TIME_CONFLICT', 'HARD'),
		violation('FACULTY_TIME_CONFLICT', 'HARD'),
		violation('FACULTY_TIME_CONFLICT', 'HARD'),
	];
	const markup = renderToStaticMarkup(
		createElement(MemoryRouter, null,
			createElement(GeneratedViolationsPanel, {
				context: railContext({ violations: displayed, filteredViolations: displayed }),
				visibleViolationGroups: [
					['ROOM_TIME_CONFLICT', [displayed[0]]],
					['FACULTY_TIME_CONFLICT', [displayed[1], displayed[2]]],
				],
				violationGroups: [
					['ROOM_TIME_CONFLICT', [displayed[0]]],
					['FACULTY_TIME_CONFLICT', [displayed[1], displayed[2]]],
				],
				hasMoreViolationGroups: false,
			}),
		),
	);
	// Run-wide gate is named as run-wide.
	assert.match(markup, /run-wide hard/);
	// The selected-term scope is labelled explicitly in two places.
	assert.match(markup, /data-testid="generated-rail-scope-note"/);
	assert.match(markup, /Counts below are/);
	assert.match(markup, /Term 2/);
	assert.match(markup, /data-testid="generated-rail-filter-scope-note"/);
	assert.match(markup, /Filter counts are/);
	// Per-code counts carry the term scope next to the number.
	assert.match(markup, /x2 · Term 2/);
	// The filter chips are the term counts (All=3), never the run-wide total (3 hard run-wide is separate).
	assert.match(markup, /All \(3\)/);
});

// ───────────────────── B3 — real destinations ─────────────────────

test('B3 every blocker reason produced by the real derivation resolves to a real destination', () => {
	const draft = draftReport({
		unassignedItems: [],
		summary: { resourceDiagnostics: { unassignedBySubjectGrade: [] } },
	});
	const report = violationReport({ total: 0, hard: 0, blockingHard: 0, soft: 0, byCode: {} });
	const displayed = [
		violation('FACULTY_TIME_CONFLICT', 'HARD', { sectionId: 1, subjectId: 2, facultyId: 3 }),
		violation('ROOM_TIME_CONFLICT', 'HARD', { roomId: 4 }),
		violation('SECTION_TIME_CONFLICT', 'HARD', { sectionId: 5 }),
		violation('FACULTY_OVERLOAD', 'HARD', { facultyId: 3 }),
		violation('FACULTY_SUBJECT_NOT_QUALIFIED', 'HARD', { facultyId: 3, subjectId: 2 }),
		violation('UNASSIGNED_SECTION', 'HARD', { sectionId: 1, subjectId: 2 }),
		violation('LACKING_FACULTY', 'HARD', { sectionId: 6 }),
		violation('INCOMPLETE_MODULAR_GROUP', 'HARD', { sectionId: 7 }),
		violation('ROOM_TYPE_MISMATCH', 'HARD', { roomId: 8 }),
		violation('ROOM_FEATURE_MISMATCH', 'HARD', { roomId: 9 }),
		violation('FACULTY_DAILY_MAX_EXCEEDED', 'HARD', { facultyId: 3 }),
	];
	const readiness = deriveSimplePublishReadiness(
		draft,
		displayed,
		label('Section'),
		label('Subject'),
		label('Teacher'),
		{ blockingHardCount: report.counts.runWide?.blockingHard, unassignedCount: 0, softCount: 0 },
	);
	assert.ok(readiness.blockerGroups.length >= 10, 'every allowlisted production code produced a group');

	const mounted = mountedRoutes();
	for (const group of readiness.blockerGroups) {
		const destination = resolveBlockerDestination(group.reason, group.actionHref);
		const real = destination.kind === 'teaching-load' || destination.kind === 'rooms'
			? destination.href != null && mounted.has(destination.href)
			: destination.kind === 'placement'
				? destination.reason != null
				: destination.code != null || destination.href != null;
		assert.ok(real, `group ${group.reason} must resolve to a real destination (${JSON.stringify(destination)})`);
	}

	// The rendered sheet binds each action to its resolved real destination.
	const markup = renderSheet({ draft, violations: displayed, runWide: { blockingHardCount: 0, unassignedCount: 0, softCount: 0 } });
	assert.match(markup, /data-testid="timetable-simple-blocker-next-action"/);
	const actionKinds = Array.from(markup.matchAll(/data-action-kind="([a-z-]+)"/g)).map((m) => m[1]);
	assert.ok(actionKinds.length >= 10, 'every group rendered an action button');
	assert.ok(actionKinds.every((kind) => ['teaching-load', 'rooms', 'placement', 'review'].includes(kind)), 'no no-op action kind');
	const actionHrefs = Array.from(markup.matchAll(/data-action-href="([^"]*)"/g)).map((m) => m[1]).filter(Boolean);
	for (const href of actionHrefs) {
		assert.ok(mounted.has(href), `every rendered action href is a mounted route: ${href}`);
	}
});

test('B3 the shared resolver never returns a no-op destination for a real blocker', () => {
	for (const reason of [
		'FACULTY_TIME_CONFLICT', 'ROOM_TIME_CONFLICT', 'SECTION_TIME_CONFLICT', 'FACULTY_OVERLOAD',
		'FACULTY_SUBJECT_NOT_QUALIFIED', 'UNASSIGNED_SECTION', 'LACKING_FACULTY', 'INCOMPLETE_MODULAR_GROUP',
		'ROOM_TYPE_MISMATCH', 'ROOM_FEATURE_MISMATCH', 'FACULTY_DAILY_MAX_EXCEEDED',
		'FACULTY_OVERLOADED', 'NO_QUALIFIED_FACULTY', 'NO_AVAILABLE_SLOT', 'NO_COMPATIBLE_ROOM', 'ROOM_CAPACITY_EXCEEDED',
	]) {
		const destination = resolveBlockerDestination(reason, '/timetable');
		assert.notEqual(destination.kind, undefined);
		assert.ok(['teaching-load', 'rooms', 'placement', 'review'].includes(destination.kind), reason);
	}
	// A conflict/structural code routes to the review rail selecting that code.
	const review = resolveBlockerDestination('ROOM_TIME_CONFLICT', '/timetable');
	assert.equal(review.kind, 'review');
	assert.equal(review.code, 'ROOM_TIME_CONFLICT');
	// Teaching-load and room codes route to mounted routes.
	assert.equal(resolveBlockerDestination('FACULTY_OVERLOAD').href, '/teaching-load');
	assert.equal(resolveBlockerDestination('ROOM_FEATURE_MISMATCH').href, '/map');
	assert.equal(resolveBlockerDestination('UNASSIGNED_SECTION').kind, 'placement');
});

// ───────────────────── B4 — promotable allowlist ─────────────────────

function renderConstraintRow(promotable: boolean): string {
	return renderToStaticMarkup(
		createElement(ConstraintRow, {
			code: 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED' as never,
			label: 'Consecutive Teaching Limit',
			explanation: 'x',
			config: { enabled: true, weight: 5, treatAsHard: false },
			promotable,
			onToggleEnabled: () => {},
			onWeightChange: () => {},
			onToggleTreatAsHard: () => {},
		}),
	);
}

test('B4 the promotion control renders only for server-promotable codes', () => {
	const promotable = renderConstraintRow(true);
	assert.match(promotable, /data-testid="constraint-treat-as-hard"/);
	assert.doesNotMatch(promotable, /data-testid="constraint-not-promotable"/);

	const notPromotable = renderConstraintRow(false);
	assert.doesNotMatch(notPromotable, /data-testid="constraint-treat-as-hard"/, 'no dead promotion switch is offered');
	assert.match(notPromotable, /data-testid="constraint-not-promotable"/);
	assert.match(notPromotable, /never a publish blocker/);
});

test('B4 the client code predicate agrees with the server allowlist for every policy-pane code', () => {
	// Every non-allowlisted soft code must be reported non-promotable.
	for (const code of Object.keys(SOFT_CONSTRAINT_LABELS)) {
		const allowlisted = isPublicationBlockingCode(code);
		const inServerMirror = new Set([
			'FACULTY_TIME_CONFLICT', 'ROOM_TIME_CONFLICT', 'SECTION_TIME_CONFLICT', 'FACULTY_OVERLOAD',
			'FACULTY_SUBJECT_NOT_QUALIFIED', 'UNASSIGNED_SECTION', 'LACKING_FACULTY', 'INCOMPLETE_MODULAR_GROUP',
			'ROOM_TYPE_MISMATCH', 'ROOM_FEATURE_MISMATCH', 'FACULTY_DAILY_MAX_EXCEEDED',
		]).has(code);
		assert.equal(allowlisted, inServerMirror, `promotability must match the server allowlist: ${code}`);
	}
	// The pane's render list comes from the soft labels, and none of those is a
	// default-true promotion candidate except the allowlisted ones.
	assert.equal(isPublicationBlockingCode('ROOM_CAPACITY_EXCEEDED'), false);
	assert.equal(isPublicationBlockingCode('FACULTY_FLOOR_TRANSITION'), false);
	assert.equal(isPublicationBlockingCode('FACULTY_DAILY_MAX_EXCEEDED'), true);
	// The pane consumes the real predicate, not a local copy.
	const pane = source('src/components/SchedulingPolicyPane.tsx');
	assert.match(pane, /isPublicationBlockingCode\(code\)/);
	assert.ok(!/SOFT_CONSTRAINT_LABELS\)\.map\(\(\[code, info\]\) => \{\s*\n\s*const cfg[\s\S]{0,400}promotable=\{true\}/.test(pane));
});

test('B4 default constraint config never defaults treatAsHard true for a non-promotable code', () => {
	for (const [code, config] of Object.entries(DEFAULT_CONSTRAINT_CONFIG)) {
		if (config.treatAsHard) {
			assert.equal(isPublicationBlockingCode(code), true, `${code} cannot default to Blocks publish`);
		}
	}
});

// ───────────────────── B5 — explainability semantics ─────────────────────

function renderDrawer(code: string, severity: 'HARD' | 'SOFT'): string {
	return renderToStaticMarkup(
		createElement(MemoryRouter, null,
			createElement(ExplainabilityDrawer, {
				open: true,
				onClose: () => {},
				violation: violation(code, severity),
			}),
		),
	);
}

test('B5 a non-allowlisted HARD is explicitly NOT a publish blocker', () => {
	const markup = renderDrawer('FACULTY_FLOOR_TRANSITION', 'HARD');
	assert.match(markup, /data-testid="explain-not-publish-blocker"/);
	assert.doesNotMatch(markup, /data-testid="explain-publish-blocker"/);
	assert.match(markup, /Hard Violation \(informational\)/);
});

test('B5 an allowlisted HARD is a publish blocker; a SOFT is neither', () => {
	const blocking = renderDrawer('ROOM_TIME_CONFLICT', 'HARD');
	assert.match(blocking, /data-testid="explain-publish-blocker"/);
	assert.doesNotMatch(blocking, /data-testid="explain-not-publish-blocker"/);

	const soft = renderDrawer('FACULTY_FLOOR_TRANSITION', 'SOFT');
	assert.doesNotMatch(soft, /data-testid="explain-publish-blocker"/);
	assert.doesNotMatch(soft, /data-testid="explain-not-publish-blocker"/);
	assert.match(soft, /Soft Violation/);
});

// ───────────────────── B6 — real production code grouping ─────────────────────

test('B6 blocker grouping keeps real production codes with truthful counts', () => {
	const groups = buildBlockerGroups(
		[
			violation('ROOM_TIME_CONFLICT', 'HARD', { sectionId: 1, subjectId: 2 }),
			violation('ROOM_TIME_CONFLICT', 'HARD', { sectionId: 3, subjectId: 4 }),
			violation('FACULTY_TIME_CONFLICT', 'HARD', { sectionId: 5, subjectId: 6 }),
			violation('LACKING_FACULTY', 'HARD', { sectionId: 7, subjectId: 8 }),
			// Legacy informational HARD must never be presented as a blocker.
			violation('FACULTY_EXCESSIVE_TRAVEL_DISTANCE', 'HARD'),
		],
		label('Section'),
		label('Subject'),
		label('Teacher'),
	);
	const byReason = new Map(groups.map((group) => [group.reason, group.count]));
	assert.equal(byReason.get('ROOM_TIME_CONFLICT'), 2);
	assert.equal(byReason.get('FACULTY_TIME_CONFLICT'), 1);
	assert.equal(byReason.get('LACKING_FACULTY'), 1);
	assert.equal(byReason.has('FACULTY_EXCESSIVE_TRAVEL_DISTANCE'), false);
	assert.equal(groups.length, 3);
	// Existing reason-key entries keep their plain-language next step.
	const legacy = buildBlockerGroups(
		[{ severity: 'HARD', code: 'NO_AVAILABLE_SLOT', entities: { sectionId: 1, subjectId: 2 } } as never],
		label('Section'),
		label('Subject'),
		label('Teacher'),
	);
	assert.equal(legacy.length, 1);
	assert.equal(legacy[0].items[0].nextStep, 'No allowed time slot was found. Try manual placement or review the scheduling policy.');
});

test('B6 the publish button disables on the run-wide gate, not the selected-term list', () => {
	const props = {
		runId: 42,
		assignedCount: 5,
		unassignedCount: 0,
		hardCount: 1,
		softCount: 0,
		violationScopeLabel: 'Term 2',
		violations: [] as Violation[],
		sectionLabel: label('Section'),
		subjectLabel: label('Subject'),
		facultyLabel: label('Teacher'),
		onPublish: () => {},
		onReviewIssues: () => {},
		onPlaceUnresolved: () => {},
		onOpenTeachingLoad: () => {},
		onOpenRoomSetup: () => {},
		onSelectViolation: () => {},
	};
	// Run-wide blocking hard present → disabled.
	const blocked = renderToStaticMarkup(createElement(PublishChecklistContent, { ...props, blockingHardCount: 1 }));
	assert.match(blocked, /disabled=""[^>]*data-|disabled=""[^>]*>Publish schedule/);
	assert.match(blocked, /data-testid="timetable-publish-scope-note"/);
	assert.match(blocked, /Term 2/);

	// Total HARD exists but no allowlisted blocking hard → publish stays enabled.
	const allowed = renderToStaticMarkup(createElement(PublishChecklistContent, { ...props, blockingHardCount: 0 }));
	assert.doesNotMatch(allowed, /disabled=""/);
	assert.match(allowed, /Schedule is clean and ready to publish/);

	// Run-wide unassigned sessions also disable.
	const unassigned = renderToStaticMarkup(createElement(PublishChecklistContent, { ...props, blockingHardCount: 0, unassignedCount: 2 }));
	assert.match(unassigned, /disabled=""/);
});

// ───────────────────── B7 — retired residue ─────────────────────

test('B7 the retired travel metric has no operative client residue', () => {
	const retired = 'FACULTY_EXCESSIVE_TRAVEL_DISTANCE';
	assert.ok(!source('src/components/ExplainabilityDrawer.tsx').includes(retired), 'ExplainabilityDrawer keeps no travel explanation');
	assert.ok(!source('src/components/PolicyImpactSummary.tsx').includes(retired), 'PolicyImpactSummary keeps no travel label');
	assert.ok(!source('src/components/timetable/simplePublishReadiness.ts').includes(retired), 'the warning label map no longer lists travel');
	assert.ok(!source('src/components/timetable/TimetableShared.tsx').includes('estimatedDistanceMeters'), 'no dead distance readout');
	assert.ok(!source('src/components/timetable/TimetableShared.tsx').includes('maxWalkingDistanceMetersPerTransition'), 'no dead travel threshold readout');

	// The WELLBEING family no longer advertises the retired metric.
	const wellbeingBlocks = source('src/hooks/useTimetableData.ts').match(/const WELLBEING_CODES[\s\S]*?\]\);/)?.[0] ?? '';
	assert.ok(wellbeingBlocks.length > 0 && !wellbeingBlocks.includes(retired), 'useTimetableData wellbeing family excludes travel');
	const constantsWellbeing = source('src/components/timetable/ScheduleReviewWorkspace.constants.ts').match(/export const WELLBEING_CODES[\s\S]*?\]\);/)?.[0] ?? '';
	assert.ok(constantsWellbeing.length > 0 && !constantsWellbeing.includes(retired), 'rail wellbeing family excludes travel');

	// The legacy label fallback is intentionally retained for old persisted runs.
	//
	// ── SUPERSEDED IN PLACE by PLAIN-LANGUAGE-J2J3-C01 (J2), 2026-09-26 ──
	// The original assertion is retained VERBATIM below as the record of the
	// decision being superseded; it is not run as pass/fail. It pinned the
	// fallback to one FILE (`useTimetableData.ts`), which was only ever a proxy
	// for the real requirement — "old persisted runs still render a readable
	// label". J2 collapsed the two copies of the humanising rule (the label map
	// and the retired-code fallback) into one shared rule in
	// `lib/violation-presentation.ts`, so the file pin broke while the behaviour
	// it protected is unchanged. The replacement rows below assert the actual
	// requirement instead: the fallback is present in the module that now owns
	// it, the public resolver still returns the readable label at runtime, and
	// the rail resolver still delegates to that one rule. The capability this
	// row exists to protect is therefore NOT given up.
	//   assert.ok(source('src/hooks/useTimetableData.ts').includes(`${retired}: 'Excessive Travel Distance'`), 'legacy runs still render a readable label');
	assert.ok(
		source('src/lib/violation-presentation.ts').includes(`${retired}: 'Excessive Travel Distance'`),
		'the legacy label fallback lives in the shared presentation module that now owns the humanising rule',
	);
	// Behaviour, not a file pin: this is what the superseded assertion was for.
	assert.equal(
		resolveViolationLabel(retired),
		'Excessive Travel Distance',
		'legacy runs still render a readable label (runtime proof, not a source-location proxy)',
	);
	assert.ok(
		source('src/hooks/useTimetableData.ts').includes('resolveViolationTitle'),
		'the rail resolver delegates to the one shared humanising rule instead of holding a second copy',
	);
	assert.ok(source('src/types.ts').includes(`'${retired}'`), 'the wire union still accepts a legacy persisted code');
});

test('B7 the stale duplicate types.d.ts authority is gone and nothing imports it', () => {
	assert.equal(existsSync(resolve(clientRoot, 'src/types.d.ts')), false, 'types.d.ts must be deleted');
	assert.ok(!source('src/App.tsx').includes('types.d.ts'));
	assert.ok(source('src/types.ts').includes('ROOM_FEATURE_MISMATCH'));
});

// ───────────────────── composition binding ─────────────────────

test('the Radix sheet renders exactly the asserted production content', () => {
	const sheet = source('src/components/timetable/SimplePublishReadinessSheet.tsx');
	// One rendering path: SheetContent renders SimplePublishReadinessSheetContent.
	assert.match(sheet, /<SimplePublishReadinessSheetContent/);
	assert.match(sheet, /export function SimplePublishReadinessSheetContent/);
	assert.match(sheet, /deriveSimplePublishReadiness\(draft, violations, sectionLabel, subjectLabel, facultyLabel, runWide\)/);
	// The header mount path supplies the run-wide gate authority.
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /runWide=\{\{/);
	assert.match(header, /blockingHardCount: context\.blockingHardCount/);
	assert.match(header, /unassignedCount: context\.summary\?\.unassignedCount \?\? 0/);
});

// ───────────────────── MUTANT CONTROLS ─────────────────────
// Each mutant reimplements the old/broken behaviour inline and proves the
// production result differs. Reintroducing the mutant makes these fail.

test('mutant: substituting the run-wide gate with the selected-term list is detected', () => {
	// Old behaviour: clean iff the term-filtered list has no allowlisted HARD and
	// the draft has no unassigned items.
	const mutantClean = (draft: DraftReport, displayed: Violation[]): boolean =>
		displayed.filter(isBlockingHardViolation).length === 0 && (draft.unassignedItems ?? []).length === 0;
	const draft = draftReport();
	const production = deriveSimplePublishReadiness(
		draft, [], label('Section'), label('Subject'), label('Teacher'),
		{ blockingHardCount: 2, unassignedCount: 0, softCount: 0 },
	);
	assert.equal(mutantClean(draft, []), true, 'the mutant says clean');
	assert.equal(production.isClean, false, 'the production gate blocks on the run-wide count');
	assert.notEqual(production.isClean, mutantClean(draft, []), 'the mutant is detected');
});

test('mutant: treating every soft code as promotable is detected', () => {
	const mutantPromotable = () => true;
	const softCodes = Object.keys(SOFT_CONSTRAINT_LABELS);
	assert.ok(softCodes.length > 0);
	const divergences = softCodes.filter((code) => mutantPromotable() !== isPublicationBlockingCode(code));
	assert.ok(divergences.length > 0, 'the all-promotable mutant diverges from the production predicate');
});

test('mutant: labelling every HARD as a publish blocker is detected', () => {
	// Old behaviour: `severity === 'HARD'` alone.
	const mutantIsPublishBlocker = (severity: string) => severity === 'HARD';
	const informational = violation('FACULTY_FLOOR_TRANSITION', 'HARD');
	const structural = violation('ROOM_TIME_CONFLICT', 'HARD');
	assert.equal(mutantIsPublishBlocker(informational.severity), true, 'the mutant blocks on any HARD');
	assert.equal(isBlockingHardViolation(informational), false, 'production keeps the retired metric informational');
	assert.notEqual(isBlockingHardViolation(informational), mutantIsPublishBlocker(informational.severity), 'the mutant is detected');
	assert.equal(isBlockingHardViolation(structural), true);
	assert.equal(isInformationalHardViolation(structural), false);
	// And the rendered drawer agrees with production, not the mutant.
	assert.doesNotMatch(renderDrawer('FACULTY_FLOOR_TRANSITION', 'HARD'), /data-testid="explain-publish-blocker"/);
	assert.match(renderDrawer('ROOM_TIME_CONFLICT', 'HARD'), /data-testid="explain-publish-blocker"/);
});

test('mutant: restoring a no-op default action is detected', () => {
	const mutantDefault = () => ({ kind: 'none', href: null, code: null, reason: null });
	const production = resolveBlockerDestination('FACULTY_TIME_CONFLICT', '/timetable');
	assert.equal(mutantDefault().kind, 'none');
	assert.notEqual(production.kind, mutantDefault().kind, 'the production resolver never returns a no-op kind');
	assert.equal(production.kind, 'review');
	assert.equal(production.code, 'FACULTY_TIME_CONFLICT');
});

test('mutant: restoring reason-key-only grouping is detected', () => {
	const mutantGroups = (violations: Violation[]) =>
		violations.filter((v) => v.severity === 'HARD' && UNASSIGNED_GROUP_MAP[v.code]);
	const productionInput = [
		violation('ROOM_TIME_CONFLICT', 'HARD', { sectionId: 1, subjectId: 2 }),
		violation('ROOM_TIME_CONFLICT', 'HARD', { sectionId: 3, subjectId: 4 }),
	];
	assert.equal(mutantGroups(productionInput).length, 0, 'the old grouping drops real production codes');
	const groups = buildBlockerGroups(productionInput, label('Section'), label('Subject'), label('Teacher'));
	assert.equal(groups.length, 1, 'the production grouping keeps them');
	assert.equal(groups[0].count, 2);
});

// ═════════════════════════ C07B CORRECTION R1 ═════════════════════════
// The candidate's blocked message counted `totalUnresolved` alone, so a
// hard-blocker-only block rendered "0 sessions still need fixing" while listing
// affected sessions. These controls exercise the same rendered surface.

/** The draft shape the QA reproduction used: run-wide blockers, zero unresolved. */
function diagnosticsDraft(): DraftReport {
	return draftReport({
		unassignedItems: [],
		summary: {
			resourceDiagnostics: {
				unassignedBySubjectGrade: [
					{ subjectId: 2, subjectCode: 'SCI', gradeLevel: 8, count: 2, reasons: { NO_COMPATIBLE_ROOM: 2 } },
				],
			},
		},
	});
}

function blockerSentenceFromMarkup(markup: string): string {
	const match = markup.match(/data-testid="timetable-simple-blocker-sentence"[^>]*>([\s\S]*?)<\/p>/);
	assert.ok(match, 'a blocked sheet must render the blocker sentence');
	return match![1];
}

function softViolations(count: number): Violation[] {
	return Array.from({ length: count }, (_, index) =>
		violation('FACULTY_FLOOR_TRANSITION', 'SOFT', { sectionId: index + 1, subjectId: 7, facultyId: index + 1 }),
	);
}

// ── F1 — the rendered block message is truthful in every gate branch ──

test('F1 rendered (a): run-wide hard blockers with zero unresolved sessions never claim zero sessions need fixing', () => {
	const markup = renderSheet({
		draft: diagnosticsDraft(),
		violations: [],
		runWide: { blockingHardCount: 2, unassignedCount: 0, softCount: 0 },
	});
	// The gate blocks AND the affected sessions are listed…
	assert.match(markup, /Cannot publish yet/);
	assert.match(markup, /data-testid="timetable-simple-blocker-group"/);
	assert.match(markup, /sessions affected/);
	// …so the sentence must name the hard blockers, never the false zero claim.
	assert.equal(
		blockerSentenceFromMarkup(markup),
		'2 hard blockers still need fixing before this schedule can be published.',
	);
	assert.doesNotMatch(markup, /0 sessions? still need fixing/);
	assert.doesNotMatch(markup, /session[s]? still need fixing/);
});

test('F1 rendered (b): a selected-term-only allowlisted HARD with a clean run-wide gate stays truthful', () => {
	const markup = renderSheet({
		violations: [violation('ROOM_TIME_CONFLICT', 'HARD', { sectionId: 1, subjectId: 2, facultyId: 3 })],
		runWide: { blockingHardCount: 0, unassignedCount: 0, softCount: 0 },
	});
	assert.match(markup, /data-blocker-scope="selected-term"/);
	assert.equal(
		blockerSentenceFromMarkup(markup),
		'1 hard blocker still needs fixing before this schedule can be published.',
	);
	assert.doesNotMatch(markup, /0 sessions? still need fixing/);
});

test('F1 rendered (c): the fully clean gate says Ready to publish', () => {
	const markup = renderSheet({ violations: [], runWide: { blockingHardCount: 0, unassignedCount: 0, softCount: 0 } });
	assert.match(markup, /data-testid="timetable-simple-ready-to-publish"/);
	assert.match(markup, /Ready to publish/);
	assert.doesNotMatch(markup, /Cannot publish yet/);
});

test('F1 rendered: an unresolved-only block names the sessions and invents no hard blocker', () => {
	const markup = renderSheet({
		violations: [],
		runWide: { blockingHardCount: 0, unassignedCount: 3, softCount: 0 },
	});
	assert.match(markup, /Cannot publish yet/);
	assert.equal(
		blockerSentenceFromMarkup(markup),
		'3 unresolved sessions still need fixing before this schedule can be published.',
	);
	assert.doesNotMatch(markup, /hard blocker/);
});

test('F1 summaryText is driven by the same hard/unresolved pair', () => {
	const hardOnly = deriveSimplePublishReadiness(
		draftReport(), [], label('Section'), label('Subject'), label('Teacher'),
		{ blockingHardCount: 2, unassignedCount: 0, softCount: 0 },
	);
	assert.equal(hardOnly.totalUnresolved, 0, 'the run-wide unresolved count is genuinely zero');
	assert.equal(hardOnly.totalHardBlockers, 2, 'the run-wide hard gate is what blocks');
	assert.match(hardOnly.summaryText, /Cannot publish yet\n2 hard blockers still need fixing before this schedule can be published\./);
	assert.doesNotMatch(hardOnly.summaryText, /0 sessions still need fixing/);

	const unresolvedOnly = deriveSimplePublishReadiness(
		draftReport(), [], label('Section'), label('Subject'), label('Teacher'),
		{ blockingHardCount: 0, unassignedCount: 2, softCount: 0 },
	);
	assert.match(unresolvedOnly.summaryText, /2 unresolved sessions still need fixing/);
	assert.doesNotMatch(unresolvedOnly.summaryText, /hard blocker/);

	const both = deriveSimplePublishReadiness(
		draftReport(), [], label('Section'), label('Subject'), label('Teacher'),
		{ blockingHardCount: 1, unassignedCount: 2, softCount: 0 },
	);
	assert.match(both.summaryText, /1 hard blocker and 2 unresolved sessions still need fixing/);
	assert.equal(both.blockerSentence, '1 hard blocker and 2 unresolved sessions still need fixing before this schedule can be published.');
});

test('mutant: deriving the block sentence from totalUnresolved alone is detected', () => {
	// The candidate's rule: the sentence counted unresolved sessions only.
	const mutantSentence = (unresolved: number) =>
		`${unresolved} session${unresolved === 1 ? '' : 's'} still need fixing before this schedule can be published.`;
	const readiness = deriveSimplePublishReadiness(
		draftReport(), [], label('Section'), label('Subject'), label('Teacher'),
		{ blockingHardCount: 2, unassignedCount: 0, softCount: 0 },
	);
	assert.match(mutantSentence(readiness.totalUnresolved), /^0 sessions still need fixing/, 'the mutant ships the false zero claim');
	assert.notEqual(readiness.blockerSentence, mutantSentence(readiness.totalUnresolved), 'production is not the unresolved-only mutant');

	const mutantMarkup = renderToStaticMarkup(
		createElement(MemoryRouter, null,
			createElement('p', { 'data-testid': 'timetable-simple-blocker-sentence' }, mutantSentence(readiness.totalUnresolved)),
		),
	);
	assert.match(mutantMarkup, /0 sessions still need fixing/, 'the mutant markup carries the contradiction');
	assert.doesNotMatch(
		renderSheet({ draft: diagnosticsDraft(), runWide: { blockingHardCount: 2, unassignedCount: 0, softCount: 0 } }),
		/0 sessions still need fixing/,
		'the production sheet never carries it',
	);
});

// ── F3 — aggregate warning rows expose every affected entry ──

test('F3 every aggregate warning row exposes its affected entries with conserved counts', () => {
	const softs = softViolations(5);
	const readiness = deriveSimplePublishReadiness(
		draftReport(), softs, label('Section'), label('Subject'), label('Teacher'),
		{ blockingHardCount: 0, unassignedCount: 0, softCount: 5 },
	);
	assert.equal(readiness.warningGroups.length, 1);
	assert.equal(readiness.warningGroups[0].count, 5);
	assert.equal(readiness.warningGroups[0].items.length, 5, 'count and exposed entries agree — no warning is dropped');
	assert.equal(readiness.selectedTermWarningCount, 5);
	assert.deepEqual(readiness.warningGroups[0].items[0], {
		sectionLabel: 'Section 1',
		subjectLabel: 'Subject 7',
		facultyLabel: 'Teacher 1',
	});

	const markup = renderSheet({ violations: softs, runWide: { blockingHardCount: 0, unassignedCount: 0, softCount: 5 } });
	assert.match(markup, /data-testid="timetable-simple-warning-row"/);
	assert.equal(
		(markup.match(/data-testid="timetable-simple-warning-item"/g) ?? []).length,
		3,
		'the first three affected entries render immediately',
	);
	assert.match(markup, /data-testid="timetable-simple-warning-expand"[^>]*>Show 2 more</, 'the remaining entries stay reachable');
	assert.match(markup, /5 sessions affected/);
	assert.doesNotMatch(markup, /data-testid="timetable-simple-warning-scope-note"/, 'an equal run-wide total needs no scope note');
});

test('F3 the warning rows state their scope when the run-wide total exceeds the selected term', () => {
	const softs = softViolations(2);
	const readiness = deriveSimplePublishReadiness(
		draftReport(), softs, label('Section'), label('Subject'), label('Teacher'),
		{ blockingHardCount: 0, unassignedCount: 0, softCount: 5 },
	);
	assert.equal(readiness.selectedTermWarningCount, 2);
	const markup = renderSheet({ violations: softs, runWide: { blockingHardCount: 0, unassignedCount: 0, softCount: 5 } });
	assert.match(
		markup,
		/data-testid="timetable-simple-warning-scope-note"[^>]*>Showing 2 of 5 run-wide warnings in the selected term\./,
	);
});

test('mutant: the label+count-only aggregate warning row drops the affected entries', () => {
	const readiness = deriveSimplePublishReadiness(
		draftReport(), softViolations(4), label('Section'), label('Subject'), label('Teacher'),
		{ blockingHardCount: 0, unassignedCount: 0, softCount: 4 },
	);
	const group = readiness.warningGroups[0];
	// The candidate's markup: a label and a number, nothing else.
	const mutantMarkup = `<div class="flex items-center justify-between"><span>${group.plainLabel}</span><span>${group.count}</span></div>`;
	assert.doesNotMatch(mutantMarkup, /data-testid="timetable-simple-warning-item"/, 'the mutant exposes no entry');
	assert.equal(group.items.length, group.count, 'production keeps one entry per counted warning');
	const production = renderSheet({ violations: softViolations(4), runWide: { blockingHardCount: 0, unassignedCount: 0, softCount: 4 } });
	assert.match(production, /data-testid="timetable-simple-warning-item"/);
	assert.match(production, /Show 1 more/);
});

// ── F2 — the publish task reaches a real publish-readiness surface ──

test('F2 the publish task dispatch is the production rule, not a dead branch', () => {
	assert.equal(resolvePublishTaskDispatch(true), 'publish-task', 'an open gate arms the publish task');
	assert.equal(resolvePublishTaskDispatch(false), 'readiness-sheet', 'a closed gate opens the read-only sheet');
	// Mutant: the candidate opened the dialog without ever arming the task.
	const mutantDispatch = () => 'readiness-sheet';
	assert.notEqual(resolvePublishTaskDispatch(true), mutantDispatch(), 'the mutant keeps the checklist unreachable');
	assert.equal(resolvePublishTaskDispatch(false), mutantDispatch());
});

test('F2 rendered: the publish task renders the real publish checklist', () => {
	const markup = renderToStaticMarkup(
		createElement(MemoryRouter, null,
			createElement(TimetableTaskDrawer, {
				task: 'publish',
				onTaskChange: () => {},
				leftRailContentContext: {} as never,
				hardCount: 2,
				blockingHardCount: 2,
				softCount: 0,
				violationScopeLabel: 'Term 1',
				unassignedCount: 0,
				assignedCount: 5,
				runId: 42,
				isPreGenerationWorkspace: false,
				onPublish: () => {},
				violations: [violation('ROOM_TIME_CONFLICT', 'HARD', { sectionId: 1, subjectId: 2, facultyId: 3 })],
				sectionLabel: label('Section'),
				subjectLabel: label('Subject'),
				facultyLabel: label('Teacher'),
			}),
		),
	);
	assert.match(markup, /data-testid="timetable-task-drawer"/);
	assert.match(markup, /data-testid="timetable-publish-readiness-summary"/);
	// SUPERSEDED IN PART (LANE-C-PLAIN-LANGUAGE-C03, J1, 2026-09-26). The original
	// assertion is RETAINED verbatim as evidence of the retired vocabulary, per
	// AGENTS.md 16 (corrections are additive; an assertion is never deleted to close
	// a finding):
	//   assert.match(markup, /Blocking hard violations \(run-wide\): 2/);
	// It asserted the same fact in a retired word. Audit finding 3 found one HARD
	// problem carried FOUR names on one screen (Must fix / Blocked / blocker / Hard)
	// and the scope jargon "run-wide" was never explained. The replacements below
	// assert the same value and the same intent in the single plain label, and prove
	// no competing name survives on the same surface.
	assert.match(markup, /Must fix \(whole year\): 2/);
	assert.doesNotMatch(markup, /Blocking hard violations/, 'the retired second name for the same problem is gone from the publish checklist');
	assert.doesNotMatch(markup, /\(run-wide\)/, 'the retired run-wide scope jargon is gone from the scheduler-facing checklist');
	// The retired LABEL form is a count paired with the word (the old "3 blockers"
	// chip). Natural prose that happens to use the word is not jargon and is not
	// what audit finding 3 flagged, so this targets the count+label shape only.
	assert.doesNotMatch(markup, /\d+\s+blockers?\b/i, 'no count is labelled with the retired blocker wording');
	// ── ADDED (LANE-C-PLAIN-LANGUAGE-C03 J1r, QA F11), the tag-tolerant variant.
	// The assertion above reads RAW MARKUP, so a regression that splits the number
	// and the noun across elements — `<span>3</span> blockers`, or a `</li></ul>`
	// between them — slips past it. This variant strips the tags first and asserts
	// against the text the scheduler actually reads, the same technique PL-J1.3
	// uses. The markup row is RETAINED above, not replaced.
	//
	// This variant is not decorative: run first at the J1r candidate it FAILED on
	// the checklist's own scope note ("...: 0 Blockers listed below are scoped
	// to Term 1"), which the raw-markup row could not see because a `</li></ul>`
	// sat between the digit and the word. `SimpleTaskDrawerHelpers.tsx` was
	// corrected; the row now holds.
	const renderedText = markup.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
	assert.match(renderedText, /Must fix \(whole year\): 2/, 'the stripped text is not empty (positive control)');
	assert.doesNotMatch(renderedText, /\d+\s+blockers?\b/i, 'no count is labelled with the retired blocker wording, even when the markup splits them across elements');
	assert.doesNotMatch(renderedText, /\d+\s+classes\b/i, 'the unplaced count is never labelled "classes" (it is sessions) — the same count+label shape as the retired blocker wording');
	// END SUPERSEDED-IN-PART
	assert.match(markup, /data-testid="timetable-publish-blocked-reason"/);
	assert.match(markup, /Publish schedule/);
});

test('F2 the header routes the publish task to that surface through the shared dispatcher', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(
		header,
		/resolvePublishTaskDispatch\(capabilities\.gates\.publication\.enabled\) === 'publish-task'[\s\S]{0,240}onTaskChange\('publish'\)/,
		'the shared dispatcher arms the publish task',
	);
	assert.doesNotMatch(header, /setUnassignedReasonFilter\('NO_AVAILABLE_SLOT'\)/);
	const drawer = source('src/components/timetable/TimetableTaskDrawer.tsx');
	assert.match(
		drawer,
		/task === 'swap-sessions'[\s\S]*?<PublishChecklistContent/,
		'the drawer renders the publish checklist after the other task branches',
	);
	assert.match(drawer, /publish: \{\s*\n\s*title: 'Publish schedule'/);
	assert.match(source('src/components/timetable/simple/SimpleHeaderHelpers.tsx'), /export function resolvePublishTaskDispatch/);
});

// ── F5 — a placement blocker honors the destination reason ──

test('F5 a placement blocker honors the destination reason instead of a hardcoded one', () => {
	const slot = resolveBlockerDestination('NO_AVAILABLE_SLOT', '/timetable');
	assert.equal(slot.kind, 'placement');
	assert.equal(slot.reason, 'NO_AVAILABLE_SLOT');
	assert.equal(resolvePlacementReasonFilter(slot), 'NO_AVAILABLE_SLOT', 'the exact destination reason is honored');

	const section = resolveBlockerDestination('UNASSIGNED_SECTION', '/timetable');
	assert.equal(section.kind, 'placement');
	assert.equal(section.reason, 'UNASSIGNED_SECTION');
	assert.notEqual(resolvePlacementReasonFilter(section), 'NO_AVAILABLE_SLOT', 'the hardcoded slot filter is gone');
	assert.equal(resolvePlacementReasonFilter(section), 'all', 'no wrong narrowing that would hide the unplaced sessions');

	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /const reasonFilter = resolvePlacementReasonFilter\(destination\)/);
	assert.match(header, /context\.setUnassignedReasonFilter\(reasonFilter\)/);
});

test('F5 UNASSIGNED_SECTION is a violation code, never a filterable item reason', () => {
	// Evidence for the disposition above: the server-side `UnassignedItem.reason`
	// union (the only values the unresolved queue can be filtered by) never
	// contains UNASSIGNED_SECTION.
	const constructorSource = serverSource('atlas-server/src/services/schedule-constructor.ts');
	const unionMatch = constructorSource.match(/reason: 'NO_QUALIFIED_FACULTY'[^;]*?;/);
	assert.ok(unionMatch, 'the server unassigned-reason union is present');
	assert.ok(!unionMatch![0].includes('UNASSIGNED_SECTION'), 'the item-level union never contains UNASSIGNED_SECTION');
	assert.ok(unionMatch![0].includes('NO_AVAILABLE_SLOT'), 'NO_AVAILABLE_SLOT is a real filterable reason');

	// R3 — the durable client authority. Deliberately version-agnostic across both
	// the legacy generation-service ternary and the C07A truthful classifier that
	// replaced it: the unresolved queue is filtered by `UnassignedReason`, whose
	// wire union holds only real item-level causes and must never gain the
	// `UNASSIGNED_SECTION` violation code.
	// Block comments are removed first so a `;` inside an inline doc comment
	// cannot truncate either union match.
	const clientTypes = source('src/types.ts').replace(/\/\*[\s\S]*?\*\//g, '');
	const itemReasonUnion = clientTypes.match(/export type UnassignedReason =[^;]*;/);
	assert.ok(itemReasonUnion, 'the client UnassignedReason authority is present');
	assert.ok(itemReasonUnion![0].includes('NO_AVAILABLE_SLOT'), 'NO_AVAILABLE_SLOT is a real filterable item reason');
	assert.ok(!itemReasonUnion![0].includes('UNASSIGNED_SECTION'), 'UNASSIGNED_SECTION is never a filterable item reason');

	// …while UNASSIGNED_SECTION is authoritative precisely as a *violation* code:
	// a member of the client violation-code authority and of the server-mirrored
	// publication allowlist.
	const violationCodeUnion = clientTypes.match(/export type ViolationCode =[^;]*;/);
	assert.ok(violationCodeUnion, 'the client ViolationCode authority is present');
	assert.ok(violationCodeUnion![0].includes("'UNASSIGNED_SECTION'"), 'UNASSIGNED_SECTION is a violation code');
	assert.equal(isPublicationBlockingCode('UNASSIGNED_SECTION'), true, 'UNASSIGNED_SECTION blocks publication');

	// The generator produces UNASSIGNED_SECTION as a violation `code:` and never
	// maps it onto a queue `reason:` — the semantic the legacy ternary and the
	// C07A classifier both preserve.
	const generationService = serverSource('atlas-server/src/services/generation.service.ts');
	assert.ok(generationService.includes("'UNASSIGNED_SECTION'"), 'the generator produces the UNASSIGNED_SECTION violation code');
	assert.doesNotMatch(generationService, /reason:\s*'UNASSIGNED_SECTION'/);
});

test('mutant: hardcoding NO_AVAILABLE_SLOT for every placement blocker is detected', () => {
	const mutantFilter = () => 'NO_AVAILABLE_SLOT';
	for (const reason of ['NO_AVAILABLE_SLOT', 'UNASSIGNED_SECTION']) {
		const destination = resolveBlockerDestination(reason, '/timetable');
		const production = resolvePlacementReasonFilter(destination);
		if (reason === 'UNASSIGNED_SECTION') {
			assert.equal(mutantFilter(), 'NO_AVAILABLE_SLOT');
			assert.notEqual(production, mutantFilter(), 'the hardcoded filter hides the unplaced sessions');
			assert.equal(production, 'all');
		} else {
			assert.equal(production, mutantFilter(), 'a NO_AVAILABLE_SLOT destination keeps the exact filter');
		}
	}
});

// ═════════════════════════ C07B CORRECTION R2 ═════════════════════════
// The candidate folded the unresolved queue into the hard-blocker count
// (`Math.max(groupBlockerCount, runWideBlockingHard)`), so two SOFT-reason
// unresolved sessions rendered as "2 hard blockers" beside a panel reporting 0
// run-wide blocking hard, and the same sessions were counted twice. R1 could not
// detect it because every `draftReport()` fixture had empty `unassignedItems`.
// These fixtures use the real producer shape and assert BOTH the rendered
// sentence and `summaryText`.

/** Producer-shaped `draft.unassignedItems` (the real `UnassignedItem` wire shape). */
function unresolvedSessions(count: number, reason: UnassignedItem['reason'] = 'NO_AVAILABLE_SLOT'): UnassignedItem[] {
	return Array.from({ length: count }, (_, index) => ({
		sectionId: index + 1,
		subjectId: index + 101,
		gradeLevel: 8,
		session: index + 1,
		reason,
		facultyId: index + 1,
	}));
}

/** Read a rendered `data-testid` count out of the sheet markup. */
function renderedCount(markup: string, testId: string): number {
	const match = markup.match(new RegExp(`data-testid="${testId}"[^>]*>(\\d+)<`));
	assert.ok(match, `the sheet renders ${testId}`);
	return Number(match![1]);
}

/** The hard-blocker count a sentence states, or 0 when it states none. */
function hardCountIn(sentence: string): number {
	const match = sentence.match(/(\d+) hard blocker/);
	return match ? Number(match[1]) : 0;
}

/** The unresolved-session count a sentence states, or 0 when it states none. */
function unresolvedCountIn(sentence: string): number {
	const match = sentence.match(/(\d+) unresolved session/);
	return match ? Number(match[1]) : 0;
}

test('R2 (a) unresolved-only: two producer-shaped queue sessions report zero hard blockers', () => {
	const draft = draftReport({ unassignedItems: unresolvedSessions(2) });
	const runWide = { blockingHardCount: 0, unassignedCount: 2, softCount: 0 };
	const readiness = deriveSimplePublishReadiness(draft, [], label('Section'), label('Subject'), label('Teacher'), runWide);

	assert.equal(readiness.totalHardBlockers, 0, 'the queue is SOFT — there is no hard violation to count');
	assert.equal(readiness.totalUnresolved, 2);
	assert.equal(readiness.blockerSentence, '2 unresolved sessions still need fixing before this schedule can be published.');
	assert.equal(hardCountIn(readiness.summaryText), readiness.runWideBlockingHard, 'summaryText agrees with the run-wide hard gate');
	assert.doesNotMatch(readiness.summaryText, /hard blocker/);
	assert.match(readiness.summaryText, /2 unresolved sessions still need fixing/);

	const markup = renderSheet({ draft, violations: [], runWide });
	assert.equal(blockerSentenceFromMarkup(markup), '2 unresolved sessions still need fixing before this schedule can be published.');
	assert.equal(renderedCount(markup, 'timetable-simple-run-wide-blocking'), 0, 'the panel hard gate is 0');
	assert.doesNotMatch(markup, /hard blocker/, 'the sentence never contradicts the rendered 0 blocking hard gate');
	assert.match(markup, /data-testid="timetable-simple-blocker-group"/, 'the affected queue sessions are still listed');
});

test('R2 (b) hard-only: the run-wide hard gate blocks and no unresolved claim is invented', () => {
	const draft = draftReport({ unassignedItems: [] });
	const runWide = { blockingHardCount: 2, unassignedCount: 0, softCount: 0 };
	const readiness = deriveSimplePublishReadiness(draft, [], label('Section'), label('Subject'), label('Teacher'), runWide);

	assert.equal(readiness.totalHardBlockers, 2);
	assert.equal(readiness.totalUnresolved, 0);
	assert.equal(readiness.blockerSentence, '2 hard blockers still need fixing before this schedule can be published.');
	assert.equal(hardCountIn(readiness.summaryText), readiness.runWideBlockingHard);
	assert.doesNotMatch(readiness.summaryText, /unresolved session/);

	const markup = renderSheet({ draft, violations: [], runWide });
	assert.equal(blockerSentenceFromMarkup(markup), '2 hard blockers still need fixing before this schedule can be published.');
	assert.equal(renderedCount(markup, 'timetable-simple-run-wide-blocking'), 2);
	assert.equal(unresolvedCountIn(blockerSentenceFromMarkup(markup)), 0);
});

test('R2 (c) mixed: one hard blocker plus two unresolved sessions are counted once each', () => {
	const draft = draftReport({ unassignedItems: unresolvedSessions(2) });
	const runWide = { blockingHardCount: 1, unassignedCount: 2, softCount: 0 };
	const readiness = deriveSimplePublishReadiness(draft, [], label('Section'), label('Subject'), label('Teacher'), runWide);

	// Three distinct problem sessions: one run-wide hard violation and two queue
	// sessions. The fold claimed 2 hard + 2 unresolved, counting the queue twice.
	assert.equal(readiness.totalHardBlockers, 1, 'the two SOFT queue sessions are never folded into the hard count');
	assert.equal(readiness.totalUnresolved, 2);
	assert.equal(readiness.totalHardBlockers + readiness.totalUnresolved, 3, 'each problem session is claimed exactly once');
	assert.equal(readiness.blockerSentence, '1 hard blocker and 2 unresolved sessions still need fixing before this schedule can be published.');
	assert.equal(hardCountIn(readiness.summaryText), readiness.runWideBlockingHard);
	assert.equal(unresolvedCountIn(readiness.summaryText), 2);

	const markup = renderSheet({ draft, violations: [], runWide });
	assert.equal(blockerSentenceFromMarkup(markup), '1 hard blocker and 2 unresolved sessions still need fixing before this schedule can be published.');
	assert.equal(renderedCount(markup, 'timetable-simple-run-wide-blocking'), 1);
});

test('R2 (d) clean: a producer-shaped empty queue with a clean gate is ready to publish', () => {
	const draft = draftReport({ unassignedItems: [] });
	const runWide = { blockingHardCount: 0, unassignedCount: 0, softCount: 0 };
	const readiness = deriveSimplePublishReadiness(draft, [], label('Section'), label('Subject'), label('Teacher'), runWide);

	assert.equal(readiness.totalHardBlockers, 0);
	assert.equal(readiness.totalUnresolved, 0);
	assert.equal(readiness.blockerSentence, '');
	assert.match(readiness.summaryText, /Ready to publish/);
	assert.equal(hardCountIn(readiness.summaryText), readiness.runWideBlockingHard);

	const markup = renderSheet({ draft, violations: [], runWide });
	assert.match(markup, /data-testid="timetable-simple-ready-to-publish"/);
	assert.match(markup, /Ready to publish/);
	assert.doesNotMatch(markup, /data-testid="timetable-simple-blocker-sentence"/);
});

test('mutant: folding unresolved reason groups back into the hard-blocker count is detected', () => {
	const draft = draftReport({ unassignedItems: unresolvedSessions(2) });
	const runWide = { blockingHardCount: 0, unassignedCount: 2, softCount: 0 };
	const readiness = deriveSimplePublishReadiness(draft, [], label('Section'), label('Subject'), label('Teacher'), runWide);

	// The candidate's rule: the rendered blocker-group sum fed the hard clause.
	const mutantHard = Math.max(
		readiness.blockerGroups.reduce((sum, group) => sum + group.count, 0),
		readiness.runWideBlockingHard,
	);
	assert.equal(mutantHard, 2, 'the fold invents two hard blockers for a SOFT queue');
	assert.notEqual(readiness.totalHardBlockers, mutantHard, 'production excludes the unresolved groups');
	assert.equal(readiness.totalHardBlockers, 0);

	// The mutant sentence beside the production panel's 0 blocking hard.
	const mutantSentence = `${mutantHard} hard blockers and ${readiness.totalUnresolved} unresolved sessions still need fixing before this schedule can be published.`;
	const mutantMarkup = renderToStaticMarkup(
		createElement(MemoryRouter, null,
			createElement('p', { 'data-testid': 'timetable-simple-blocker-sentence' }, mutantSentence),
		),
	);
	assert.match(mutantMarkup, /2 hard blockers/, 'the mutant ships the contradiction');
	assert.doesNotMatch(renderSheet({ draft, violations: [], runWide }), /hard blocker/, 'the production sheet never serializes it');
});

test('mutant: reverting the sentence to totalUnresolved alone is detected on a producer-shaped fixture', () => {
	const draft = draftReport({ unassignedItems: [] });
	const runWide = { blockingHardCount: 2, unassignedCount: 0, softCount: 0 };
	const readiness = deriveSimplePublishReadiness(draft, [], label('Section'), label('Subject'), label('Teacher'), runWide);

	// The original F1 defect: the sentence counted unresolved sessions only.
	const mutantSentence = (unresolved: number) =>
		`${unresolved} session${unresolved === 1 ? '' : 's'} still need fixing before this schedule can be published.`;
	assert.match(mutantSentence(readiness.totalUnresolved), /^0 sessions still need fixing/, 'the reverted rule ships the false zero claim');
	assert.notEqual(readiness.blockerSentence, mutantSentence(readiness.totalUnresolved));
	assert.equal(readiness.blockerSentence, '2 hard blockers still need fixing before this schedule can be published.');
	assert.doesNotMatch(renderSheet({ draft, violations: [], runWide }), /0 sessions? still need fixing/);
});

test('mutant: a hard clause that contradicts the run-wide gate is detected', () => {
	const draft = draftReport({ unassignedItems: unresolvedSessions(2) });
	const runWide = { blockingHardCount: 0, unassignedCount: 2, softCount: 0 };
	const readiness = deriveSimplePublishReadiness(draft, [], label('Section'), label('Subject'), label('Teacher'), runWide);

	// A hard clause derived from the unresolved total contradicts runWideBlockingHard.
	const contradictingHardCount = readiness.totalUnresolved;
	assert.equal(readiness.runWideBlockingHard, 0);
	assert.notEqual(contradictingHardCount, readiness.runWideBlockingHard, 'the contradicting clause would state 2 hard blockers beside a 0 gate');
	assert.match(readiness.blockerSentence, /^2 unresolved sessions/, 'the production sentence carries no contradicting hard count');
	assert.equal(hardCountIn(readiness.blockerSentence), readiness.runWideBlockingHard);
	assert.doesNotMatch(readiness.summaryText, /hard blocker/);
});
