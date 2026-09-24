import assert from 'node:assert/strict';

import { withDataContext } from '../lib/data-context.js';
import {
	getPublishedSchedulePayload,
	resolvePublishedRun,
} from '../services/published-schedule.service.js';
import {
	readPublishedIdentitySnapshot,
	IDENTITY_OVERRIDES_KEY,
	type PublishedIdentitySnapshot,
} from '../services/published-identity-snapshot.service.js';

/**
 * S4-client / D4 — production-path evidence that the CANONICAL published read
 * (`resolvePublishedRun` / `getPublishedSchedulePayload`) applies the effective
 * identity snapshot: the base freeze plus every already-effective scheduled
 * revision `identityOverrides` in effective-date order.
 *
 * Failing-first control (row 1): the same at/after-date read asserts the QUARTERS
 * override. The pre-wiring service read only the base snapshot, so that row
 * fails without the fix while the before-date row still passes.
 *
 * Hermetic fake client (no live DB; DATABASE_URL unset). The service, its
 * resolver and its validator are the real ones.
 */

const SCHOOL_ID = 51;
const SCHOOL_YEAR_ID = 81;
const RUN_ID = 91;
const BASE_REVISION_ID = 700;
const OVERRIDE_REVISION_ID = 901;
const BASE_EFFECTIVE = '2030-01-01T00:00:00.000Z';
const OVERRIDE_EFFECTIVE = '2030-01-03T00:00:00.000Z';

type Entry = Record<string, unknown>;

function slotEntry(entryId: string, overrides: Record<string, unknown> = {}): Entry {
	return {
		entryId,
		facultyId: 20,
		roomId: 30,
		subjectId: 40,
		sectionId: 10,
		day: 'MONDAY',
		startTime: '07:30',
		endTime: '08:15',
		durationMinutes: 45,
		termIndex: 1,
		...overrides,
	};
}

function baseIdentitySnapshot(): PublishedIdentitySnapshot {
	return {
		schemaVersion: 1,
		capturedAt: '2030-01-01T00:00:00.000Z',
		inputFingerprint: 'fp-base',
		orderedTermContract: {
			format: 'TRIMESTER',
			terms: [
				{ identity: 'T1', displayLabel: 'T1', order: 1 },
				{ identity: 'T2', displayLabel: 'T2', order: 2 },
				{ identity: 'T3', displayLabel: 'T3', order: 3 },
			],
			activeTermOrder: 1,
		},
		subjects: {},
		faculty: {},
		sections: {},
		buildings: {},
		rooms: {},
		specializations: {},
		cohorts: {},
		advisers: {},
		displaySlots: [
			{ key: '07:30-08:15', label: '07:30-08:15', startTime: '07:30', endTime: '08:15', order: 0, kind: 'PERIOD', dayOfWeek: null },
		],
		specialEvents: [],
		// The frozen policy projection the base freeze persists (the display-slot
		// builder consumes these fields; the retired invented lunch window is not
		// present).
		policy: {
			periodLengthMinutes: 45,
			periodsPerDay: 8,
			earliestStartTime: '07:00',
			latestEndTime: '17:00',
			lunchStartTime: null,
			lunchEndTime: null,
			enforceLunchWindow: false,
			enableLunchWindow: false,
			enableFlagCeremony: false,
			flagCeremonyStartTime: '07:00',
			flagCeremonyEndTime: '07:30',
			enableRecess: false,
			recessStartTime: '09:45',
			recessEndTime: '10:00',
			maxConsecutiveTeachingMinutesBeforeBreak: 120,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 400,
			showSpecialEventsInGrid: false,
			advisoryCreditMinutes: 0,
			teachingStandardMinutes: 0,
		},
		classProgramSlots: [],
	};
}

const BASE_METADATA = {
	publishedIdentitySnapshot: baseIdentitySnapshot(),
	publicationBase: true,
	sourceRunVersion: 5,
};

/** A realistic D4 delta: the override changes the ordered-term authority only. */
const QUARTERS_OVERRIDE = {
	orderedTermContract: {
		format: 'QUARTERS',
		terms: [
			{ identity: 'Q1', displayLabel: 'Q1', order: 1 },
			{ identity: 'Q2', displayLabel: 'Q2', order: 2 },
			{ identity: 'Q3', displayLabel: 'Q3', order: 3 },
			{ identity: 'Q4', displayLabel: 'Q4', order: 4 },
		],
		activeTermOrder: 1,
	},
};

type SeedRevision = {
	id: number;
	status: string;
	effectiveDate: Date;
	sourceRevisionId: number | null;
	reason: string;
	changeSet: unknown;
	metadata: Record<string, unknown>;
};

function makeFixture(overrideStatus: 'SCHEDULED' | 'SUPERSEDED' = 'SCHEDULED') {
	const entries: Entry[] = [slotEntry('e-1')];
	const baseRevision = {
		id: BASE_REVISION_ID,
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		sourceRunId: RUN_ID,
		sourceRevisionId: null,
		status: 'SCHEDULED',
		effectiveDate: new Date(BASE_EFFECTIVE),
		reason: 'INITIAL_PUBLICATION',
		changeSet: [],
		metadata: BASE_METADATA,
	};
	const overrideRevision: SeedRevision = {
		id: OVERRIDE_REVISION_ID,
		status: overrideStatus,
		effectiveDate: new Date(OVERRIDE_EFFECTIVE),
		sourceRevisionId: BASE_REVISION_ID,
		reason: 'Mid-year identity delta',
		changeSet: [],
		metadata: { [IDENTITY_OVERRIDES_KEY]: QUARTERS_OVERRIDE },
	};
	const runMeta = {
		id: RUN_ID,
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		version: 5,
		runType: 'FULL',
		status: 'COMPLETED',
		finishedAt: new Date('2030-01-01T01:00:00.000Z'),
		createdAt: new Date('2030-01-01T00:00:00.000Z'),
		summary: {
			isPublished: true,
			publishedAt: '2030-01-01T02:00:00.000Z',
			publication: { revisionId: BASE_REVISION_ID, sourceRunVersion: 5 },
		},
	};

	const client = {
		generationRun: {
			findMany: async () => [runMeta],
			findUnique: async () => ({ draftEntries: entries }),
		},
		publishedScheduleRevision: {
			findMany: async (args: { where?: { status?: { in?: string[] }; effectiveDate?: { lte?: Date } } }) => {
				const allowedStatuses = args?.where?.status?.in;
				const lte = args?.where?.effectiveDate?.lte;
				return [baseRevision, overrideRevision].filter((revision) => {
					if (allowedStatuses && !allowedStatuses.includes(revision.status)) return false;
					if (lte && revision.effectiveDate.getTime() > lte.getTime()) return false;
					return true;
				});
			},
		},
		enrollProSchoolYearMirror: {
			findMany: async () => [{ enrollProSchoolYearId: SCHOOL_YEAR_ID }],
			findFirst: async () => ({ yearLabel: '2030-2031' }),
		},
		gradeShiftWindow: { findMany: async () => [] },
	};

	return { client };
}

async function main() {
	const baseBytesBefore = JSON.stringify(BASE_METADATA);

	// Row 1 — FAILING-FIRST: the canonical read honours the effective-date order.
	// A read before the override date returns the base authority; at/after it
	// returns the override; the base persisted bytes are never mutated.
	{
		const fixture = makeFixture('SCHEDULED');

		const before = await withDataContext(fixture.client, () => resolvePublishedRun(
			SCHOOL_ID,
			SCHOOL_YEAR_ID,
			{ requestedDate: '2030-01-02' },
		));
		assert.equal(before.source.snapshotState, 'FROZEN');
		assert.equal(before.snapshot?.orderedTermContract.format, 'TRIMESTER', 'read before the effective date returns the base authority');
		assert.deepEqual(before.source.appliedIdentityRevisionIds, [], 'no identity override applies before its effective date');

		const after = await withDataContext(fixture.client, () => resolvePublishedRun(
			SCHOOL_ID,
			SCHOOL_YEAR_ID,
			{ requestedDate: '2030-01-04' },
		));
		assert.equal(after.source.snapshotState, 'FROZEN');
		assert.equal(after.snapshot?.orderedTermContract.format, 'QUARTERS', 'read at/after the effective date returns the override authority (failing-first)');
		assert.deepEqual(after.snapshot?.orderedTermContract.terms.map((term) => term.identity), ['Q1', 'Q2', 'Q3', 'Q4']);
		assert.deepEqual(after.source.appliedIdentityRevisionIds, [OVERRIDE_REVISION_ID], 'the applied identity revision is reported');

		assert.equal(JSON.stringify(BASE_METADATA), baseBytesBefore, 'the base metadata bytes are byte-identical after the reads');
		assert.deepEqual(readPublishedIdentitySnapshot(BASE_METADATA)?.orderedTermContract.format, 'TRIMESTER', 'a direct base read still returns the base freeze');
	}

	// Row 2 — the identity delta reaches the canonical published projection and
	// does not regress the existing response shape.
	{
		const fixture = makeFixture('SCHEDULED');
		const before = await withDataContext(fixture.client, () => getPublishedSchedulePayload(
			SCHOOL_ID,
			SCHOOL_YEAR_ID,
			{ requestedDate: '2030-01-02', termIndex: 1 },
		));
		assert.deepEqual(before.source.orderedTerms.map((term) => term.identity), ['T1', 'T2', 'T3'], 'projection before the date uses the base contract');
		assert.equal(before.source.snapshotState, 'FROZEN');
		assert.equal(Array.isArray(before.entries), true);
		assert.equal(before.entries.length, 1, 'existing entry projection is unchanged');
		assert.equal(Array.isArray(before.timeSlots), true);
		assert.equal(Array.isArray(before.specialEvents), true);

		const after = await withDataContext(fixture.client, () => getPublishedSchedulePayload(
			SCHOOL_ID,
			SCHOOL_YEAR_ID,
			{ requestedDate: '2030-01-04', termIndex: 1 },
		));
		assert.deepEqual(after.source.orderedTerms.map((term) => term.identity), ['Q1', 'Q2', 'Q3', 'Q4'], 'the canonical projection carries the effective identity delta');
		assert.equal(after.entries.length, 1, 'existing entry projection is unchanged by the identity delta');
		assert.equal(after.source.termScope, 'explicit');
		assert.equal(after.source.termIndex, 1);
	}

	// Row 3 — a withdrawn (SUPERSEDED) override stops governing at the same date.
	// This is the control for the added `status` selection: without it a
	// superseded override would still be applied.
	{
		const fixture = makeFixture('SUPERSEDED');
		const after = await withDataContext(fixture.client, () => resolvePublishedRun(
			SCHOOL_ID,
			SCHOOL_YEAR_ID,
			{ requestedDate: '2030-01-04' },
		));
		assert.equal(after.snapshot?.orderedTermContract.format, 'TRIMESTER', 'a superseded override no longer governs the canonical read');
		assert.deepEqual(after.source.appliedIdentityRevisionIds, [], 'a superseded override is not reported as applied');
	}

	// Row 4 — a legacy publication without a frozen base stays honestly legacy and
	// never fabricates an override.
	{
		const legacyBase = {
			id: BASE_REVISION_ID,
			schoolId: SCHOOL_ID,
			schoolYearId: SCHOOL_YEAR_ID,
			sourceRunId: RUN_ID,
			sourceRevisionId: null,
			status: 'SCHEDULED',
			effectiveDate: new Date(BASE_EFFECTIVE),
			reason: 'INITIAL_PUBLICATION',
			changeSet: [],
			metadata: { publicationBase: true, sourceRunVersion: 5 },
		};
		const legacyOverride = {
			id: OVERRIDE_REVISION_ID,
			status: 'SCHEDULED',
			effectiveDate: new Date(OVERRIDE_EFFECTIVE),
			sourceRevisionId: BASE_REVISION_ID,
			reason: 'Mid-year identity delta',
			changeSet: [],
			metadata: { [IDENTITY_OVERRIDES_KEY]: QUARTERS_OVERRIDE },
		};
		const legacyClient = {
			generationRun: {
				findMany: async () => [{
					id: RUN_ID, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, version: 5, runType: 'FULL',
					status: 'COMPLETED', finishedAt: new Date('2030-01-01T01:00:00.000Z'), createdAt: new Date('2030-01-01T00:00:00.000Z'),
					summary: { isPublished: true, publishedAt: '2030-01-01T02:00:00.000Z', publication: { revisionId: BASE_REVISION_ID, sourceRunVersion: 5 } },
				}],
				findUnique: async () => ({ draftEntries: [slotEntry('e-1')] }),
			},
			publishedScheduleRevision: { findMany: async () => [legacyBase, legacyOverride] },
			enrollProSchoolYearMirror: {
				findMany: async () => [{ enrollProSchoolYearId: SCHOOL_YEAR_ID }],
				findFirst: async () => ({ yearLabel: '2030-2031' }),
			},
			gradeShiftWindow: { findMany: async () => [] },
		};
		const legacy = await withDataContext(legacyClient, () => resolvePublishedRun(
			SCHOOL_ID,
			SCHOOL_YEAR_ID,
			{ requestedDate: '2030-01-04' },
		));
		assert.equal(legacy.source.snapshotState, 'LEGACY_LIVE_PROJECTION');
		assert.equal(legacy.snapshot, null);
		assert.deepEqual(legacy.source.appliedIdentityRevisionIds, []);
	}

	console.log('published identity read-back S4-client: all checks passed');
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
