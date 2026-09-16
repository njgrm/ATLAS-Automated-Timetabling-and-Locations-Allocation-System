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
} from '../../components/timetable/simplePublishReadiness';
import { SimplePublishReadinessSheetContent } from '../../components/timetable/SimplePublishReadinessSheet';
import { GeneratedViolationsPanel } from '../../components/timetable/GeneratedRunRailPanels';
import type { LeftRailContentContext } from '../../components/timetable/timetableContexts.types';
import { ExplainabilityDrawer } from '../../components/ExplainabilityDrawer';
import { ConstraintRow, SOFT_CONSTRAINT_LABELS, DEFAULT_CONSTRAINT_CONFIG } from '../../components/scheduling-policy/PolicyPanePrimitives';
import { PublishChecklistContent, buildBlockerGroups, UNASSIGNED_GROUP_MAP } from '../../components/timetable/simple/SimpleTaskDrawerHelpers';
import type { DraftReport, Violation, ViolationReport } from '../../types';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
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
	assert.ok(source('src/hooks/useTimetableData.ts').includes(`${retired}: 'Excessive Travel Distance'`), 'legacy runs still render a readable label');
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
