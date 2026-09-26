import { getDataContext } from '../lib/data-context.js';
import type { ScheduledEntry } from './constraint-validator.js';
import { buildCanonicalDisplayGrid, buildSpecialEventSlots, resolveSpecialEventScope, type CanonicalDisplayRow, type CanonicalDisplayWindowScope, type PolicyInput, type ShiftWindowLike } from './schedule-constructor.js';
import { POLICY_DEFAULTS } from './scheduling-policy.service.js';
import {
	isTermIndexWithinContract,
	loadVerifiedOrderedTermContract,
	resolveRequestedTermIndex,
	resolveRequestedTermIndexFromContract,
} from './academic-term.service.js';
import { isRejectedFlagCeremonyRow, resolveSpecialEventDayOfWeek } from '../lib/policy-special-events.js';
import { schoolLocalDayKey, schoolLocalDayWindow } from '../lib/school-operating-time-zone.js';
import {
	frozenReferenceMaps,
	frozenTermContract,
	readPublishedIdentitySnapshot,
	resolveEffectiveIdentitySnapshot,
	selectEffectiveIdentityOverrideRevisions,
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
	/**
	 * S4-client / D4 — the scheduled revision ids whose `identityOverrides`
	 * contributed to the effective identity snapshot at the read date. Additive:
	 * `appliedRevisionIds` keeps its existing entry-revision meaning.
	 */
	appliedIdentityRevisionIds: number[];
	revisionMarker: string;
	/** C08 — truthful immutability state of the resolved publication. */
	snapshotState: SnapshotState;
	/** C08 — frozen fields an entry references but the snapshot does not carry. */
	snapshotGaps: string[];
	/**
	 * PUBLISHED-DAY-BOUNDARY-A2 (Defect A) — ADDITIVE, and always present.
	 *
	 * `true` when the requested date resolved to a PRIOR publication because the
	 * current head did not cover it, `false` when the current head served it. A
	 * caller can therefore tell a fallback from the head without inferring it.
	 * Every other identity field on this source (`runId`, `activeRevisionId`,
	 * `appliedRevisionIds`, `activeRevisionEffectiveDate`) describes the
	 * publication actually served — the fallback's, never the head's.
	 */
	servedByFallback: boolean;
	/**
	 * PUBLISHED-DAY-BOUNDARY-A2 (Defect A) — the run id of the current
	 * publication head for this scope, even when `runId` is a prior publication.
	 * Equal to `runId` whenever `servedByFallback` is `false`.
	 */
	currentPublishedRunId: number;
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

const PUBLISHED_RUN_META_SELECT = {
	id: true,
	schoolId: true,
	schoolYearId: true,
	version: true,
	runType: true,
	summary: true,
	finishedAt: true,
	createdAt: true,
} as const;

/**
 * PUBLISHED-DAY-BOUNDARY-A2 (Defect A) — a prior publication reached by fallback is
 * re-read through the SAME projection and the SAME eligibility rules as the head
 * (`status: COMPLETED`, `runType: FULL`, same school/year scope).
 *
 * A base revision whose run is not a readable completed publication is NOT silently
 * dropped from consideration. It is selected first, by date, and then this re-read
 * returns `null` so the caller can refuse with a typed
 * `409 PUBLISHED_REVISION_INVALID`. Excluding it here would let an OLDER publication
 * win a date the unreadable one governed, which presents wrong published data as
 * current — see the `!publishedRunMeta` branch in `resolvePublishedRun`.
 */
async function loadReadablePublishedRun(runId: number, schoolId: number) {
	return db().generationRun.findFirst({
		where: { id: runId, schoolId, status: 'COMPLETED', runType: 'FULL' },
		select: PUBLISHED_RUN_META_SELECT,
	});
}

/**
 * PUBLISHED-DAY-BOUNDARY-A2 (Defect A) — the publication in force on a local day.
 *
 * Fails closed rather than approximating:
 *  - two base revisions on one run ⇒ the chain is ambiguous ⇒ 409;
 *  - no chain member at or before the requested day ⇒ the school had published
 *    nothing for that date ⇒ 404 `PUBLISHED_RUN_NOT_FOUND` (the code the public
 *    route already translates, and the code the public page already handles as
 *    "no schedule", not as an error);
 *  - every other chain inconsistency is validated by the caller against the run's
 *    own publication binding.
 *
 * Selection is by DATE ONLY, over EVERY chain member. Readability is deliberately
 * NOT a selection criterion: pruning unreadable members here would silently hand the
 * requested date to an older publication and report it as a legitimate fallback, so
 * the caller could not tell a correct fallback from a wrong schedule. The selected
 * member is re-read by the caller, which fails closed when it is not readable.
 */
async function selectPublicationInForceForDate(params: {
	schoolId: number;
	schoolYearId: number;
	requestedDayKey: string;
}): Promise<{ runId: number; revisionId: number; dayKey: string }> {
	const baseRevisions = await db().publishedScheduleRevision.findMany({
		where: {
			schoolId: params.schoolId,
			schoolYearId: params.schoolYearId,
			reason: 'INITIAL_PUBLICATION',
		},
		orderBy: [{ effectiveDate: 'asc' }, { id: 'asc' }],
		select: { id: true, sourceRunId: true, effectiveDate: true, metadata: true },
	});

	const revisionsByRunId = new Map<number, typeof baseRevisions>();
	for (const revision of baseRevisions) {
		const existing = revisionsByRunId.get(revision.sourceRunId);
		if (existing) existing.push(revision);
		else revisionsByRunId.set(revision.sourceRunId, [revision]);
	}
	for (const [runId, revisions] of revisionsByRunId) {
		if (revisions.length > 1) {
			throw err(409, 'PUBLISHED_REVISION_INVALID', `Publication run ${runId} carries ${revisions.length} immutable publication revisions; the publication in force on ${params.requestedDayKey} is ambiguous.`);
		}
	}

	// Only a revision explicitly marked as the publication base is a chain member.
	const chain = baseRevisions.filter((revision) => isRecord(revision.metadata) && revision.metadata.publicationBase === true);
	if (chain.length === 0) {
		throw err(404, 'PUBLISHED_RUN_NOT_FOUND', 'No published schedule is available for the requested scope.');
	}

	// Selection is over EVERY chain member, by date only. See the note above: an
	// unreadable member must lose the date, not be dropped from the contest.
	const entries = chain
		.map((revision) => ({
			runId: revision.sourceRunId,
			revisionId: revision.id,
			dayKey: schoolLocalDayKey(revision.effectiveDate),
		}))
		// `dayKey` ascending, then the later revision wins a shared day: the most
		// recent publication governs the day it was published for.
		.sort((left, right) => (left.dayKey < right.dayKey ? -1 : left.dayKey > right.dayKey ? 1 : left.revisionId - right.revisionId));

	let winner: { runId: number; revisionId: number; dayKey: string } | null = null;
	for (const entry of entries) {
		if (entry.dayKey > params.requestedDayKey) break;
		winner = entry;
	}
	if (!winner) {
		throw err(404, 'PUBLISHED_RUN_NOT_FOUND', `No published schedule is in force on ${params.requestedDayKey} for the requested scope.`);
	}
	return winner;
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
	const headRunMeta = publishedRunCandidates[0];
	if (!headRunMeta) {
		throw err(404, 'PUBLISHED_RUN_NOT_FOUND', 'No published schedule is available for the requested scope.');
	}

	// PUBLISHED-DAY-BOUNDARY-A2 (Defect A) — resolve WHICH publication was in force
	// on the requested local calendar day before anything else reads rows from it.
	//
	// The pre-fix reader only ever considered the current head. When the head's base
	// revision did not cover the requested date it threw
	// `409 PUBLISHED_REVISION_INVALID` ("unavailable for the requested date"), so a
	// date the school HAD published for became unreachable: publishing run 320 at
	// 00:38 +08 on 2026-09-27 (16:38Z on 2026-09-26) made 2026-09-26 — a day run 319
	// was genuinely in force for — return 409, and the public page ("Unable to load
	// public schedule") followed the browser's local today into the failure.
	//
	// The chain is the immutable `INITIAL_PUBLICATION` base revisions of the scope.
	// Selection is by the school's local calendar DAY of each base revision's
	// `effectiveDate`, which is the same day rule the writer now stamps
	// (Defect B) and the same frame the caller's `?date=` is expressed in. Legacy
	// rows stamped with a raw instant are handled by the identical rule — that is
	// why this reader change alone makes the ALREADY-PUBLISHED, ALREADY-MIS-STAMPED
	// revisions correct, with no row rewritten and no migration.
	//
	// `YYYY-MM-DD` is zero-padded and fixed-width, so plain string comparison is
	// chronological. `servedByFallback` below reports when the winner is not the head.
	const requestedDay = schoolLocalDayWindow(readDate);
	const inForcePublication = await selectPublicationInForceForDate({
		schoolId,
		schoolYearId: headRunMeta.schoolYearId,
		requestedDayKey: requestedDay.dayKey,
	});

	const publishedRunMeta = inForcePublication.runId === headRunMeta.id
		? headRunMeta
		: await loadReadablePublishedRun(inForcePublication.runId, schoolId);
	if (!publishedRunMeta) {
		// Fail closed: the chain named a run this reader cannot read as a
		// publication. Serving the nearest other publication would be a guess.
		throw err(409, 'PUBLISHED_REVISION_INVALID', `The publication in force on ${requestedDay.dayKey} (run ${inForcePublication.runId}) is not a readable completed publication for the requested scope.`);
	}

	const publication = isRecord(publishedRunMeta.summary) && isRecord(publishedRunMeta.summary.publication)
		? publishedRunMeta.summary.publication
		: null;
	const publicationRevisionId = Number(publication?.revisionId);
	const publicationRunVersion = Number(publication?.sourceRunVersion);
	const servedByFallback = inForcePublication.runId !== headRunMeta.id;
	if (!Number.isInteger(publicationRevisionId) || publicationRevisionId < 1 || !Number.isInteger(publicationRunVersion)) {
		throw err(409, 'PUBLISHED_REVISION_INVALID', 'The published run is not bound to its immutable publication revision.');
	}
	// PUBLISHED-DAY-BOUNDARY-A2 — the run/publication binding is validated on the
	// pair the product actually freezes, which is supersession-proof.
	//
	// The pre-fix reader required `publication.sourceRunVersion === run.version`.
	// That equality is only ever true for the CURRENT head: `publishSchedule`
	// retires a prior publication with `version: { increment: 1 }`
	// (`publication-contract.service.ts`) while deliberately leaving
	// `summary.publication.sourceRunVersion` at its publish-time value. A fallback
	// therefore legitimately reads a run whose version has moved on, and the
	// equality would reject every prior publication — turning the fix into a
	// different 409.
	//
	// So: the head keeps its exact original invariant, and a fallback is instead
	// proven to be a genuine superseded publication (a supersession pointer naming
	// a later run) with its run still bound to one frozen publication version. The
	// frozen pairing itself is checked below against the base revision's
	// `metadata.sourceRunVersion`, which no code path rewrites.
	if (!servedByFallback && publicationRunVersion !== publishedRunMeta.version) {
		throw err(409, 'PUBLISHED_REVISION_INVALID', 'The published run is not bound to its immutable publication revision.');
	}
	if (servedByFallback) {
		const supersededByRunId = Number((publishedRunMeta.summary as Record<string, unknown>).publicationSupersededByRunId);
		const supersededAt = (publishedRunMeta.summary as Record<string, unknown>).publicationSupersededAt;
		if (!Number.isInteger(supersededByRunId) || supersededByRunId < 1 || typeof supersededAt !== 'string' || supersededAt.length === 0) {
			throw err(409, 'PUBLISHED_REVISION_INVALID', 'The prior publication in force for the requested date carries no valid supersession record.');
		}
	}
	if (publicationRevisionId !== inForcePublication.revisionId) {
		// The chain and the run disagree about which immutable revision is this
		// publication's base. The chain cannot be trusted, so nothing is served.
		throw err(409, 'PUBLISHED_REVISION_INVALID', 'The publication revision chain disagrees with the publication binding of the run in force.');
	}

	const applicableRevisions = await db().publishedScheduleRevision.findMany({
		where: {
			schoolId: publishedRunMeta.schoolId,
			schoolYearId: publishedRunMeta.schoolYearId,
			sourceRunId: publishedRunMeta.id,
			status: { in: ['SCHEDULED', 'SUPERSEDED'] },
			// Scheduled overrides keep their exact-instant rule: a revision is applied
			// only once its instant has passed the read anchor. The publication's OWN
			// base revision is day-granular instead, so it is additionally admitted for
			// the whole requested local day. That second arm is what keeps a legacy
			// base revision stamped with a raw publish instant (for example 15:58Z on
			// the requested day, i.e. 23:58 local) readable on that same day instead of
			// rejecting the date the school published for. It can only ever admit the
			// one revision already selected by the day rule above.
			OR: [
				{ effectiveDate: { lte: readDate } },
				{ id: publicationRevisionId, effectiveDate: { lt: requestedDay.endExclusiveUtc } },
			],
		},
		orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
		select: {
			id: true,
			effectiveDate: true,
			changeSet: true,
			sourceRevisionId: true,
			reason: true,
			status: true,
			metadata: true,
		},
	});
	const baseRevision = applicableRevisions.find((revision) => revision.id === publicationRevisionId);
	const baseMetadata = isRecord(baseRevision?.metadata) ? baseRevision.metadata : null;
	if (!baseRevision || baseRevision.sourceRevisionId !== null || baseRevision.reason !== 'INITIAL_PUBLICATION'
		|| baseMetadata?.publicationBase !== true || Number(baseMetadata.sourceRunVersion) !== publicationRunVersion) {
		// The date is no longer the reason this can fail: the selected publication's
		// base revision is day-selected above, so a failure here is a broken
		// publication binding, not an uncovered date. The version comparison is
		// against the publication's own FROZEN `sourceRunVersion`, not the run's
		// current version, so a superseded publication stays valid.
		throw err(409, 'PUBLISHED_REVISION_INVALID', 'The immutable publication revision is not a valid publication base for the run in force on the requested date.');
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
	//
	// S4-client / D4 — the canonical published read applies every already-effective
	// scheduled revision `identityOverrides` in effective-date order on top of the
	// base freeze (the same resolver + validator the S4-server write path uses; no
	// second validator is forked). The base snapshot and its persisted bytes are
	// never mutated, and a withdrawn (SUPERSEDED) override stops governing.
	const baseSnapshot = readPublishedIdentitySnapshot(baseMetadata);
	const frozenSnapshot = baseSnapshot
		? resolveEffectiveIdentitySnapshot({ baseMetadata, revisions: applicableRevisions, asOf: readDate })
		: null;
	const snapshotState: SnapshotState = frozenSnapshot ? 'FROZEN' : 'LEGACY_LIVE_PROJECTION';
	const appliedIdentityRevisionIds = frozenSnapshot
		? selectEffectiveIdentityOverrideRevisions(applicableRevisions, readDate)
			.map((revision) => revision.id)
			.filter((id): id is number => typeof id === 'number')
		: [];

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
			appliedIdentityRevisionIds,
			// PUBLISHED-DAY-BOUNDARY-A2 (Defect A) — every identity field above
			// describes the publication ACTUALLY SERVED for `resolvedForDate`, and
			// these two fields make a fallback explicit instead of letting a caller
			// mistake a prior publication for the current head.
			servedByFallback,
			currentPublishedRunId: headRunMeta.id,
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

/**
 * SPECIAL-EVENT-SCOPE-C01 (D8) — the persisted `grade_shift_windows` shape and
 * the additive `source.shiftWindows[]` element. The scope/shift derivation is the
 * pure `resolveSpecialEventScope` authority in `schedule-constructor.ts`.
 */
type GradeShiftWindowLike = ShiftWindowLike;

type PublishedShiftWindow = {
	gradeLevel: number;
	programType: string | null;
	startTime: string;
	endTime: string;
};

function buildSpecialEventsPayload(
	policy: NonNullable<Parameters<typeof buildSpecialEventSlots>[0]>,
	specialEvents?: Array<{ eventType: string; label: string; startTime: string; endTime: string; dayOfWeek?: string | null; gradeGroup?: string | null; programType?: string | null }>,
	canonicalRows?: readonly CanonicalDisplayRow[] | null,
	shiftWindows: readonly GradeShiftWindowLike[] = [],
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

	// SPECIAL-EVENT-SCOPE-C01 (D8) — ADDITIVE scope attribution. The dedupe
	// already collapses the union by `startTime-endTime` into ONE row per distinct
	// window; `buildCanonicalDisplayGrid` now accumulates the owning
	// `(gradeLevel, programType)` SET while collapsing, so each emitted window can
	// carry a truthful scope without changing the row count or any existing field.
	// A consumer that ignores `scope` sees exactly what it saw before.
	const windowScopeByKey = new Map<string, CanonicalDisplayWindowScope>();
	canonicalGrid.specialEventSlots.forEach((slot, index) => {
		const key = `${slot.startTime}-${slot.endTime}`;
		if (!windowScopeByKey.has(key)) windowScopeByKey.set(key, canonicalGrid.specialEventWindowScopes[index]);
	});
	return specialEventSlots.map((event) => ({
		eventName: event.eventName,
		startTime: event.startTime,
		endTime: event.endTime,
		dayOfWeek: event.dayOfWeek ?? null,
		days: event.dayOfWeek ? [event.dayOfWeek] : ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
		scope: resolveSpecialEventScope(windowScopeByKey.get(`${event.startTime}-${event.endTime}`), event, shiftWindows),
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

	// SPECIAL-EVENT-SCOPE-C01 (D8) — the school grade-to-shift map
	// (`grade_shift_windows`). Additive: it lets a consumer map any
	// `entry.section.gradeLevel` to its shift without guessing, and it is the basis
	// for each window's `scope.shift`. A client that does not expose the delegate
	// (test doubles, older narrow clients) resolves an empty map and every
	// `scope.shift` stays `null` rather than a fabricated band. The frozen snapshot
	// does not carry shift windows, so this additive map is read live; every
	// EXISTING field and the `specialEvents[]` rows remain frozen.
	const gradeShiftWindowDelegate = (db() as unknown as {
		gradeShiftWindow?: { findMany: (args: unknown) => Promise<readonly GradeShiftWindowLike[]> };
	}).gradeShiftWindow;
	const shiftWindows: readonly GradeShiftWindowLike[] = typeof gradeShiftWindowDelegate?.findMany === 'function'
		? await gradeShiftWindowDelegate.findMany({
			where: { schoolId: resolved.source.schoolId, schoolYearId: resolved.source.schoolYearId },
			select: { gradeLevel: true, programType: true, startTime: true, endTime: true },
			orderBy: [{ gradeLevel: 'asc' }, { programType: 'asc' }],
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
			// SPECIAL-EVENT-SCOPE-C01 (D8) — the additive school grade-to-shift map,
			// so a consumer can attribute any entry's section grade to its shift.
			shiftWindows: shiftWindows.map((window) => ({
				gradeLevel: window.gradeLevel,
				programType: window.programType ?? null,
				startTime: window.startTime,
				endTime: window.endTime,
			} satisfies PublishedShiftWindow)),
		},
		timeSlots,
		// C08 — frozen policy/special events feed the same deterministic slot
		// builder the live path uses, so a frozen artifact reproduces byte-stably.
		specialEvents: buildSpecialEventsPayload(policy as never, mappedPublishedSpecialEvents, canonicalDisplayRows, shiftWindows),
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
		/**
		 * PUBLISHED-TERM-AND-DRIFT-FOLLOWUP-C01 (F1) — an official export must
		 * honour the EFFECTIVE identity, not only the base publication bytes.
		 *
		 * A base revision alone under-reports: once a `SCHEDULED` revision
		 * overrides the ordered-term contract (for example a 3-term TRIMESTER
		 * year re-cut as 4-term QUARTERS), every already-effective export has to
		 * resolve against the contract that is actually in force, or a valid
		 * term fails closed as out-of-contract.
		 *
		 * The revision chain is read in effective-date order and resolved
		 * through the SAME already-imported `resolveEffectiveIdentitySnapshot`
		 * that the D4 read path uses, so there is no second validator and no new
		 * import edge. `asOf` is pinned at the call site; threading a caller date
		 * through the eight export routes is out of scope for this cycle.
		 *
		 * Fail-closed shape is unchanged: a SUPERSEDED/withdrawn revision is
		 * skipped by the resolver (only `SCHEDULED` overrides govern), a legacy
		 * publication with no base snapshot still falls through to the live
		 * verified authority, and `TERM_INDEX_OUTSIDE_CONTRACT` /
		 * `TERM_SELECTION_REQUIRED` keep their existing codes and statuses. The
		 * base revision is never mutated, so a direct base read still returns
		 * the base bytes.
		 */
		const asOf = new Date();
		const revisionChain = await db().publishedScheduleRevision.findMany({
			where: {
				schoolId,
				schoolYearId,
				sourceRunId: runId,
				status: { in: ['SCHEDULED', 'SUPERSEDED'] },
			},
			orderBy: [{ effectiveDate: 'asc' }, { id: 'asc' }],
			select: { id: true, status: true, effectiveDate: true, metadata: true },
		});
		const effective = resolveEffectiveIdentitySnapshot({
			baseMetadata: baseRevision?.metadata,
			revisions: revisionChain,
			asOf,
		}) ?? snapshot;
		return resolveRequestedTermIndexFromContract(
			frozenTermContract(effective, schoolId, schoolYearId),
			schoolId,
			schoolYearId,
			requested,
		);
	}
	return resolveRequestedTermIndex(schoolId, schoolYearId, requested);
}
