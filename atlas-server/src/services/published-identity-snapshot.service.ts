/**
 * PUBLISHED-IMMUTABILITY-C08 — frozen publication identity snapshot.
 *
 * A published revision is a historically reproducible artifact: once a run is
 * published, later changes to subject/faculty/room/building/section/
 * specialization/cohort/policy/special-event/term-authority records must not
 * change that revision's rendered truth. The frozen snapshot is persisted in the
 * BASE `PublishedScheduleRevision.metadata` JSON under `publishedIdentitySnapshot`
 * (no schema change, no migration).
 *
 * Contract:
 *  - `buildPublishedIdentitySnapshot` performs a preflight read through the
 *    caller-supplied client and must be invoked inside the same Serializable
 *    transaction that persists the publication, after the existing freshness
 *    comparison. If any covered input changed, the surrounding transaction fails
 *    closed and no snapshot is attached.
 *  - `assertSnapshotConsistency` rejects a publish whose frozen special events
 *    contradict its frozen display slots (typed blocker, zero writes).
 *  - Readers resolve frozen fields first; legacy publications without a snapshot
 *    are reported honestly as `LEGACY_LIVE_PROJECTION`.
 */

import type { Prisma, PrismaClient } from '@prisma/client';

import {
	loadVerifiedOrderedTermContract,
	type LoadedAcademicTermContract,
} from './academic-term.service.js';
import { buildSpecialEventSlots } from './schedule-constructor.js';
import { resolveCanonicalSlotsFromRows, type ClassProgramSlotRow, type ResolvedSlotRow } from './class-program-slot.service.js';
import {
	isRejectedFlagCeremonyRow,
	resolveSpecialEventDayOfWeek,
} from '../lib/policy-special-events.js';

export const PUBLISHED_IDENTITY_SNAPSHOT_SCHEMA_VERSION = 1;
export const PUBLISHED_IDENTITY_SNAPSHOT_KEY = 'publishedIdentitySnapshot';

export type SnapshotState = 'FROZEN' | 'LEGACY_LIVE_PROJECTION';

export type FrozenTermContract = {
	format: 'TRIMESTER' | 'QUARTERS';
	terms: Array<{ identity: string; displayLabel: string; order: number }>;
	activeTermOrder: number | null;
};

export type FrozenDisplaySlot = {
	key: string;
	label: string;
	startTime: string;
	endTime: string;
	order: number;
	kind: 'PERIOD' | 'SPECIAL_EVENT';
	dayOfWeek: string | null;
};

export type FrozenSpecialEvent = {
	eventType: string;
	label: string;
	gradeGroup: string | null;
	programType: string | null;
	startTime: string;
	endTime: string;
	sortOrder: number;
	dayOfWeek: string | null;
};

export type FrozenClassProgramSlot = {
	id: number;
	gradeLevel: number;
	programType: string | null;
	dayOfWeek: string | null;
	startTime: string;
	endTime: string;
	rowKind: string;
	subjectFamily: string | null;
	subjectLabel: string | null;
	sourceLabel: string;
	sourceNote: string | null;
};

export type PublishedIdentitySnapshot = {
	schemaVersion: 1;
	capturedAt: string;
	inputFingerprint: string;
	orderedTermContract: FrozenTermContract;
	subjects: Record<string, { code: string; name: string }>;
	faculty: Record<string, {
		externalId: string | null;
		employeeId: string | null;
		displayName: string | null;
		firstName: string | null;
		lastName: string | null;
		isPlaceholder: boolean;
		advisedSectionId: number | null;
	}>;
	sections: Record<string, {
		atlasId: number | null;
		externalId: string | null;
		name: string;
		gradeLevelId: number | null;
		gradeLevelName: string | null;
		programType: string | null;
		programCode: string | null;
		programName: string | null;
	}>;
	buildings: Record<string, { name: string }>;
	rooms: Record<string, {
		name: string;
		type: string;
		floor: string | null;
		buildingId: number | null;
		buildingName: string | null;
	}>;
	specializations: Record<string, { code: string; label: string | null }>;
	cohorts: Record<string, {
		cohortCode: string | null;
		name: string | null;
		specializationCode: string | null;
		specializationName: string | null;
	}>;
	advisers: Record<string, { sectionId: number; lastName: string; fullName: string | null }>;
	displaySlots: FrozenDisplaySlot[];
	specialEvents: FrozenSpecialEvent[];
	policy: Record<string, unknown>;
	/**
	 * The configured class-program template rows the class-program and matrix
	 * outputs render. Frozen so a later template edit cannot rewrite history.
	 * Absent on legacy snapshots; readers then keep live resolution.
	 */
	classProgramSlots: FrozenClassProgramSlot[];
};

type SnapshotError = Error & { statusCode: number; code: string; details?: Record<string, unknown> };

function snapshotError(statusCode: number, code: string, message: string, details?: Record<string, unknown>): SnapshotError {
	const error = new Error(message) as SnapshotError;
	error.statusCode = statusCode;
	error.code = code;
	error.details = details;
	return error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** A minimal entry projection the snapshot builder consumes. */
export type SnapshotEntryLike = {
	subjectId?: number | null;
	facultyId?: number | null;
	roomId?: number | null;
	sectionId?: number | null;
	cohortCode?: string | null;
};

// ─── Structural validation ───

/**
 * Structural validation of a persisted snapshot. Returns `null` when the value
 * is not a well-formed current-schema snapshot; the caller must then report
 * `LEGACY_LIVE_PROJECTION` rather than fabricate frozen truth from partial data.
 */
export function readPublishedIdentitySnapshot(value: unknown): PublishedIdentitySnapshot | null {
	if (!isRecord(value)) return null;
	const candidate = value[PUBLISHED_IDENTITY_SNAPSHOT_KEY];
	if (!isRecord(candidate)) return null;
	if (candidate.schemaVersion !== PUBLISHED_IDENTITY_SNAPSHOT_SCHEMA_VERSION) return null;
	if (typeof candidate.capturedAt !== 'string' || candidate.capturedAt.length === 0) return null;
	if (typeof candidate.inputFingerprint !== 'string') return null;
	const contract = candidate.orderedTermContract;
	if (!isRecord(contract) || (contract.format !== 'TRIMESTER' && contract.format !== 'QUARTERS') || !Array.isArray(contract.terms)) {
		return null;
	}
	for (const term of contract.terms) {
		if (!isRecord(term) || typeof term.identity !== 'string' || typeof term.order !== 'number' || typeof term.displayLabel !== 'string') {
			return null;
		}
	}
	for (const key of ['subjects', 'faculty', 'sections', 'buildings', 'rooms', 'specializations', 'cohorts'] as const) {
		if (!isRecord(candidate[key])) return null;
	}
	if (candidate.advisers !== undefined && !isRecord(candidate.advisers)) return null;
	if (!Array.isArray(candidate.displaySlots) || !Array.isArray(candidate.specialEvents) || !isRecord(candidate.policy)) {
		return null;
	}
	if (candidate.classProgramSlots !== undefined && !Array.isArray(candidate.classProgramSlots)) {
		return null;
	}
	return candidate as unknown as PublishedIdentitySnapshot;
}

// ─── Consistency gate (§3.4) ───

function timeToMinutes(value: string): number {
	const [hours, minutes] = value.split(':').map(Number);
	return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

/**
 * True when `outer` fully contains `[inner.startTime, inner.endTime]` on the same
 * clock. Mirrors `resolveContainingClassRow` (inclusive bounds); a degenerate
 * window (`end <= start`) is never contained.
 */
function containsInterval(
	outer: { startTime: string; endTime: string },
	inner: { startTime: string; endTime: string },
): boolean {
	const innerStart = timeToMinutes(inner.startTime);
	const innerEnd = timeToMinutes(inner.endTime);
	if (innerEnd <= innerStart) return false;
	return timeToMinutes(outer.startTime) <= innerStart && timeToMinutes(outer.endTime) >= innerEnd;
}

/**
 * Frozen display slots and frozen special events must be consistent. A day-scoped
 * event (e.g. the Monday-only Flag Ceremony/HGP overlay) must stay a day-scoped
 * overlay on its underlying configured interval; it must never appear as an
 * added week-spanning ordinary slot.
 *
 * Interval authority is CONTAINMENT, not string identity, because that is what
 * the real producer does: `resolveContainingClassRow` snaps the Monday Flag/HGP
 * overlay to the single canonical CLASS row that contains its persisted window
 * (raw event `07:00-07:30` renders on frozen slot `06:45-07:30`). Exact matching
 * rejected every canonical-shape publication with a false
 * `PUBLICATION_SNAPSHOT_INCONSISTENT`.
 */
export function assertSnapshotConsistency(snapshot: PublishedIdentitySnapshot): void {
	const contradictions: Array<Record<string, unknown>> = [];

	// event → slots: an event window is satisfied when at least one display slot
	// contains it; a day-scoped event additionally needs one containing slot on
	// the same weekday.
	for (const event of snapshot.specialEvents) {
		const intervalKey = `${event.startTime}-${event.endTime}`;
		const containing = snapshot.displaySlots.filter((slot) => containsInterval(slot, event));
		if (containing.length === 0) {
			// A frozen event with no underlying frozen interval would render as an
			// added band the artifact never declared.
			contradictions.push({ kind: 'EVENT_INTERVAL_MISSING', eventType: event.eventType, intervalKey });
			continue;
		}
		if (event.dayOfWeek == null) continue;
		// A day-scoped event must be carried by a day-scoped slot for the same day.
		const dayScoped = containing.some((slot) => slot.dayOfWeek === event.dayOfWeek);
		if (!dayScoped) {
			contradictions.push({
				kind: 'DAY_SCOPED_EVENT_NOT_DAY_SCOPED',
				eventType: event.eventType,
				intervalKey,
				dayOfWeek: event.dayOfWeek,
			});
		}
		// The Monday Flag/HGP identity must never be persisted as a non-Monday row.
		if (isRejectedFlagCeremonyRow(event.eventType, event.dayOfWeek, event.label)) {
			contradictions.push({ kind: 'FLAG_HGP_REJECTED_DAY', eventType: event.eventType, dayOfWeek: event.dayOfWeek });
		}
	}

	// slot → events: a special-event display slot must be backed by a frozen
	// special event window it contains (the same containment relation in
	// reverse), or by the frozen policy's own global break configuration when no
	// explicit event row exists (`buildSpecialEventSlots` falls back to those
	// policy fields).
	const globalEventIntervals = policyGlobalEventIntervals(snapshot.policy);
	for (const slot of snapshot.displaySlots) {
		if (slot.kind !== 'SPECIAL_EVENT') continue;
		const intervalKey = `${slot.startTime}-${slot.endTime}`;
		const backedByEvent = snapshot.specialEvents.some((event) => containsInterval(slot, event));
		if (!backedByEvent && !globalEventIntervals.has(intervalKey)) {
			contradictions.push({ kind: 'SPECIAL_EVENT_SLOT_UNBACKED', intervalKey, label: slot.label });
		}
	}

	if (contradictions.length > 0) {
		throw snapshotError(
			422,
			'PUBLICATION_SNAPSHOT_INCONSISTENT',
			'The publication snapshot is internally inconsistent: frozen special events contradict the frozen display slots.',
			{ contradictions },
		);
	}
}

/**
 * The intervals `buildSpecialEventSlots` derives from the frozen policy's global
 * break configuration when no explicit special-event rows exist.
 */
function policyGlobalEventIntervals(policy: Record<string, unknown>): Set<string> {
	const intervals = new Set<string>();
	const asString = (value: unknown, fallback: string): string => (typeof value === 'string' && value.length > 0 ? value : fallback);
	if (policy.enableFlagCeremony ?? true) {
		intervals.add(`${asString(policy.flagCeremonyStartTime, '07:00')}-${asString(policy.flagCeremonyEndTime, '07:30')}`);
	}
	if (policy.enableRecess ?? true) {
		intervals.add(`${asString(policy.recessStartTime, '09:45')}-${asString(policy.recessEndTime, '10:00')}`);
	}
	if ((policy.enableLunchWindow ?? policy.enforceLunchWindow ?? true) !== false) {
		intervals.add(`${asString(policy.lunchStartTime, '11:55')}-${asString(policy.lunchEndTime, '12:55')}`);
	}
	return intervals;
}

// ─── Frozen read helpers ───

export function frozenTermContract(snapshot: PublishedIdentitySnapshot, schoolId: number, schoolYearId: number): LoadedAcademicTermContract {
	return {
		schoolId,
		schoolYearId,
		format: snapshot.orderedTermContract.format,
		terms: snapshot.orderedTermContract.terms.map((term) => ({ ...term })),
		activeTermOrder: snapshot.orderedTermContract.activeTermOrder,
	};
}

export type FrozenFacultyReference = {
	atlasId: number;
	externalId: string | null;
	employeeId: string | null;
	name: string;
	isPlaceholder: boolean;
	advisedSectionId: number | null;
};

export type FrozenRoomReference = {
	id: number;
	name: string;
	type: string;
	floor: string | null;
	building: { id: number | null; name: string | null };
};

export type FrozenSectionReference = {
	atlasId: number | null;
	name: string;
	gradeLevel: number | null;
	gradeLevelName: string | null;
	programType: string | null;
	programCode: string | null;
	programName: string | null;
};

export type FrozenSpecializationReference = { specializationCode: string | null; specializationLabel: string | null };

export type FrozenReferenceMaps = {
	subjectById: Map<number, { id: number; code: string; name: string }>;
	facultyById: Map<number, FrozenFacultyReference>;
	roomById: Map<number, FrozenRoomReference>;
	sectionById: Map<number, FrozenSectionReference>;
	sectionNameById: Map<number, string>;
	cohortByCode: Map<string, { specializationCode: string | null; specializationName: string | null }>;
	specializationBySubjectSection: Map<string, FrozenSpecializationReference>;
	adviserBySectionId: Map<number, string>;
};

/**
 * Build reader-shaped maps from the frozen snapshot. Keys are the numeric ids
 * captured at publication; a field absent from the snapshot key set is simply
 * absent here so the caller renders its deterministic placeholder and reports a
 * `snapshotGap` rather than reading live tables.
 */
export function frozenReferenceMaps(snapshot: PublishedIdentitySnapshot): FrozenReferenceMaps {
	const subjectById = new Map<number, { id: number; code: string; name: string }>();
	for (const [key, value] of Object.entries(snapshot.subjects)) {
		const id = Number(key);
		if (Number.isInteger(id)) subjectById.set(id, { id, code: value.code, name: value.name });
	}

	const facultyById = new Map<number, FrozenFacultyReference>();
	for (const [key, value] of Object.entries(snapshot.faculty)) {
		const id = Number(key);
		if (!Number.isInteger(id)) continue;
		const name = value.displayName
			?? ([value.lastName, value.firstName].filter(Boolean).join(', ') || `Faculty #${id}`);
		facultyById.set(id, {
			atlasId: id,
			externalId: value.externalId,
			employeeId: value.employeeId,
			name,
			isPlaceholder: value.isPlaceholder,
			advisedSectionId: value.advisedSectionId ?? null,
		});
	}

	const roomById = new Map<number, FrozenRoomReference>();
	for (const [key, value] of Object.entries(snapshot.rooms)) {
		const id = Number(key);
		if (!Number.isInteger(id)) continue;
		const buildingId = value.buildingId ?? null;
		const buildingName = value.buildingName
			?? (buildingId != null ? snapshot.buildings[String(buildingId)]?.name ?? null : null);
		roomById.set(id, {
			id,
			name: value.name,
			type: value.type,
			floor: value.floor,
			building: { id: buildingId, name: buildingName },
		});
	}

	const sectionById = new Map<number, FrozenSectionReference>();
	const sectionNameById = new Map<number, string>();
	for (const [key, value] of Object.entries(snapshot.sections)) {
		const externalId = Number(key);
		if (!Number.isInteger(externalId)) continue;
		sectionById.set(externalId, {
			atlasId: value.atlasId ?? null,
			name: value.name,
			gradeLevel: value.gradeLevelId ?? null,
			gradeLevelName: value.gradeLevelName ?? null,
			programType: value.programType ?? null,
			programCode: value.programCode ?? null,
			programName: value.programName ?? null,
		});
		sectionNameById.set(externalId, value.name);
	}

	const cohortByCode = new Map<string, { specializationCode: string | null; specializationName: string | null }>();
	for (const [code, value] of Object.entries(snapshot.cohorts)) {
		if (code.length === 0) continue;
		cohortByCode.set(code, { specializationCode: value.specializationCode, specializationName: value.specializationName });
	}

	const specializationBySubjectSection = new Map<string, { specializationCode: string | null; specializationLabel: string | null }>();
	for (const [key, value] of Object.entries(snapshot.specializations)) {
		specializationBySubjectSection.set(key, { specializationCode: value.code, specializationLabel: value.label });
	}

	const adviserBySectionId = new Map<number, string>();
	for (const value of Object.values(snapshot.advisers ?? {})) {
		if (Number.isInteger(value.sectionId)) adviserBySectionId.set(value.sectionId, value.lastName);
	}

	return { subjectById, facultyById, roomById, sectionById, sectionNameById, cohortByCode, specializationBySubjectSection, adviserBySectionId };
}

/**
 * Deterministic placeholder gap list: every frozen field an entry references but
 * the snapshot does not carry. These never fall back to live authority.
 */
export function snapshotGaps(snapshot: PublishedIdentitySnapshot, entries: SnapshotEntryLike[]): string[] {
	const gaps = new Set<string>();
	for (const entry of entries) {
		if (entry.subjectId != null && !snapshot.subjects[String(entry.subjectId)]) gaps.add(`SUBJECT_${entry.subjectId}`);
		if (entry.facultyId != null && !snapshot.faculty[String(entry.facultyId)]) gaps.add(`FACULTY_${entry.facultyId}`);
		if (entry.roomId != null && !snapshot.rooms[String(entry.roomId)]) gaps.add(`ROOM_${entry.roomId}`);
		if (entry.sectionId != null && !snapshot.sections[String(entry.sectionId)]) gaps.add(`SECTION_${entry.sectionId}`);
	}
	return [...gaps].sort();
}

// ─── Snapshot construction (preflight read) ───

type SnapshotClient = Prisma.TransactionClient | PrismaClient;

type DisplaySlotSource = {
	startTime: string;
	endTime: string;
	eventName?: string;
	isSpecialEvent?: boolean;
	dayOfWeek?: string | null;
};

export type BuildSnapshotArgs = {
	schoolId: number;
	schoolYearId: number;
	client: SnapshotClient;
	entries: SnapshotEntryLike[];
	inputFingerprint: string;
	capturedAt: string;
	/** Run summary display slots (canonical period/event bands), when persisted. */
	summaryDisplaySlots?: DisplaySlotSource[];
	termContract?: LoadedAcademicTermContract | null;
};

/**
 * Read and freeze every identity the published artifact can render. Performed
 * inside the caller's Serializable transaction so the snapshot bytes and the
 * persisted publication observe one consistent database state.
 */
export async function buildPublishedIdentitySnapshot(args: BuildSnapshotArgs): Promise<PublishedIdentitySnapshot> {
	const { schoolId, schoolYearId, client, entries } = args;

	const contract = args.termContract
		?? await loadVerifiedOrderedTermContract(schoolId, schoolYearId, client as never);
	if (!contract) {
		throw snapshotError(
			409,
			'PUBLICATION_SNAPSHOT_TERM_CONTRACT_UNAVAILABLE',
			'The publication snapshot requires the verified ordered term contract for the active year.',
		);
	}

	const subjectIds = [...new Set(entries.map((entry) => entry.subjectId).filter((id): id is number => typeof id === 'number' && id > 0))];
	const facultyIds = [...new Set(entries.map((entry) => entry.facultyId).filter((id): id is number => typeof id === 'number' && id > 0))];
	const roomIds = [...new Set(entries.map((entry) => entry.roomId).filter((id): id is number => typeof id === 'number' && id > 0))];
	const sectionIds = [...new Set(entries.map((entry) => entry.sectionId).filter((id): id is number => typeof id === 'number' && id > 0))];
	const cohortCodes = [...new Set(entries.map((entry) => entry.cohortCode).filter((code): code is string => typeof code === 'string' && code.length > 0))];

	const [subjects, faculty, rooms, sectionMirrors, cohorts, ownershipRows, policy, specialEventRows, classProgramSlotRows] = await Promise.all([
		subjectIds.length > 0
			? client.subject.findMany({ where: { schoolId, id: { in: subjectIds } }, select: { id: true, code: true, name: true } })
			: Promise.resolve([]),
		facultyIds.length > 0
			? client.facultyMirror.findMany({
				where: { schoolId, id: { in: facultyIds } },
				select: { id: true, externalId: true, employeeId: true, firstName: true, lastName: true, isPlaceholder: true, advisedSectionId: true },
			})
			: Promise.resolve([]),
		roomIds.length > 0
			? client.room.findMany({
				where: { building: { schoolId }, id: { in: roomIds } },
				select: { id: true, name: true, type: true, floor: true, building: { select: { id: true, name: true } } },
			})
			: Promise.resolve([]),
		sectionIds.length > 0
			? client.sectionMirror.findMany({
				where: { schoolId, schoolYearId, externalId: { in: sectionIds } },
				select: {
					id: true, externalId: true, name: true, gradeLevelId: true, gradeLevelName: true,
					programType: true, programCode: true, programName: true,
				},
			})
			: Promise.resolve([]),
		cohortCodes.length > 0
			? client.instructionalCohort.findMany({
				where: { schoolId, schoolYearId, isActive: true, cohortCode: { in: cohortCodes } },
				select: { cohortCode: true, specializationCode: true, specializationName: true },
			})
			: Promise.resolve([]),
		sectionIds.length > 0 && subjectIds.length > 0
			? client.subjectSectionOwnership.findMany({
				where: {
					schoolId,
					schoolYearId,
					sectionId: { in: sectionIds },
					subjectId: { in: subjectIds },
					OR: [{ specializationCode: { not: null } }, { specializationLabel: { not: null } }],
				},
				select: { subjectId: true, sectionId: true, specializationCode: true, specializationLabel: true },
			})
			: Promise.resolve([]),
		client.schedulingPolicy.findUnique({ where: { schoolId_schoolYearId: { schoolId, schoolYearId } } }),
		client.policySpecialEvent.findMany({
			where: { schoolId, schoolYearId, enabled: true },
			orderBy: [{ sortOrder: 'asc' }, { eventType: 'asc' }],
		}),
		typeof (client as { classProgramSlot?: { findMany?: unknown } }).classProgramSlot?.findMany === 'function'
			? (client as unknown as { classProgramSlot: { findMany: (args: unknown) => Promise<Array<Record<string, unknown>>> } })
				.classProgramSlot.findMany({ where: { schoolId, schoolYearId, isActive: true } })
			: Promise.resolve([]),
	]);

	const frozenSpecialEvents: FrozenSpecialEvent[] = specialEventRows
		.filter((row) => !isRejectedFlagCeremonyRow(row.eventType, null, row.label))
		.map((row, index) => ({
			eventType: row.eventType,
			label: row.label,
			gradeGroup: row.gradeGroup,
			programType: row.programType,
			startTime: row.startTime,
			endTime: row.endTime,
			sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : index,
			dayOfWeek: resolveSpecialEventDayOfWeek(row.eventType, null, row.label) ?? null,
		}));

	const policyProjection: Record<string, unknown> = isRecord(policy)
		? {
			periodLengthMinutes: policy.periodLengthMinutes,
			periodsPerDay: policy.periodsPerDay,
			earliestStartTime: policy.earliestStartTime,
			latestEndTime: policy.latestEndTime,
			lunchStartTime: policy.lunchStartTime,
			lunchEndTime: policy.lunchEndTime,
			enforceLunchWindow: policy.enforceLunchWindow,
			enableLunchWindow: policy.enableLunchWindow,
			enableFlagCeremony: policy.enableFlagCeremony,
			flagCeremonyStartTime: policy.flagCeremonyStartTime,
			flagCeremonyEndTime: policy.flagCeremonyEndTime,
			enableRecess: policy.enableRecess,
			recessStartTime: policy.recessStartTime,
			recessEndTime: policy.recessEndTime,
			maxConsecutiveTeachingMinutesBeforeBreak: policy.maxConsecutiveTeachingMinutesBeforeBreak,
			minBreakMinutesAfterConsecutiveBlock: policy.minBreakMinutesAfterConsecutiveBlock,
			maxTeachingMinutesPerDay: policy.maxTeachingMinutesPerDay,
			showSpecialEventsInGrid: policy.showSpecialEventsInGrid,
			advisoryCreditMinutes: policy.advisoryCreditMinutes,
			teachingStandardMinutes: policy.teachingStandardMinutes,
		}
		: {};

	const displaySlots = freezeDisplaySlots(args.summaryDisplaySlots, policyProjection, frozenSpecialEvents);

	const buildings: Record<string, { name: string }> = {};
	const roomsFrozen: PublishedIdentitySnapshot['rooms'] = {};
	for (const room of rooms) {
		const buildingId = room.building?.id ?? null;
		if (buildingId != null) buildings[String(buildingId)] = { name: room.building.name };
		roomsFrozen[String(room.id)] = {
			name: room.name,
			type: room.type,
			floor: room.floor != null ? String(room.floor) : null,
			buildingId,
			buildingName: room.building?.name ?? null,
		};
	}

	const sectionsFrozen: PublishedIdentitySnapshot['sections'] = {};
	for (const section of sectionMirrors) {
		sectionsFrozen[String(section.externalId)] = {
			atlasId: section.id,
			externalId: `EXT_${section.externalId}`,
			name: section.name,
			gradeLevelId: section.gradeLevelId,
			gradeLevelName: section.gradeLevelName,
			programType: section.programType,
			programCode: section.programCode,
			programName: section.programName,
		};
	}

	const cohortsFrozen: PublishedIdentitySnapshot['cohorts'] = {};
	for (const cohort of cohorts) {
		cohortsFrozen[cohort.cohortCode] = {
			cohortCode: cohort.cohortCode,
			name: cohort.specializationName,
			specializationCode: cohort.specializationCode,
			specializationName: cohort.specializationName,
		};
	}

	const specializationsFrozen: PublishedIdentitySnapshot['specializations'] = {};
	for (const row of ownershipRows) {
		const key = `${row.subjectId}:${row.sectionId}`;
		if (specializationsFrozen[key]) continue;
		specializationsFrozen[key] = {
			code: row.specializationCode ?? '',
			label: row.specializationLabel ?? null,
		};
	}

	// Adviser identity is part of every class-program / teacher-program output;
	// freeze it from the same snapshot read rather than rehydrating it live.
	const advisers: PublishedIdentitySnapshot['advisers'] = {};
	for (const member of faculty) {
		if (member.advisedSectionId == null) continue;
		advisers[String(member.advisedSectionId)] = {
			sectionId: member.advisedSectionId,
			lastName: member.lastName,
			fullName: [member.lastName, member.firstName].filter(Boolean).join(', '),
		};
	}

	const snapshot: PublishedIdentitySnapshot = {
		schemaVersion: PUBLISHED_IDENTITY_SNAPSHOT_SCHEMA_VERSION,
		capturedAt: args.capturedAt,
		inputFingerprint: args.inputFingerprint,
		orderedTermContract: {
			format: contract.format,
			terms: contract.terms.map((term) => ({ identity: term.identity, displayLabel: term.displayLabel, order: term.order })),
			activeTermOrder: contract.activeTermOrder,
		},
		subjects: Object.fromEntries(subjects.map((subject) => [String(subject.id), { code: subject.code, name: subject.name }])),
		faculty: Object.fromEntries(faculty.map((member) => [String(member.id), {
			externalId: member.externalId != null ? String(member.externalId) : null,
			employeeId: member.employeeId ?? null,
			displayName: [member.lastName, member.firstName].filter(Boolean).join(', '),
			firstName: member.firstName,
			lastName: member.lastName,
			isPlaceholder: member.isPlaceholder,
			advisedSectionId: member.advisedSectionId ?? null,
		}])),
		sections: sectionsFrozen,
		buildings,
		rooms: roomsFrozen,
		specializations: specializationsFrozen,
		cohorts: cohortsFrozen,
		advisers,
		displaySlots,
		specialEvents: frozenSpecialEvents,
		policy: policyProjection,
		classProgramSlots: classProgramSlotRows.map((row) => ({
			id: Number(row.id ?? 0),
			gradeLevel: Number(row.gradeLevel ?? 0),
			programType: row.programType != null ? String(row.programType) : null,
			dayOfWeek: row.dayOfWeek != null ? String(row.dayOfWeek) : null,
			startTime: String(row.startTime ?? ''),
			endTime: String(row.endTime ?? ''),
			rowKind: String(row.rowKind ?? 'CLASS'),
			subjectFamily: row.subjectFamily != null ? String(row.subjectFamily) : null,
			subjectLabel: row.subjectLabel != null ? String(row.subjectLabel) : null,
			sourceLabel: String(row.sourceLabel ?? ''),
			sourceNote: row.sourceNote != null ? String(row.sourceNote) : null,
		})),
	};

	assertSnapshotConsistency(snapshot);
	return snapshot;
}

/**
 * Freeze the display-slot list from one consistent source. When the run
 * persisted canonical display slots they are authoritative; otherwise the
 * configured policy special events produce the same bands the live read path
 * would derive.
 */
function freezeDisplaySlots(
	summaryDisplaySlots: DisplaySlotSource[] | undefined,
	policy: Record<string, unknown>,
	specialEvents: FrozenSpecialEvent[],
): FrozenDisplaySlot[] {
	const persisted = Array.isArray(summaryDisplaySlots) ? summaryDisplaySlots : [];
	if (persisted.length > 0) {
		return persisted.map((slot, index) => ({
			key: `${slot.startTime}-${slot.endTime}`,
			label: slot.eventName ?? `${slot.startTime}-${slot.endTime}`,
			startTime: slot.startTime,
			endTime: slot.endTime,
			order: index,
			kind: slot.isSpecialEvent ? 'SPECIAL_EVENT' : 'PERIOD',
			dayOfWeek: (slot.dayOfWeek ?? '').trim().toUpperCase() || null,
		}));
	}

	const derived = buildSpecialEventSlots({
		maxConsecutiveTeachingMinutesBeforeBreak: Number(policy.maxConsecutiveTeachingMinutesBeforeBreak ?? 120),
		minBreakMinutesAfterConsecutiveBlock: Number(policy.minBreakMinutesAfterConsecutiveBlock ?? 15),
		maxTeachingMinutesPerDay: Number(policy.maxTeachingMinutesPerDay ?? 400),
		earliestStartTime: String(policy.earliestStartTime ?? '07:00'),
		latestEndTime: String(policy.latestEndTime ?? '18:30'),
		lunchStartTime: policy.lunchStartTime != null ? String(policy.lunchStartTime) : undefined,
		lunchEndTime: policy.lunchEndTime != null ? String(policy.lunchEndTime) : undefined,
		enforceLunchWindow: policy.enforceLunchWindow != null ? Boolean(policy.enforceLunchWindow) : undefined,
		enableLunchWindow: policy.enableLunchWindow != null ? Boolean(policy.enableLunchWindow) : undefined,
		enableFlagCeremony: policy.enableFlagCeremony != null ? Boolean(policy.enableFlagCeremony) : undefined,
		flagCeremonyStartTime: policy.flagCeremonyStartTime != null ? String(policy.flagCeremonyStartTime) : undefined,
		flagCeremonyEndTime: policy.flagCeremonyEndTime != null ? String(policy.flagCeremonyEndTime) : undefined,
		enableRecess: policy.enableRecess != null ? Boolean(policy.enableRecess) : undefined,
		recessStartTime: policy.recessStartTime != null ? String(policy.recessStartTime) : undefined,
		recessEndTime: policy.recessEndTime != null ? String(policy.recessEndTime) : undefined,
		specialEvents: specialEvents.map((event) => ({
			eventType: event.eventType,
			label: event.label,
			startTime: event.startTime,
			endTime: event.endTime,
			dayOfWeek: event.dayOfWeek,
			gradeGroup: event.gradeGroup,
			programType: event.programType,
		})),
	});

	return derived
		.map((slot, index) => ({
			key: `${slot.startTime}-${slot.endTime}`,
			label: slot.eventName ?? `${slot.startTime}-${slot.endTime}`,
			startTime: slot.startTime,
			endTime: slot.endTime,
			order: index,
			kind: 'SPECIAL_EVENT' as const,
			dayOfWeek: (slot.dayOfWeek ?? '').trim().toUpperCase() || null,
		}))
		.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime) || (a.order - b.order));
}

/**
 * Deterministic identity of a frozen snapshot's capture source. Used by the
 * decisive controls to compare the pre-mutation and post-mutation artifact.
 */
export function snapshotDigest(snapshot: PublishedIdentitySnapshot): string {
	return JSON.stringify({
		orderedTermContract: snapshot.orderedTermContract,
		displaySlots: snapshot.displaySlots,
		specialEvents: snapshot.specialEvents,
		policy: snapshot.policy,
	});
}

// ─── Frozen canonical class-program slots ───

/**
 * Resolve the canonical class-program rows for a grade from the FROZEN template
 * set with the same semantics as the live resolver. `sourceNote` is normalised
 * so the frozen row satisfies `ClassProgramSlotRow` structurally.
 */
export function frozenCanonicalSlots(
	snapshot: PublishedIdentitySnapshot,
	gradeLevel: number,
	programTypes: Array<string | null | undefined> = [],
): ResolvedSlotRow[] {
	const rows: ClassProgramSlotRow[] = (snapshot.classProgramSlots ?? []).map((slot) => ({
		id: slot.id,
		schoolId: 0,
		schoolYearId: 0,
		gradeLevel: slot.gradeLevel,
		programType: (slot.programType ?? null) as ClassProgramSlotRow['programType'],
		dayOfWeek: slot.dayOfWeek,
		startTime: slot.startTime,
		endTime: slot.endTime,
		rowKind: slot.rowKind as ClassProgramSlotRow['rowKind'],
		subjectFamily: slot.subjectFamily,
		subjectLabel: slot.subjectLabel,
		sourceLabel: slot.sourceLabel,
		sourceNote: slot.sourceNote,
		isActive: true,
	}));
	return resolveCanonicalSlotsFromRows(rows, gradeLevel, programTypes as never[]);
}
