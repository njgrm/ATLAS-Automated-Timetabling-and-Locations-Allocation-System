import { getDataContext } from '../lib/data-context.js';
import type { ScheduledEntry } from './constraint-validator.js';
import { buildCanonicalDisplayGrid, buildSpecialEventSlots, type CanonicalDisplayRow, type PolicyInput } from './schedule-constructor.js';
import { POLICY_DEFAULTS } from './scheduling-policy.service.js';
import {
	isTermIndexWithinContract,
	loadVerifiedOrderedTermContract,
	resolveRequestedTermIndex,
	resolveRequestedTermIndexFromContract,
} from './academic-term.service.js';
import { isRejectedFlagCeremonyRow, resolveSpecialEventDayOfWeek } from '../lib/policy-special-events.js';
import {
	frozenReferenceMaps,
	frozenTermContract,
	readPublishedIdentitySnapshot,
	snapshotGaps,
	type PublishedIdentitySnapshot,
	type SnapshotState,
} from './published-identity-snapshot.service.js';

const db = () => getDataContext();

type PublishedRunSource = {
	runId: number;
	schoolId: number;
	schoolYearId: number;
	schoolYearLabel: string | null;
	isActiveSchoolYear: boolean;
	isHistorical: boolean;
	publishedAt: string | null;
	generatedAt: string | null;
	requestedDate: string | null;
	resolvedForDate: string;
	activeRevisionId: number | null;
	activeRevisionEffectiveDate: string | null;
	appliedRevisionIds: number[];
	revisionMarker: string;
	/** C08 — truthful immutability state of the resolved publication. */
	snapshotState: SnapshotState;
	/** C08 — frozen fields an entry references but the snapshot does not carry. */
	snapshotGaps: string[];
};

export type PublishedRunResolution = {
	source: PublishedRunSource;
	entries: ScheduledEntry[];
	summary: Record<string, unknown> | null;
	snapshot: PublishedIdentitySnapshot | null;
};

type PublishedScheduleReadOptions = {
	requestedDate?: string | Date | null;
	termIndex?: number | 'active';
};

type RevisionCandidate = {
	id: number;
	effectiveDate: Date;
	changeSet: unknown;
	sourceRevisionId: number | null;
	reason: string;
	metadata: unknown;
};

type SectionReference = {
	atlasId: number | null;
	name: string;
	gradeLevel: number | null;
	gradeLevelName: string | null;
	programType: string | null;
	programCode: string | null;
	programName: string | null;
};

function err(statusCode: number, code: string, message: string, details?: Record<string, unknown>): Error & { statusCode: number; code: string; details?: Record<string, unknown> } {
	const e = new Error(message) as Error & { statusCode: number; code: string; details?: Record<string, unknown> };
	e.statusCode = statusCode;
	e.code = code;
	e.details = details;
	return e;
}

function readPublishedAt(summary: unknown): string | null {
	if (!summary || typeof summary !== 'object') return null;
	const value = (summary as Record<string, unknown>).publishedAt;
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolveReadDate(value: string | Date | null | undefined): { readDate: Date; requestedDate: string | null } {
	if (value == null || value === '') {
		return { readDate: new Date(), requestedDate: null };
	}

	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			throw err(400, 'PUBLISHED_SCHEDULE_DATE_INVALID', 'Published schedule date must be a valid date.');
		}
		return { readDate: value, requestedDate: value.toISOString() };
	}

	const requestedDate = value.trim();
	if (!requestedDate) return { readDate: new Date(), requestedDate: null };

	const readDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
		? new Date(`${requestedDate}T12:00:00.000Z`)
		: new Date(requestedDate);

	if (Number.isNaN(readDate.getTime())) {
		throw err(400, 'PUBLISHED_SCHEDULE_DATE_INVALID', 'Published schedule date must be a valid date or ISO date string.');
	}

	return { readDate, requestedDate };
}

function readRevisionChanges(changeSet: unknown): Array<{ entryId: string; next: Record<string, unknown> }> {
	if (!Array.isArray(changeSet)) return [];

	return changeSet.flatMap((change) => {
		if (!isRecord(change)) return [];
		const entryId = typeof change.entryId === 'string' ? change.entryId.trim() : '';
		if (!entryId || !isRecord(change.next)) return [];
		return [{ entryId, next: change.next }];
	});
}

const REVISION_ENTRY_FIELDS = new Set([
	'facultyId',
	'roomId',
	'subjectId',
	'subjectCode',
	'sectionId',
	'day',
	'startTime',
	'endTime',
	'durationMinutes',
	'termIndex',
	'entryKind',
	'programType',
	'programCode',
	'programName',
	'cohortCode',
	'cohortName',
	'specializationCode',
	'specializationName',
	'cohortMemberSectionIds',
	'cohortExpectedEnrollment',
	'adviserId',
	'adviserName',
	'metadata',
]);

function applyRevisionValues(entry: ScheduledEntry, nextValues: Record<string, unknown>): ScheduledEntry {
	const nextEntry = { ...entry } as Record<string, unknown>;
	for (const [key, value] of Object.entries(nextValues)) {
		if (!REVISION_ENTRY_FIELDS.has(key) || value === undefined) continue;
		nextEntry[key] = value;
	}
	return nextEntry as unknown as ScheduledEntry;
}

function applyPublishedRevisions(entries: ScheduledEntry[], revisions: RevisionCandidate[]): ScheduledEntry[] {
	if (revisions.length === 0) return entries;

	const entriesById = new Map(entries.map((entry) => [entry.entryId, entry]));
	let changed = false;

	for (const revision of revisions) {
		for (const change of readRevisionChanges(revision.changeSet)) {
			const current = entriesById.get(change.entryId);
			if (!current) continue;
			entriesById.set(change.entryId, applyRevisionValues(current, change.next));
			changed = true;
		}
	}

	return changed ? entries.map((entry) => entriesById.get(entry.entryId) ?? entry) : entries;
}

function buildRevisionMarker(params: {
	runId: number;
	publishedAt: string | null;
	activeRevisionId: number | null;
	activeRevisionEffectiveDate: string | null;
	resolvedForDate: string;
}): string {
	return [
		`run=${params.runId}`,
		`published=${params.publishedAt ?? 'none'}`,
		`revision=${params.activeRevisionId ?? 'base'}`,
		`effective=${params.activeRevisionEffectiveDate ?? 'none'}`,
		`date=${params.resolvedForDate.slice(0, 10)}`,
	].join('|');
}

/**
 * Resolve the runtime-active, non-archived school year. An archived year is never
 * elected current. Multiple active years fail closed rather than letting the read
 * side pick one arbitrarily.
 */
export async function resolveActiveSchoolYearElection(schoolId: number): Promise<number | null> {
	const mirrors = await db().enrollProSchoolYearMirror.findMany({
		where: { schoolId, isActive: true, isArchived: false },
		orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
		select: { enrollProSchoolYearId: true },
		take: 2,
	});
	if (mirrors.length > 1) {
		throw err(409, 'ACTIVE_SCHOOL_YEAR_AMBIGUOUS', 'Multiple active school years are configured. Published schedule scope is ambiguous.');
	}
	return mirrors[0]?.enrollProSchoolYearId ?? null;
}

export async function resolvePublishedRun(
	schoolId: number,
	schoolYearId?: number,
	options?: PublishedScheduleReadOptions,
	filter?: { sectionId?: number; facultyId?: number; roomId?: number },
	activeSchoolYearId?: number | null,
): Promise<PublishedRunResolution> {
	const { readDate, requestedDate } = resolveReadDate(options?.requestedDate);

	const publishedRunCandidates = await db().generationRun.findMany({
		where: {
			schoolId,
			status: 'COMPLETED',
			runType: 'FULL',
			...(schoolYearId ? { schoolYearId } : {}),
			summary: { path: ['isPublished'], equals: true },
		},
		orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
		select: {
			id: true,
			schoolId: true,
			schoolYearId: true,
			version: true,
			runType: true,
			summary: true,
			finishedAt: true,
			createdAt: true,
		},
		take: 2,
	});
	if (publishedRunCandidates.length > 1) {
		throw err(409, 'PUBLISHED_RUN_AMBIGUOUS', 'Multiple current published runs exist for the requested scope.');
	}
	const publishedRunMeta = publishedRunCandidates[0];
	if (!publishedRunMeta) {
		throw err(404, 'PUBLISHED_RUN_NOT_FOUND', 'No published schedule is available for the requested scope.');
	}
	const publication = isRecord(publishedRunMeta.summary) && isRecord(publishedRunMeta.summary.publication)
		? publishedRunMeta.summary.publication
		: null;
	const publicationRevisionId = Number(publication?.revisionId);
	const publicationRunVersion = Number(publication?.sourceRunVersion);
	if (!Number.isInteger(publicationRevisionId) || publicationRevisionId < 1 || publicationRunVersion !== publishedRunMeta.version) {
		throw err(409, 'PUBLISHED_REVISION_INVALID', 'The published run is not bound to its immutable publication revision.');
	}

	const applicableRevisions = await db().publishedScheduleRevision.findMany({
		where: {
			schoolId: publishedRunMeta.schoolId,
			schoolYearId: publishedRunMeta.schoolYearId,
			sourceRunId: publishedRunMeta.id,
			status: { in: ['SCHEDULED', 'SUPERSEDED'] },
			effectiveDate: { lte: readDate },
		},
		orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
		select: {
			id: true,
			effectiveDate: true,
			changeSet: true,
			sourceRevisionId: true,
			reason: true,
			metadata: true,
		},
	});
	const baseRevision = applicableRevisions.find((revision) => revision.id === publicationRevisionId);
	const baseMetadata = isRecord(baseRevision?.metadata) ? baseRevision.metadata : null;
	if (!baseRevision || baseRevision.sourceRevisionId !== null || baseRevision.reason !== 'INITIAL_PUBLICATION'
		|| baseMetadata?.publicationBase !== true || Number(baseMetadata.sourceRunVersion) !== publishedRunMeta.version) {
		throw err(409, 'PUBLISHED_REVISION_INVALID', 'The immutable publication revision is unavailable for the requested date.');
	}

	let draftEntries: ScheduledEntry[] = [];

	if (filter && (filter.sectionId !== undefined || filter.facultyId !== undefined || filter.roomId !== undefined)) {
		const filterConds: string[] = [];
		const params: any[] = [publishedRunMeta.id];
		let paramIdx = 2;

		if (filter.sectionId !== undefined) {
			filterConds.push(`(elem->>'sectionId')::int = $${paramIdx++}`);
			params.push(filter.sectionId);
		}
		if (filter.facultyId !== undefined) {
			filterConds.push(`(elem->>'facultyId')::int = $${paramIdx++}`);
			params.push(filter.facultyId);
		}
		if (filter.roomId !== undefined) {
			filterConds.push(`(elem->>'roomId')::int = $${paramIdx++}`);
			params.push(filter.roomId);
		}
		// A revision may move an entry into or out of the requested slice. Include every
		// revision-touched entry in the targeted SQL read, apply revisions in memory, and
		// let the caller's final filter decide membership from effective values.
		const revisionEntryIds = Array.from(new Set(applicableRevisions.flatMap((revision) =>
			readRevisionChanges(revision.changeSet).map((change) => change.entryId))));
		const revisionMembershipClause = revisionEntryIds.length > 0
			? ` OR elem->>'entryId' = ANY($${paramIdx++}::text[])`
			: '';
		if (revisionEntryIds.length > 0) params.push(revisionEntryIds);

		const rawQuery = `
			SELECT elem
			FROM "generation_runs" r,
				jsonb_array_elements(r."draft_entries") WITH ORDINALITY AS entry(elem, ord)
			WHERE r.id = $1 AND ((${filterConds.join(' AND ')})${revisionMembershipClause})
			ORDER BY entry.ord ASC
		`;

		const rows = await db().$queryRawUnsafe<{ elem: unknown }[]>(rawQuery, ...params);
		draftEntries = rows.map((row) => row.elem) as ScheduledEntry[];
	} else {
		const publishedRunEntries = await db().generationRun.findUnique({
			where: { id: publishedRunMeta.id },
			select: { draftEntries: true },
		});
		draftEntries = (publishedRunEntries?.draftEntries ?? []) as unknown as ScheduledEntry[];
	}

	const activeRevision = applicableRevisions.at(-1) ?? null;
	const publishedAt = readPublishedAt(publishedRunMeta.summary);
	const generatedAt = publishedRunMeta.finishedAt?.toISOString() ?? publishedRunMeta.createdAt.toISOString();
	const resolvedForDate = readDate.toISOString();
	const activeRevisionEffectiveDate = activeRevision?.effectiveDate.toISOString() ?? null;

	// C08 — the base revision's frozen identity snapshot is the published
	// artifact's authority. A publication without one is reported honestly as a
	// legacy live projection and must never claim immutable reproduction.
	const frozenSnapshot = readPublishedIdentitySnapshot(baseMetadata);
	const snapshotState: SnapshotState = frozenSnapshot ? 'FROZEN' : 'LEGACY_LIVE_PROJECTION';

	// Resolve the runtime-active school year. A caller-supplied election is
	// authoritative; otherwise the service resolves it so both route families
	// agree for the same scope. An archived year is never elected current.
	const electedActiveYearId = activeSchoolYearId === undefined
		? await resolveActiveSchoolYearElection(schoolId)
		: activeSchoolYearId;
	const isActiveYear = electedActiveYearId != null && publishedRunMeta.schoolYearId === electedActiveYearId;

	const mirror = await db().enrollProSchoolYearMirror.findFirst({
		where: { schoolId, enrollProSchoolYearId: publishedRunMeta.schoolYearId },
		select: { yearLabel: true },
	});
	const schoolYearLabel = mirror?.yearLabel ?? null;

	const resolvedEntries = applyPublishedRevisions(draftEntries, applicableRevisions);

	return {
		source: {
			runId: publishedRunMeta.id,
			schoolId: publishedRunMeta.schoolId,
			schoolYearId: publishedRunMeta.schoolYearId,
			schoolYearLabel,
			isActiveSchoolYear: isActiveYear,
			isHistorical: !isActiveYear,
			publishedAt,
			generatedAt,
			requestedDate,
			resolvedForDate,
			activeRevisionId: activeRevision?.id ?? null,
			activeRevisionEffectiveDate,
			appliedRevisionIds: applicableRevisions.map((revision) => revision.id),
			revisionMarker: buildRevisionMarker({
				runId: publishedRunMeta.id,
				publishedAt,
				activeRevisionId: activeRevision?.id ?? null,
				activeRevisionEffectiveDate,
				resolvedForDate,
			}),
			snapshotState,
			snapshotGaps: frozenSnapshot ? snapshotGaps(frozenSnapshot, resolvedEntries) : [],
		} satisfies PublishedRunSource,
		entries: resolvedEntries,
		summary: (publishedRunMeta.summary ?? null) as Record<string, unknown> | null,
		snapshot: frozenSnapshot,
	};
}

async function loadReferenceMaps(
	schoolId: number,
	schoolYearId: number,
	sectionIds: number[],
	subjectIds: number[],
	facultyIds: number[],
	roomIds: number[]
) {
	const [subjects, faculty, rooms, sectionMirrors, cohorts, ownershipRows] = await Promise.all([
		db().subject.findMany({
			where: { schoolId, id: { in: subjectIds } },
			select: { id: true, code: true, name: true },
		}),
		db().facultyMirror.findMany({
			where: { schoolId, id: { in: facultyIds } },
			select: { id: true, externalId: true, employeeId: true, firstName: true, lastName: true, isPlaceholder: true },
		}),
		db().room.findMany({
			where: { building: { schoolId }, id: { in: roomIds } },
			select: { id: true, name: true, type: true, floor: true, building: { select: { id: true, name: true } } },
		}),
		db().sectionMirror.findMany({
			where: {
				schoolId,
				schoolYearId,
				externalId: { in: sectionIds },
			},
			select: {
				id: true,
				externalId: true,
				name: true,
				gradeLevelId: true,
				gradeLevelName: true,
				programType: true,
				programCode: true,
				programName: true,
			},
		}),
		db().instructionalCohort.findMany({
			where: { schoolId, schoolYearId, isActive: true },
			select: {
				cohortCode: true,
				specializationCode: true,
				specializationName: true,
			},
		}),
		sectionIds.length > 0 && subjectIds.length > 0
			? db().subjectSectionOwnership.findMany({
				where: {
					schoolId,
					schoolYearId,
					sectionId: { in: sectionIds },
					subjectId: { in: subjectIds },
					OR: [
						{ specializationCode: { not: null } },
						{ specializationLabel: { not: null } },
					],
				},
				select: {
					subjectId: true,
					sectionId: true,
					specializationCode: true,
					specializationLabel: true,
				},
			})
			: Promise.resolve([]),
	]);

	const sectionNameById = new Map<number, string>();
	const sectionById = new Map<number, SectionReference>();

	for (const section of sectionMirrors) {
		sectionNameById.set(section.externalId, section.name);
		sectionById.set(section.externalId, {
			atlasId: section.id,
			name: section.name,
			gradeLevel: section.gradeLevelId,
			gradeLevelName: section.gradeLevelName,
			programType: section.programType,
			programCode: section.programCode,
			programName: section.programName,
		});
	}

	// Only load sectionSnapshot payload if there are sectionIds missing from the mirrors
	const missingSectionIds = sectionIds.filter((id) => !sectionNameById.has(id));
	if (missingSectionIds.length > 0) {
		const sectionSnapshot = await db().sectionSnapshot.findUnique({
			where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
			select: { payload: true },
		});

		if (sectionSnapshot?.payload && Array.isArray(sectionSnapshot.payload)) {
			for (const grade of sectionSnapshot.payload as Array<{ sections?: Array<{ id?: number; name?: string }> }>) {
				for (const section of grade.sections ?? []) {
					if (typeof section.id === 'number' && typeof section.name === 'string') {
						if (!sectionNameById.has(section.id)) {
							sectionNameById.set(section.id, section.name);
						}
					}
				}
			}
		}
	}

	const specializationBySubjectSection = new Map<string, { specializationCode: string | null; specializationLabel: string | null }>();
	for (const row of ownershipRows) {
		const key = `${row.subjectId}:${row.sectionId}`;
		if (specializationBySubjectSection.has(key)) continue;
		specializationBySubjectSection.set(key, {
			specializationCode: row.specializationCode ?? null,
			specializationLabel: row.specializationLabel ?? null,
		});
	}

	const cohortByCode = new Map(
		cohorts.map((cohort) => [cohort.cohortCode, {
			specializationCode: cohort.specializationCode,
			specializationName: cohort.specializationName,
		}]),
	);

	return {
		subjectById: new Map(subjects.map((subject) => [subject.id, subject])),
		facultyById: new Map(faculty.map((member) => [member.id, {
			atlasId: member.id,
			externalId: member.externalId,
			employeeId: member.employeeId ?? null,
			name: `${member.lastName}, ${member.firstName}`,
			isPlaceholder: member.isPlaceholder,
		}])),
		roomById: new Map(rooms.map((room) => [room.id, room])),
		sectionById,
		sectionNameById,
		cohortByCode,
		specializationBySubjectSection,
	};
}

function buildSpecialEventsPayload(
	policy: NonNullable<Parameters<typeof buildSpecialEventSlots>[0]>,
	specialEvents?: Array<{ eventType: string; label: string; startTime: string; endTime: string; dayOfWeek?: string | null; gradeGroup?: string | null; programType?: string | null }>,
	canonicalRows?: readonly CanonicalDisplayRow[] | null,
) {
	// SLOT-BREAK-AUTHORITY-C11R: when canonical `classProgramSlot` rows exist for a
	// scope, their BREAK rows ARE the displayed break bands and the retired policy
	// lunch window is never rendered. The policy/event derivation below remains the
	// fallback for a school with no canonical rows.
	const canonicalGrid = buildCanonicalDisplayGrid({
		rows: canonicalRows ?? [],
		policy: { ...(policy as unknown as PolicyInput), specialEvents },
	});
	const specialEventSlots = canonicalGrid.hasCanonicalRows
		? canonicalGrid.specialEventSlots
		: buildSpecialEventSlots({
			maxConsecutiveTeachingMinutesBeforeBreak: policy.maxConsecutiveTeachingMinutesBeforeBreak,
			minBreakMinutesAfterConsecutiveBlock: policy.minBreakMinutesAfterConsecutiveBlock,
			maxTeachingMinutesPerDay: policy.maxTeachingMinutesPerDay,
			earliestStartTime: policy.earliestStartTime,
			latestEndTime: policy.latestEndTime,
			lunchStartTime: policy.lunchStartTime ?? undefined,
			lunchEndTime: policy.lunchEndTime ?? undefined,
			enforceLunchWindow: policy.enforceLunchWindow ?? undefined,
			enableLunchWindow: policy.enableLunchWindow ?? undefined,
			enableFlagCeremony: policy.enableFlagCeremony ?? undefined,
			flagCeremonyStartTime: policy.flagCeremonyStartTime ?? undefined,
			flagCeremonyEndTime: policy.flagCeremonyEndTime ?? undefined,
			enableRecess: policy.enableRecess ?? undefined,
			recessStartTime: policy.recessStartTime ?? undefined,
			recessEndTime: policy.recessEndTime ?? undefined,
			specialEvents,
		});

	return specialEventSlots.map((event) => ({
		eventName: event.eventName,
		startTime: event.startTime,
		endTime: event.endTime,
		dayOfWeek: event.dayOfWeek ?? null,
		days: event.dayOfWeek ? [event.dayOfWeek] : ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
	}));
}

export async function getPublishedSchedulePayload(
	schoolId: number,
	schoolYearId?: number,
	options?: PublishedScheduleReadOptions,
	filter?: { sectionId?: number; facultyId?: number; roomId?: number },
	activeSchoolYearId?: number | null,
) {
	const resolved = await resolvePublishedRun(schoolId, schoolYearId, options, filter, activeSchoolYearId);

	const filteredEntries = filter
		? resolved.entries.filter((entry) => {
				if (filter.sectionId !== undefined && entry.sectionId !== filter.sectionId) return false;
				if (filter.facultyId !== undefined && entry.facultyId !== filter.facultyId) return false;
				if (filter.roomId !== undefined && entry.roomId !== filter.roomId) return false;
				return true;
		  })
		: resolved.entries;

	// C08 — frozen-first. A published revision carrying a valid snapshot resolves
	// every human-readable identity, the policy, the special events, and the
	// term authority from the snapshot. A legacy publication honestly reports
	// `LEGACY_LIVE_PROJECTION` and keeps today's live resolution.
	const frozen = resolved.snapshot;

	const policy = frozen
		? frozen.policy
		: (await db().schedulingPolicy.findUnique({
			where: { schoolId_schoolYearId: { schoolId: resolved.source.schoolId, schoolYearId: resolved.source.schoolYearId } },
		}) ?? POLICY_DEFAULTS);

	const mappedPublishedSpecialEvents = frozen
		? frozen.specialEvents.map((se) => ({
			eventType: se.eventType,
			label: se.label,
			startTime: se.startTime,
			endTime: se.endTime,
			dayOfWeek: se.dayOfWeek,
			gradeGroup: se.gradeGroup,
			programType: se.programType,
		}))
		: (await db().policySpecialEvent.findMany({
			where: { schoolId: resolved.source.schoolId, schoolYearId: resolved.source.schoolYearId, enabled: true },
			orderBy: [{ sortOrder: 'asc' }, { eventType: 'asc' }],
		}))
			// R3: use the single shared Flag/HGP identity + day authority. A rejected
			// (explicit non-Monday) row is never silently re-rendered as Monday.
			.filter((se) => !isRejectedFlagCeremonyRow(se.eventType, null, se.label))
			.map((se) => ({
				eventType: se.eventType,
				label: se.label,
				startTime: se.startTime,
				endTime: se.endTime,
				// `PolicySpecialEvent` has no persisted dayOfWeek column; day scope is
				// derived from the canonical event identity (Flag/HGP is Monday-only).
				dayOfWeek: resolveSpecialEventDayOfWeek(se.eventType, null, se.label) ?? null,
				gradeGroup: se.gradeGroup,
				programType: se.programType,
			}));

	// SLOT-BREAK-AUTHORITY-C11R — the canonical `classProgramSlot` grid owns the
	// displayed break bands for every scope that has rows. A frozen publication
	// renders its OWN frozen rows (published immutability); a legacy live
	// projection reads the same rows the generation path consumed. A client that
	// does not expose the delegate (test doubles, older narrow clients) resolves
	// no canonical rows and keeps the persisted policy fallback, exactly like
	// `published-identity-snapshot.service.ts`.
	const canonicalSlotDelegate = (db() as unknown as {
		classProgramSlot?: { findMany: (args: unknown) => Promise<readonly CanonicalDisplayRow[]> };
	}).classProgramSlot;
	const canonicalDisplayRows: readonly CanonicalDisplayRow[] = frozen
		? (frozen.classProgramSlots ?? [])
		: typeof canonicalSlotDelegate?.findMany === 'function'
			? await canonicalSlotDelegate.findMany({
				where: { schoolId: resolved.source.schoolId, schoolYearId: resolved.source.schoolYearId, isActive: true },
				select: { gradeLevel: true, programType: true, startTime: true, endTime: true, rowKind: true, subjectLabel: true, dayOfWeek: true },
				orderBy: [{ gradeLevel: 'asc' }, { startTime: 'asc' }],
			})
			: [];

	const sectionIds = Array.from(new Set(filteredEntries.map((entry) => entry.sectionId)));
	const subjectIds = Array.from(new Set(filteredEntries.map((entry) => entry.subjectId)));
	const facultyIds = Array.from(new Set(filteredEntries.map((entry) => entry.facultyId).filter((id): id is number => id != null)));
	const roomIds = Array.from(new Set(filteredEntries.map((entry) => entry.roomId)));

	const references = frozen
		? frozenReferenceMaps(frozen)
		: await loadReferenceMaps(
			resolved.source.schoolId,
			resolved.source.schoolYearId,
			sectionIds,
			subjectIds,
			facultyIds,
			roomIds,
		);

	// Term filtering: apply after references are loaded
	let termScope: 'all' | 'explicit' | 'active' = 'all';
	let resolvedTermIndex: number | null = null;
	let activeTermVerified = false;
	let entriesToMap = filteredEntries;
	let resolvedTermContract: ReturnType<typeof frozenTermContract> | null = null;

	if (options?.termIndex !== undefined) {
		const requestedTerm = options.termIndex;
		resolvedTermContract = frozen
			? frozenTermContract(frozen, resolved.source.schoolId, resolved.source.schoolYearId)
			: await loadVerifiedOrderedTermContract(resolved.source.schoolId, resolved.source.schoolYearId);
		const orderedTermDetails = { orderedTerms: resolvedTermContract?.terms.map((term) => ({ ...term })) ?? [] };
		if (!resolvedTermContract) {
			throw err(409, 'TERM_STRUCTURE_UNAVAILABLE', 'No verified ordered term contract is available for this published schedule.', orderedTermDetails);
		}

		if (frozen) {
			// C08 — a published run's term authority is the FROZEN ordered-term
			// contract, never the live active/non-archived mirror cache. This is what
			// makes archived per-term reads and every official export resolvable.
			const frozenContract = resolvedTermContract;
			if (requestedTerm === 'active' && frozenContract.activeTermOrder == null) {
				throw err(409, 'TERM_SELECTION_REQUIRED', 'The active term is unresolved. Choose one ordered term.', orderedTermDetails);
			}
			resolvedTermIndex = resolveRequestedTermIndexFromContract(
				frozenContract,
				resolved.source.schoolId,
				resolved.source.schoolYearId,
				requestedTerm,
			) ?? null;
			activeTermVerified = requestedTerm === 'active';
			termScope = requestedTerm === 'active' ? 'active' : 'explicit';
		} else if (requestedTerm === 'active') {
			// The active term resolves only through the persisted, verified EnrollPro
			// ordered contract and fails closed when it is unavailable.
			const contract = resolvedTermContract;
			if (!contract || contract.activeTermOrder == null) {
				throw err(409, 'TERM_SELECTION_REQUIRED', 'The active term is unresolved. Choose one ordered term.', orderedTermDetails);
			}
			resolvedTermIndex = contract.activeTermOrder;
			activeTermVerified = true;
			termScope = 'active';
		} else {
			// Semantic validation: reject an index absent from the exact school/year
			// contract. A missing contract fails closed rather than guessing.
			const contract = resolvedTermContract;
			if (!contract) {
				throw err(409, 'TERM_STRUCTURE_UNAVAILABLE', 'No verified ordered term contract is available for this school year, so the requested term cannot be validated.');
			}
			if (!isTermIndexWithinContract(requestedTerm, contract.terms)) {
				throw err(400, 'TERM_INDEX_OUTSIDE_CONTRACT', `termIndex ${requestedTerm} is outside the verified ${contract.terms.length}-term ${contract.format} contract for this school year.`);
			}
			resolvedTermIndex = requestedTerm;
			termScope = 'explicit';
		}

		const termFiltered = filteredEntries.filter((entry) => {
			const entryTermIndex = (entry as any).termIndex;
			if (entryTermIndex == null) return false;
			return entryTermIndex === resolvedTermIndex;
		});

		// Strict check: if ANY entries lack termIndex, reject the term-filtered read
		const hasMissingTermIndex = filteredEntries.some((entry) => (entry as any).termIndex == null);
		if (hasMissingTermIndex) {
			throw err(501, 'TERM_FILTER_NOT_READY', 'Some entries lack reliable termIndex. Term-filtered reads are not available until all entries have termIndex.');
		}

		entriesToMap = termFiltered;
	}

	const entries = entriesToMap.map((entry) => {
		const subject = references.subjectById.get(entry.subjectId);
		const room = references.roomById.get(entry.roomId);
		const section = references.sectionById.get(entry.sectionId);
		const cohort = entry.cohortCode ? references.cohortByCode.get(entry.cohortCode) : null;
		const ownershipSpecialization = references.specializationBySubjectSection.get(`${entry.subjectId}:${entry.sectionId}`);
		const specializationCode = cohort?.specializationCode ?? ownershipSpecialization?.specializationCode ?? null;
		const specializationLabel = cohort?.specializationName ?? ownershipSpecialization?.specializationLabel ?? null;
		return {
			entryId: entry.entryId,
			day: entry.day,
			startTime: entry.startTime,
			endTime: entry.endTime,
			durationMinutes: entry.durationMinutes,
			// BENEFICIARY-EXPORT-PARITY-C05 T2 — the presentation projection must
			// carry the entry's ordered-term identity so term-scoped consumers
			// (teacher program, room program) can apply the strict filter instead
			// of failing closed with TERM_FILTER_NOT_READY. A missing term stays
			// `null` (never coerced to Term 1).
			termIndex: typeof (entry as { termIndex?: unknown }).termIndex === 'number'
				? (entry as { termIndex: number }).termIndex
				: null,
			subject: {
				id: entry.subjectId,
				code: subject?.code ?? `SUBJECT_${entry.subjectId}`,
				name: subject?.name ?? 'Unknown Subject',
			},
			section: {
				atlasId: section?.atlasId ?? null,
				externalId: entry.sectionId,
				id: entry.sectionId,
				name: section?.name ?? references.sectionNameById.get(entry.sectionId) ?? `Section #${entry.sectionId}`,
				gradeLevel: section?.gradeLevel ?? null,
				gradeLevelName: section?.gradeLevelName ?? null,
				programType: section?.programType ?? null,
				programCode: section?.programCode ?? null,
				programName: section?.programName ?? null,
			},
			faculty: {
				atlasId: entry.facultyId != null ? (references.facultyById.get(entry.facultyId)?.atlasId ?? entry.facultyId) : null,
				externalId: entry.facultyId != null ? (references.facultyById.get(entry.facultyId)?.externalId ?? null) : null,
				employeeId: entry.facultyId != null ? (references.facultyById.get(entry.facultyId)?.employeeId ?? null) : null,
				id: entry.facultyId,
				name: entry.facultyId != null
					? (references.facultyById.get(entry.facultyId)?.name ?? `Faculty #${entry.facultyId}`)
					: 'Unassigned Faculty',
				isPlaceholder: entry.facultyId != null ? (references.facultyById.get(entry.facultyId)?.isPlaceholder ?? false) : false,
			},
			room: {
				id: entry.roomId,
				name: room?.name ?? `Room #${entry.roomId}`,
				type: room?.type ?? 'UNKNOWN',
				floor: room?.floor ?? null,
				buildingId: room?.building.id ?? null,
				buildingName: room?.building.name ?? null,
			},
			entryKind: entry.entryKind ?? 'SECTION',
			cohortCode: entry.cohortCode ?? null,
			cohortName: entry.cohortName ?? cohort?.specializationName ?? null,
			specializationCode,
			specializationLabel,
		};
	});

	const summaryDisplaySlots = frozen
		? frozen.displaySlots.map((slot) => ({
			startTime: slot.startTime,
			endTime: slot.endTime,
			...(slot.kind === 'SPECIAL_EVENT' ? { eventName: slot.label, isSpecialEvent: true } : {}),
			...(slot.dayOfWeek ? { dayOfWeek: slot.dayOfWeek } : {}),
		}))
		: Array.isArray(resolved.summary?.timetableDisplaySlots)
			? (resolved.summary?.timetableDisplaySlots as Array<{ startTime: string; endTime: string; eventName?: string; isSpecialEvent?: boolean; dayOfWeek?: string }>)
			: [];
	const timeSlots = summaryDisplaySlots.length > 0
		? summaryDisplaySlots
		: Array.from(new Set(entries.map((entry) => `${entry.startTime}-${entry.endTime}`)))
			.map((key) => {
				const [startTime, endTime] = key.split('-');
				return { startTime, endTime };
			})
			.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));

	return {
		source: {
			...resolved.source,
			termScope,
			termIndex: resolvedTermIndex,
			activeTermVerified,
			orderedTerms: resolvedTermContract?.terms.map((term) => ({ ...term })) ?? [],
		},
		timeSlots,
		// C08 — frozen policy/special events feed the same deterministic slot
		// builder the live path uses, so a frozen artifact reproduces byte-stably.
		specialEvents: buildSpecialEventsPayload(policy as never, mappedPublishedSpecialEvents, canonicalDisplayRows),
		entries,
	};
}

export async function getPublishedSectionSchedule(schoolId: number, sectionId: number, schoolYearId?: number, options?: PublishedScheduleReadOptions) {
	return getPublishedSchedulePayload(schoolId, schoolYearId, options, { sectionId });
}

export async function getPublishedFacultySchedule(schoolId: number, facultyId: number, schoolYearId?: number, options?: PublishedScheduleReadOptions) {
	return getPublishedSchedulePayload(schoolId, schoolYearId, options, { facultyId });
}

export async function getPublishedRoomSchedule(schoolId: number, roomId: number, schoolYearId?: number, options?: PublishedScheduleReadOptions) {
	return getPublishedSchedulePayload(schoolId, schoolYearId, options, { roomId });
}

export async function getPublishedFacultyScheduleByExternalId(schoolId: number, externalFacultyId: number, schoolYearId?: number, options?: PublishedScheduleReadOptions) {
	const mirror = await db().facultyMirror.findFirst({
		where: { schoolId, externalId: externalFacultyId },
		select: { id: true },
	});
	if (!mirror) {
		const e = new Error(`No faculty mirror found for external ID ${externalFacultyId}.`) as Error & { statusCode: number; code: string };
		e.statusCode = 404;
		e.code = 'FACULTY_NOT_FOUND';
		throw e;
	}
	return getPublishedSchedulePayload(schoolId, schoolYearId, options, { facultyId: mirror.id });
}

/**
 * PUBLISHED-IMMUTABILITY-C08 (D5/§4.7) — official export term resolution.
 *
 * A PUBLISHED run resolves its requested term through the FROZEN ordered-term
 * contract of its base publication revision, never through the live
 * active/non-archived EnrollPro mirror cache. That is what makes an archived
 * year's per-term exports resolvable after the live term cache is gone.
 *
 * A draft/unpublished run keeps the live verified authority unchanged.
 */
export async function resolvePublishedRunTermIndex(
	schoolId: number,
	schoolYearId: number,
	runId: number,
	requested: number | 'active' | undefined,
): Promise<number | undefined> {
	if (requested === undefined) return undefined;

	const baseRevision = await db().publishedScheduleRevision.findFirst({
		where: {
			schoolId,
			schoolYearId,
			sourceRunId: runId,
			reason: 'INITIAL_PUBLICATION',
		},
		orderBy: [{ effectiveDate: 'asc' }, { id: 'asc' }],
		select: { metadata: true },
	});
	const snapshot = readPublishedIdentitySnapshot(baseRevision?.metadata);
	if (snapshot) {
		return resolveRequestedTermIndexFromContract(
			frozenTermContract(snapshot, schoolId, schoolYearId),
			schoolId,
			schoolYearId,
			requested,
		);
	}
	return resolveRequestedTermIndex(schoolId, schoolYearId, requested);
}
