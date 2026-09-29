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
import type { RoomOption } from '@/components/sections/SectionRoomPicker';
import type {
	DayOfWeek,
	DraftReport,
	FacultyAvailabilityRecord,
	FacultyAvailabilitySlot,
	FacultyAvailabilityState,
	FacultyConcernReviewDecision,
	FacultyMirror,
	FacultyRoomPreferenceState,
	GenerationInputComparison,
	RoomPreferencePreviewResponse,
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

/* ════════════════════════════════════════════════════════════════════════════
 * ROOMS — A3 c13.
 *
 * Every call below is an EXISTING, already-authorised server route. No route is
 * added by this stream, and every write carries the same session auth and the
 * actor's own school/year scope the rest of this page uses.
 *
 *   GET    /room-preferences/{school}/{year}/latest/faculty/{facultyId}
 *          → the whole room state for the ACTIVE DRAFT: every class the teacher
 *            holds (class name, subject, day, times), the room the generator
 *            already gave it, and any request that already exists. ONE read
 *            drives the whole Rooms section, so a pending portal request lands
 *            on the teacher's form instead of being lost in a separate queue.
 *   PUT    …/runs/{runId}/faculty/{facultyId}/entries/{entryId}/draft
 *   POST   …/entries/{entryId}/submit
 *          → record / advance the request. `assertFacultyOwnerOrOfficer` lets an
 *            admin, officer or SYSTEM_ADMIN do this for ANY teacher, which is
 *            what makes a scheduler-authored room need possible at all.
 *   POST   …/runs/{runId}/requests/{requestId}/preview
 *          → ZERO-WRITE. The plain-words line on screen is this response.
 *   PATCH  …/requests/{requestId}/review  { decisionStatus: 'APPROVED' }
 *          → THE APPLY. It commits a manual edit that moves the class to the
 *            requested room in the current draft. Guarded by
 *            PRIVILEGED_ROLES on the server.
 *
 * `NO_ACTIVE_DRAFT` means there is no timetable to attach a room to. That is
 * reported as `null` and the page says so plainly rather than inventing a
 * control that could not work.
 * ═══════════════════════════════════════════════════════════════════════════ */

export type ConcernRoomScope = {
	schoolId: number;
	schoolYearId: number;
	facultyId: number;
};

export function buildConcernRoomStatePath(schoolId: unknown, schoolYearId: unknown, facultyId: unknown): string {
	return `/room-preferences/${assertConcernScopeId(schoolId, 'schoolId')}/${assertConcernScopeId(schoolYearId, 'schoolYearId')}/latest/faculty/${assertConcernScopeId(facultyId, 'facultyId')}`;
}

export function buildConcernRoomRunPath(scope: ConcernRoomScope, runId: unknown, suffix: string): string {
	const base = `/room-preferences/${assertConcernScopeId(scope.schoolId, 'schoolId')}/${assertConcernScopeId(scope.schoolYearId, 'schoolYearId')}/runs/${assertConcernScopeId(runId, 'runId')}`;
	return `${base}${suffix}`;
}

/** The typed error code the server answered with, when there is one. */
export function concernApiErrorCode(error: unknown): string | null {
	const data = (error as { response?: { data?: { code?: unknown } } })?.response?.data;
	return typeof data?.code === 'string' ? data.code : null;
}

/**
 * The teacher's room state on the active draft, or `null` when no timetable has
 * been built yet (the server answers `NO_ACTIVE_DRAFT`). Any other failure
 * propagates, so a real outage is never rendered as "no timetable".
 */
export async function fetchConcernRoomState(
	scope: ConcernRoomScope,
	transport?: ConcernTransport,
): Promise<FacultyRoomPreferenceState | null> {
	const url = buildConcernRoomStatePath(scope.schoolId, scope.schoolYearId, scope.facultyId);
	try {
		const { data } = await resolveTransport(transport).get<FacultyRoomPreferenceState>(url);
		return data ?? null;
	} catch (error) {
		if (concernApiErrorCode(error) === 'NO_ACTIVE_DRAFT') return null;
		throw error;
	}
}

/**
 * The room list for the picker — the SAME `RoomOption[]` the Sections room
 * picker consumes, from the same read, so the control is identical on both
 * pages rather than a local variant.
 */
export async function fetchConcernRoomOptions(
	schoolId: unknown,
	schoolYearId: unknown,
	transport?: ConcernTransport,
): Promise<RoomOption[]> {
	const scopedSchoolId = assertConcernScopeId(schoolId, 'schoolId');
	const scopedYearId = assertConcernScopeId(schoolYearId, 'schoolYearId');
	const { data } = await resolveTransport(transport).get<{ rooms?: RoomOption[] }>(
		`/sections/home-rooms/${scopedYearId}`,
		{ params: { schoolId: scopedSchoolId } },
	);
	return Array.isArray(data?.rooms) ? data.rooms : [];
}

export type ConcernRoomDraftInput = ConcernRoomScope & {
	runId: number;
	entryId: string;
	requestedRoomId: number;
	rationale: string | null;
	/** CAS on the draft run; a stale value is refused before any write. */
	expectedRunVersion: number;
	/** CAS on the request itself, when one already exists for this class. */
	requestVersion: number | null;
};

function concernRoomDraftBody(input: ConcernRoomDraftInput) {
	return {
		requestedRoomId: assertConcernScopeId(input.requestedRoomId, 'requestedRoomId'),
		rationale: input.rationale ?? null,
		expectedRunVersion: assertConcernScopeId(input.expectedRunVersion, 'expectedRunVersion'),
		...(input.requestVersion == null ? {} : { requestVersion: assertConcernScopeId(input.requestVersion, 'requestVersion') }),
	};
}

/** PUT the room need for one class. Zero side effects beyond the request row. */
export async function saveConcernRoomDraft(
	input: ConcernRoomDraftInput,
	transport?: ConcernTransport,
): Promise<FacultyRoomPreferenceState> {
	const url = buildConcernRoomRunPath(
		input,
		input.runId,
		`/faculty/${assertConcernScopeId(input.facultyId, 'facultyId')}/entries/${encodeURIComponent(input.entryId)}/draft`,
	);
	const { data } = await resolveTransport(transport).put<FacultyRoomPreferenceState>(url, concernRoomDraftBody(input));
	return data;
}

/** POST the same request as submitted — the state the review endpoint requires. */
export async function submitConcernRoom(
	input: ConcernRoomDraftInput,
	transport?: ConcernTransport,
): Promise<FacultyRoomPreferenceState> {
	const url = buildConcernRoomRunPath(
		input,
		input.runId,
		`/faculty/${assertConcernScopeId(input.facultyId, 'facultyId')}/entries/${encodeURIComponent(input.entryId)}/submit`,
	);
	const { data } = await resolveTransport(transport).post<FacultyRoomPreferenceState>(url, concernRoomDraftBody(input));
	return data;
}

/** ZERO-WRITE preview. This is what the plain-words line on screen is built from. */
export async function previewConcernRoomRequest(
	scope: ConcernRoomScope,
	runId: unknown,
	requestId: unknown,
	transport?: ConcernTransport,
): Promise<RoomPreferencePreviewResponse> {
	const url = buildConcernRoomRunPath(
		scope,
		runId,
		`/requests/${assertConcernScopeId(requestId, 'requestId')}/preview`,
	);
	const { data } = await resolveTransport(transport).post<RoomPreferencePreviewResponse>(url);
	return data;
}

/**
 * THE APPLY. `APPROVED` is the only decision that commits: the server runs a
 * manual edit that moves the class into the requested room in the current
 * draft. `expectedRunVersion` is mandatory and a stale one is refused, so two
 * schedulers cannot both move against one draft.
 */
export async function applyConcernRoomRequest(
	input: ConcernRoomScope & {
		runId: number;
		requestId: number;
		expectedRunVersion: number;
		requestVersion: number;
		reviewerNotes?: string | null;
		allowSoftOverride?: boolean;
	},
	transport?: ConcernTransport,
): Promise<unknown> {
	const url = buildConcernRoomRunPath(input, input.runId, `/requests/${assertConcernScopeId(input.requestId, 'requestId')}/review`);
	const { data } = await resolveTransport(transport).patch(url, {
		decisionStatus: 'APPROVED',
		reviewerNotes: input.reviewerNotes ?? null,
		expectedRunVersion: assertConcernScopeId(input.expectedRunVersion, 'expectedRunVersion'),
		requestVersion: assertConcernScopeId(input.requestVersion, 'requestVersion'),
		allowSoftOverride: !!input.allowSoftOverride,
	});
	return data;
}

/* ── Availability: ONE save that actually binds ───────────────────────────
 *
 * Verified in the server, not assumed: `getReviewedAvailability` reads
 * `status: 'REVIEWED'` ONLY (faculty-availability.service.ts:345), so an
 * availability left as a draft or submitted is NOT read by generation. A page
 * that offered only "Save draft" would therefore be a false errand — the
 * scheduler marks a teacher unavailable, presses Save, and nothing changes.
 *
 * So the single Save carries the record through save → submit → review, which
 * is exactly what the old two-button ceremony did with the SAME person
 * pressing both (the review PATCH takes `timetable:edit` and derives the
 * reviewer from the session — self-review was already the norm here, not a new
 * authority). The buttons disappear; the three steps do not.
 *
 * If the review is refused the server has still SAVED the record, and the
 * returned failure is surfaced verbatim rather than swallowed — an infeasible
 * availability is a real answer about the teacher's load, not an error to hide.
 */
export type SaveAndBindResult = {
	availability: FacultyAvailabilityRecord;
	/** The record is saved; generation will not read it until it can bind. */
	bindFailure: string | null;
};

export async function saveAndBindAvailability(
	input: SaveAvailabilityDraftInput,
	transport?: ConcernTransport,
): Promise<SaveAndBindResult> {
	const api = resolveTransport(transport);
	const saved = await saveFacultyAvailabilityDraft(input, api);
	try {
		const submitted = await submitFacultyAvailability(
			{ schoolId: input.schoolId, schoolYearId: input.schoolYearId, facultyId: input.facultyId, version: saved.version, slots: input.slots, notes: input.notes ?? null },
			api,
		);
		const reviewed = await reviewFacultyAvailability(
			{
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				facultyId: input.facultyId,
				version: submitted.version,
				decision: 'REVIEWED',
				reviewerNotes: null,
			},
			api,
		);
		return { availability: reviewed, bindFailure: null };
	} catch (error) {
		return { availability: saved, bindFailure: concernApiErrorMessage(error) };
	}
}

/** The server's own human message, so a refusal is never paraphrased into jargon. */
export function concernApiErrorMessage(error: unknown): string {
	const data = (error as { response?: { data?: { message?: unknown } } })?.response?.data;
	if (typeof data?.message === 'string' && data.message.trim()) return data.message;
	return error instanceof Error && error.message ? error.message : 'The change was not saved.';
}
