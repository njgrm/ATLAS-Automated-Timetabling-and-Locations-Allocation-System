/**
 * UX-C01 — derived setup readiness negative controls (hermetic).
 *
 * Proves that operator readiness is projected from the canonical derived-demand
 * authority only: a typed blocker is available-but-not-ready (never a synthetic
 * ready/zero state), Subject metadata exceptions are surfaced as the smallest
 * repair, and the dashboard readiness service never consults the retired
 * Curriculum Requirements evaluator.
 *
 * Run: `npx tsx src/__tests__/uxc01-derived-setup-readiness.test.ts`
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { DerivedDemandResult } from '../services/derived-demand.service.js';
import {
	aggregateDashboardSummary,
	resolveDashboardLifecycle,
	toDashboardDerivedDemand,
	type DashboardReadinessAggregateInput,
} from '../services/dashboard-readiness.service.js';

const SCHOOL = 1;
const YEAR = 8;

function readyResult(): DerivedDemandResult {
	return {
		ok: true,
		scope: { schoolId: SCHOOL, schoolYearId: YEAR },
		yearLabel: '2030-2031',
		revision: 'REV-A',
		termStructure: {
			format: 'QUARTERS',
			semanticRevision: 'TERM-REV-A',
			terms: [
				{ identity: 'Q1', displayLabel: 'Quarter 1', order: 1 },
				{ identity: 'Q2', displayLabel: 'Quarter 2', order: 2 },
				{ identity: 'Q3', displayLabel: 'Quarter 3', order: 3 },
				{ identity: 'Q4', displayLabel: 'Quarter 4', order: 4 },
			],
		},
		periodLengthMinutes: 45,
		timetableLines: [],
		teachingLoadPairs: [],
		totalsByTerm: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
		totalLines: 12,
		totalPairs: 4,
	};
}

function blockedResult(): DerivedDemandResult {
	return {
		ok: false,
		scope: { schoolId: SCHOOL, schoolYearId: YEAR },
		blockers: [
			{ code: 'ROTATION_ORDER_MISSING', message: 'Rotation family TLE needs an explicit integer term order for TLE-7.', subjectId: 7, subjectCode: 'TLE-7', rotationFamily: 'TLE' },
		],
	};
}

test('UX-C01: a derivation with zero blockers is ready with term structure and totals', () => {
	const summary = toDashboardDerivedDemand(readyResult(), '2030-2031');
	assert.equal(summary.available, true);
	assert.equal(summary.ready, true);
	assert.equal(summary.yearLabel, '2030-2031');
	assert.equal(summary.revision, 'REV-A');
	assert.deepEqual(summary.termStructure?.terms.map((term) => term.identity), ['Q1', 'Q2', 'Q3', 'Q4']);
	assert.equal(summary.totals?.totalPairs, 4);
	assert.equal(summary.totals?.totalLines, 12);
	assert.deepEqual(summary.subjectMetadataExceptions, []);
	assert.equal(summary.blockerMessage, null);
});

test('UX-C01: a typed Subject metadata blocker is available-but-not-ready, never a synthetic ready', () => {
	const summary = toDashboardDerivedDemand(blockedResult(), '2030-2031');
	assert.equal(summary.available, true, 'a typed blocker is a successful read');
	assert.equal(summary.ready, false);
	assert.equal(summary.blockerCode, 'ROTATION_ORDER_MISSING');
	assert.equal(summary.subjectMetadataExceptions.length, 1);
	assert.equal(summary.subjectMetadataExceptions[0].subjectCode, 'TLE-7');
	assert.equal(summary.totals, null, 'a blocked derivation never reports totals');
});

test('UX-C01: blocked derived demand holds the dashboard lifecycle at SETUP (never REVIEW/PUBLISHED)', () => {
	const blocked = resolveDashboardLifecycle({
		subjectCount: 22,
		facultyCount: 42,
		sectionCount: 20,
		unassignedSubjectCount: 0,
		buildingsDone: true,
		latestRunStatus: 'COMPLETED',
		publishedRunPresent: false,
		derivedDemandReady: false,
		hasDomainError: false,
	});
	assert.equal(blocked.phase, 'SETUP');
	assert.equal(blocked.isPublished, false);
});

function aggregateInput(derived: DashboardReadinessAggregateInput['derivedDemandResult']): DashboardReadinessAggregateInput {
	return {
		schoolId: SCHOOL,
		resolvedAt: new Date().toISOString(),
		activeSchoolYearId: YEAR,
		activeSchoolYearLabel: '2030-2031',
		runtimeContext: null,
		runtimeResult: { ok: true, data: null },
		campusResult: {
			ok: true,
			data: {
				campusImageUrl: null,
				updatedAt: null,
				buildings: [{
					id: 1,
					name: 'Main Building',
					shortCode: null,
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					rotation: 0,
					color: '#000',
					floorCount: 1,
					isTeachingBuilding: true,
					rooms: [{ id: 1, name: 'Room 101', floor: 1, type: 'CLASSROOM', capacity: 40, isTeachingSpace: true, floorPosition: 0, buildingId: 1, features: [] }],
				}],
			},
		},
		subjectResult: { ok: true, data: { subjectCount: 22, unassignedSubjectCount: 0 } },
		facultyResult: { ok: true, data: { facultyCount: 42, lastSyncedAt: null } },
		sectionResult: { ok: true, data: { sectionCount: 20, lastSyncedAt: null } },
		generationResult: { ok: true, data: { latestRunStatus: 'NONE', latestRunId: null, violationCount: null, createdAt: null, finishedAt: null } },
		publicationResult: { ok: true, data: { isPublished: false, publishedRunId: null } },
		derivedDemandResult: derived,
	};
}

test('UX-C01: an unavailable derived-demand read is explicit and holds setup', () => {
	const summary = aggregateDashboardSummary(aggregateInput({
		ok: true,
		data: {
			available: false,
			ready: false,
			yearLabel: null,
			revision: null,
			termStructure: null,
			blockers: [],
			subjectMetadataExceptions: [],
			totals: null,
			blockerCode: null,
			blockerMessage: null,
			error: 'derived demand datasource failed',
		},
	}));
	assert.equal(summary.derivedDemand.available, false);
	assert.equal(summary.lifecyclePhase, 'SETUP');
	assert.equal(summary.sources.derivedDemand.state, 'partial_degraded');
});

test('UX-C01: a ready derivation with all other setup ready advances to PREFERENCES', () => {
	const summary = aggregateDashboardSummary(aggregateInput({
		ok: true,
		data: toDashboardDerivedDemand(readyResult(), '2030-2031'),
	}));
	assert.equal(summary.derivedDemand.ready, true);
	assert.equal(summary.lifecyclePhase, 'PREFERENCES');
});

test('UX-C01 query-shape: the dashboard readiness service never consults the retired requirements evaluator', () => {
	const servicePath = fileURLToPath(new URL('../services/dashboard-readiness.service.ts', import.meta.url));
	const source = readFileSync(servicePath, 'utf8');
	assert(
		!/evaluateCurriculumReadiness/.test(source),
		'dashboard readiness must derive setup readiness from the canonical derived-demand authority only',
	);
	assert(
		!/school-year-offering/.test(source),
		'dashboard readiness must not import the retired offering/requirements service',
	);
	assert(
		/buildDerivedDemand/.test(source),
		'dashboard readiness must consume the canonical derived-demand authority',
	);
});
