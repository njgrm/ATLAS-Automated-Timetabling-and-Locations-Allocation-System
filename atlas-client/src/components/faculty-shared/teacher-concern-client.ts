/**
 * S2 — scheduler concern workspace client for the S1 availability authority.
 *
 * Thin, typed projections of the frozen `faculty-availability` routes plus the
 * read-only latest-run freshness read. Everything is actor-school scoped and
 * fails closed: a missing/non-positive school, year, faculty, or term index
 * throws BEFORE any dispatch — there is no `?? 1` default anywhere.
 *
 * The transport is injectable so the focused tests exercise these exact
 * functions (URL, method, payload, null handling) instead of re-implementing
 * them in a fixture.
 */
import atlasApi from '@/lib/api';
import { resolveTimetableRunPath } from '@/lib/timetable-data/timetableDataSources';
import type {
	DayOfWeek,
	DraftReport,
	FacultyAvailabilityRecord,
	FacultyAvailabilitySlot,
	FacultyAvailabilityState,
	FacultyConcernReviewDecision,
	FacultyMirror,
	GenerationInputComparison,
} from '@/types';

export class TeacherConcernScopeError extends Error {
	readonly code = 'TEACHER_CONCERN_SCOPE';

	constructor(message: string) {
		super(message);
		this.name = 'TeacherConcernScopeError';
	}
}

export function assertConcernScopeId(value: unknown, name: string): number {
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new TeacherConcernScopeError(`${name} must be a positive integer; the actor scope is unresolved.`);
	}
	return parsed;
}

export type ConcernScope = {
	schoolId: number;
	schoolYearId: number;
	facultyId: number;
};

/** Exact frozen S1 read/write path. Throws before returning when scope is invalid. */
export function buildFacultyAvailabilityPath(schoolId: unknown, schoolYearId: unknown, facultyId: unknown): string {
	return `/faculty-availability/${assertConcernScopeId(schoolId, 'schoolId')}/${assertConcernScopeId(schoolYearId, 'schoolYearId')}/faculty/${assertConcernScopeId(facultyId, 'facultyId')}`;
}

export type SaveAvailabilityDraftInput = ConcernScope & {
	termIndex: number;
	slots: FacultyAvailabilitySlot[];
	notes: string | null;
	version: number | null;
};

export type SubmitAvailabilityInput = ConcernScope & {
	version: number;
	slots: FacultyAvailabilitySlot[];
	notes: string | null;
};

export type ReviewAvailabilityInput = ConcernScope & {
	version: number;
	decision: FacultyConcernReviewDecision;
	reviewerNotes: string | null;
};

/**
 * Minimal axios-like surface. The production default is the shared `atlasApi`
 * (token-injected); tests pass a recording fake.
 */
export type ConcernTransport = {
	get: <T = unknown>(url: string, config?: { params?: Record<string, unknown> }) => Promise<{ data: T }>;
	put: <T = unknown>(url: string, data?: unknown) => Promise<{ data: T }>;
	post: <T = unknown>(url: string, data?: unknown) => Promise<{ data: T }>;
	patch: <T = unknown>(url: string, data?: unknown) => Promise<{ data: T }>;
};

function resolveTransport(transport?: ConcernTransport): ConcernTransport {
	return transport ?? (atlasApi as unknown as ConcernTransport);
}

/** GET the active-term authority for one teacher. `null` when none exists yet. */
export async function fetchFacultyAvailability(
	scope: ConcernScope,
	transport?: ConcernTransport,
): Promise<FacultyAvailabilityRecord | null> {
	const url = buildFacultyAvailabilityPath(scope.schoolId, scope.schoolYearId, scope.facultyId);
	const { data } = await resolveTransport(transport).get<{ availability: FacultyAvailabilityRecord | null }>(url);
	return data?.availability ?? null;
}

/** GET the actor-school teacher roster for the concern picker. */
export async function fetchConcernFaculty(
	schoolId: unknown,
	transport?: ConcernTransport,
): Promise<FacultyMirror[]> {
	const scopedSchoolId = assertConcernScopeId(schoolId, 'schoolId');
	const { data } = await resolveTransport(transport).get<{ faculty: FacultyMirror[] }>('/faculty', {
		params: { schoolId: scopedSchoolId },
	});
	return Array.isArray(data?.faculty) ? data.faculty : [];
}

/** PUT a draft for the explicit active ordered term (never a defaulted term). */
export async function saveFacultyAvailabilityDraft(
	input: SaveAvailabilityDraftInput,
	transport?: ConcernTransport,
): Promise<FacultyAvailabilityRecord> {
	const url = buildFacultyAvailabilityPath(input.schoolId, input.schoolYearId, input.facultyId);
	const { data } = await resolveTransport(transport).put<{ availability: FacultyAvailabilityRecord }>(url, {
		termIndex: assertConcernScopeId(input.termIndex, 'termIndex'),
		slots: input.slots,
		notes: input.notes ?? null,
		version: input.version ?? null,
	});
	return data.availability;
}

/** POST the active-term draft for review. */
export async function submitFacultyAvailability(
	input: SubmitAvailabilityInput,
	transport?: ConcernTransport,
): Promise<FacultyAvailabilityRecord> {
	const url = `${buildFacultyAvailabilityPath(input.schoolId, input.schoolYearId, input.facultyId)}/submit`;
	const { data } = await resolveTransport(transport).post<{ availability: FacultyAvailabilityRecord }>(url, {
		version: assertConcernScopeId(input.version, 'version'),
		slots: input.slots,
		notes: input.notes ?? null,
	});
	return data.availability;
}

/** PATCH the reviewer decision (the server derives `reviewedBy` from the session). */
export async function reviewFacultyAvailability(
	input: ReviewAvailabilityInput,
	transport?: ConcernTransport,
): Promise<FacultyAvailabilityRecord> {
	const url = `${buildFacultyAvailabilityPath(input.schoolId, input.schoolYearId, input.facultyId)}/review`;
	const { data } = await resolveTransport(transport).patch<{ availability: FacultyAvailabilityRecord }>(url, {
		version: assertConcernScopeId(input.version, 'version'),
		decision: input.decision,
		reviewerNotes: input.reviewerNotes ?? null,
	});
	return data.availability;
}

/**
 * READ-ONLY latest-run freshness. Returns the run's `inputState` (the same
 * comparison the shared `describeRunInputDrift` consumes) or `null` when no
 * generated run exists yet. This never writes.
 */
export async function fetchLatestRunInputState(
	schoolId: unknown,
	schoolYearId: unknown,
	transport?: ConcernTransport,
): Promise<GenerationInputComparison | null> {
	const path = resolveTimetableRunPath(
		assertConcernScopeId(schoolId, 'schoolId'),
		assertConcernScopeId(schoolYearId, 'schoolYearId'),
		'latest',
	);
	const { data } = await resolveTransport(transport).get<DraftReport>(`${path}/draft`);
	return data?.inputState ?? null;
}

/** Availability states are the frozen S1 slot states; the picker shares the union. */
export type AvailabilityPickerSlot = {
	day: DayOfWeek;
	startTime: string;
	endTime: string;
	preference: FacultyAvailabilityState;
};

export function availabilityRecordToPickerSlots(record: FacultyAvailabilityRecord | null | undefined): AvailabilityPickerSlot[] {
	return (record?.slots ?? []).map((slot) => ({
		day: slot.day,
		startTime: slot.startTime,
		endTime: slot.endTime,
		preference: slot.state,
	}));
}

export function pickerSlotsToAvailability(slots: AvailabilityPickerSlot[]): FacultyAvailabilitySlot[] {
	return slots.map((slot) => ({
		day: slot.day,
		startTime: slot.startTime,
		endTime: slot.endTime,
		state: slot.preference,
	}));
}
