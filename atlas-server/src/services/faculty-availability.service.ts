/**
 * TEACHER-AVAILABILITY-AUTHORITY-C01 (decisions D1/D2).
 *
 * A term-scoped, reviewed, versioned teacher-availability authority that is the
 * SINGLE generation source for a teacher's `UNAVAILABLE` (HARD exclusion) and
 * `PREFERRED` (ranked SOFT) signals. It replaces the legacy
 * `FacultyPreference`/`PreferenceTimeSlot` generation read; the legacy write
 * path is deprecated but deliberately NOT removed (the
 * `ATLAS_ENABLE_LEGACY_TIME_PREFERENCES` flag is never flipped).
 *
 * Contract:
 *  - Only `status = REVIEWED` authorities bind generation.
 *  - Only the exact persisted active ordered term binds; an unresolved term
 *    fails closed (`TERM_AUTHORITY_UNRESOLVED`) and is NEVER defaulted to Term 1.
 *  - A review that makes the teacher's required load infeasible is rejected with
 *    a typed 4xx and ZERO writes.
 *  - Every write is actor-school/term scoped and version-checked.
 *
 * Business logic only; no transport concerns. New-model access is expressed
 * through a narrow structural client type so the module does not depend on a
 * freshly generated Prisma client for type-checking.
 */

import { getDataContext } from '../lib/data-context.js';
import { loadVerifiedOrderedTermContract, type LoadedAcademicTermContract } from './academic-term.service.js';

// ─── Vocabulary ───

export type AvailabilityState = 'PREFERRED' | 'AVAILABLE' | 'UNAVAILABLE';
export type AvailabilityStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'REJECTED';
export type AvailabilityReviewDecision = 'REVIEWED' | 'REJECTED';

export const AVAILABILITY_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
export type AvailabilityDay = (typeof AVAILABILITY_DAYS)[number];
const VALID_DAYS = new Set<string>(AVAILABILITY_DAYS);
const VALID_STATES = new Set<AvailabilityState>(['PREFERRED', 'AVAILABLE', 'UNAVAILABLE']);
const VALID_REVIEW_DECISIONS = new Set<AvailabilityReviewDecision>(['REVIEWED', 'REJECTED']);

export const MAX_AVAILABILITY_TERM_INDEX = 4;

/** Weekly teaching capacity fallback when no scheduling policy row exists yet. */
export const DEFAULT_AVAILABILITY_PERIODS_PER_DAY = 8;
export const DEFAULT_AVAILABILITY_PERIOD_LENGTH_MINUTES = 45;

export interface AvailabilitySlotInput {
	day: AvailabilityDay;
	startTime: string;
	endTime: string;
	state: AvailabilityState;
}

export interface FacultyAvailabilityRecord {
	id: number;
	schoolId: number;
	schoolYearId: number;
	facultyId: number;
	termIndex: number;
	status: AvailabilityStatus;
	version: number;
	notes: string | null;
	submittedAt: Date | null;
	reviewedBy: number | null;
	reviewedAt: Date | null;
	reviewerNotes: string | null;
	slots: AvailabilitySlotInput[];
}

export class FacultyAvailabilityError extends Error {
	readonly statusCode: number;
	readonly code: string;

	constructor(code: string, message: string, statusCode: number) {
		super(message);
		this.name = 'FacultyAvailabilityError';
		this.code = code;
		this.statusCode = statusCode;
	}
}

function err(statusCode: number, code: string, message: string): FacultyAvailabilityError {
	return new FacultyAvailabilityError(code, message, statusCode);
}

// ─── Injected client surface (structural; no generated-model dependency) ───

type AvailabilityRow = {
	id: number;
	schoolId: number;
	schoolYearId: number;
	facultyId: number;
	termIndex: number;
	status: AvailabilityStatus;
	version: number;
	notes: string | null;
	submittedAt: Date | null;
	reviewedBy: number | null;
	reviewedAt: Date | null;
	reviewerNotes: string | null;
	slots?: Array<{ day: string; startTime: string; endTime: string; state: string }>;
};

export type FacultyAvailabilityClient = {
	enrollProSchoolYearMirror?: {
		findUnique: (args: unknown) => Promise<unknown>;
	};
	facultyMirror: {
		findFirst: (args: unknown) => Promise<{ id: number } | null>;
	};
	facultyAvailability: {
		findUnique: (args: unknown) => Promise<AvailabilityRow | null>;
		findMany: (args: unknown) => Promise<AvailabilityRow[]>;
		create: (args: unknown) => Promise<AvailabilityRow>;
		update: (args: unknown) => Promise<AvailabilityRow>;
	};
	facultyAvailabilitySlot: {
		deleteMany: (args: unknown) => Promise<unknown>;
		createMany: (args: unknown) => Promise<unknown>;
	};
	facultySubject?: {
		findMany: (args: unknown) => Promise<Array<{ subjectId: number }>>;
	};
	subject?: {
		findMany: (args: unknown) => Promise<Array<{ id: number; minMinutesPerWeek: number | null }>>;
	};
	schedulingPolicy?: {
		findUnique: (args: unknown) => Promise<{ periodsPerDay: number | null; periodLengthMinutes: number | null } | null>;
	};
	$transaction?: <T>(fn: (tx: FacultyAvailabilityClient) => Promise<T>) => Promise<T>;
};

function resolveClient(client?: unknown): FacultyAvailabilityClient {
	return (client ?? getDataContext()) as unknown as FacultyAvailabilityClient;
}

/**
 * Run `fn` inside a database transaction when the client supports one. Unit
 * seams that provide a fake client without `$transaction` still exercise the
 * exact same sequential code path.
 */
async function runTransaction<T>(db: FacultyAvailabilityClient, fn: (tx: FacultyAvailabilityClient) => Promise<T>): Promise<T> {
	if (typeof db.$transaction === 'function') return db.$transaction(fn);
	return fn(db);
}

// ─── Validation ───

function positiveInt(value: unknown, name: string): number {
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw err(400, 'INVALID_PARAM', `${name} must be a positive integer.`);
	}
	return parsed;
}

function assertTermIndexInRange(termIndex: unknown): number {
	const parsed = positiveInt(termIndex, 'termIndex');
	if (parsed > MAX_AVAILABILITY_TERM_INDEX) {
		throw err(400, 'INVALID_TERM_INDEX', `termIndex must be 1..${MAX_AVAILABILITY_TERM_INDEX}.`);
	}
	return parsed;
}

function isTime(value: unknown): value is string {
	return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
}

/**
 * Validate and canonicalise a caller-supplied painted slot set. Rejects a
 * malformed entry with a typed 400 (never a silent coercion) so no invalid
 * value reaches persistence.
 */
export function normalizeAvailabilitySlots(raw: unknown): AvailabilitySlotInput[] {
	if (raw === undefined || raw === null) return [];
	if (!Array.isArray(raw)) throw err(400, 'INVALID_SLOTS', 'slots must be an array.');
	const out: AvailabilitySlotInput[] = [];
	for (let index = 0; index < raw.length; index += 1) {
		const slot = raw[index];
		if (!slot || typeof slot !== 'object') throw err(400, 'INVALID_SLOTS', `slots[${index}] must be an object.`);
		const day = (slot as { day?: unknown }).day;
		const startTime = (slot as { startTime?: unknown }).startTime;
		const endTime = (slot as { endTime?: unknown }).endTime;
		const state = ((slot as { state?: unknown }).state ?? 'AVAILABLE') as unknown;
		if (typeof day !== 'string' || !VALID_DAYS.has(day)) {
			throw err(400, 'INVALID_SLOTS', `slots[${index}].day must be one of ${AVAILABILITY_DAYS.join(', ')}.`);
		}
		if (!isTime(startTime) || !isTime(endTime)) {
			throw err(400, 'INVALID_SLOTS', `slots[${index}] startTime/endTime must be HH:MM.`);
		}
		if (startTime >= endTime) {
			throw err(400, 'INVALID_SLOTS', `slots[${index}].startTime must be before endTime.`);
		}
		if (typeof state !== 'string' || !VALID_STATES.has(state as AvailabilityState)) {
			throw err(400, 'INVALID_SLOTS', `slots[${index}].state must be PREFERRED, AVAILABLE, or UNAVAILABLE.`);
		}
		out.push({ day: day as AvailabilityDay, startTime, endTime, state: state as AvailabilityState });
	}
	return out;
}

function toRecord(row: AvailabilityRow): FacultyAvailabilityRecord {
	return {
		id: row.id,
		schoolId: row.schoolId,
		schoolYearId: row.schoolYearId,
		facultyId: row.facultyId,
		termIndex: row.termIndex,
		status: row.status,
		version: row.version,
		notes: row.notes ?? null,
		submittedAt: row.submittedAt ?? null,
		reviewedBy: row.reviewedBy ?? null,
		reviewedAt: row.reviewedAt ?? null,
		reviewerNotes: row.reviewerNotes ?? null,
		slots: (row.slots ?? []).map((slot) => ({
			day: slot.day as AvailabilityDay,
			startTime: String(slot.startTime),
			endTime: String(slot.endTime),
			state: slot.state as AvailabilityState,
		})),
	};
}

const SLOT_SELECT = {
	select: { day: true, startTime: true, endTime: true, state: true },
	orderBy: [{ day: 'asc' as const }, { startTime: 'asc' as const }, { endTime: 'asc' as const }],
};

// ─── Term authority ───

/**
 * Resolve the persisted verified active ordered term. Fails closed with a typed
 * 409 when the contract is missing or the active term is unresolved — it NEVER
 * defaults to Term 1.
 */
export async function resolveActiveAvailabilityTermIndex(
	schoolId: number,
	schoolYearId: number,
	client?: unknown,
): Promise<{ termIndex: number; contract: LoadedAcademicTermContract }> {
	const db = resolveClient(client);
	const contract = await loadVerifiedOrderedTermContract(schoolId, schoolYearId, db as never);
	if (!contract) {
		throw err(409, 'TERM_AUTHORITY_UNRESOLVED', 'No verified ordered term contract is available for this school year, so availability cannot be scoped.');
	}
	if (contract.activeTermOrder == null) {
		throw err(409, 'TERM_AUTHORITY_UNRESOLVED', 'The active ordered term is unresolved, so availability cannot be scoped. Resolve the term authority and retry.');
	}
	return { termIndex: contract.activeTermOrder, contract };
}

async function assertFacultyInSchool(db: FacultyAvailabilityClient, schoolId: number, facultyId: number): Promise<void> {
	const faculty = await db.facultyMirror.findFirst({ where: { id: facultyId, schoolId }, select: { id: true } });
	if (!faculty) throw err(404, 'TEACHER_NOT_FOUND', 'Teacher not found in this school.');
}

// ─── Reads ───

export async function getFacultyAvailability(
	schoolId: number,
	schoolYearId: number,
	facultyId: number,
	client?: unknown,
): Promise<FacultyAvailabilityRecord | null> {
	const db = resolveClient(client);
	const { termIndex } = await resolveActiveAvailabilityTermIndex(schoolId, schoolYearId, db);
	const row = await db.facultyAvailability.findUnique({
		where: { schoolId_schoolYearId_facultyId_termIndex: { schoolId, schoolYearId, facultyId, termIndex } },
		include: { slots: SLOT_SELECT },
	});
	return row ? toRecord(row) : null;
}

/**
 * Generation read. Returns the reviewed authorities for the persisted active
 * ordered term, already normalised into the canonical constructor preference
 * shape (`state` → `preference`). When the term authority is unresolved the
 * result is `ok: false` with ZERO rows — generation must fail closed upstream.
 */
export interface ReviewedAvailabilityRead {
	ok: boolean;
	code: 'READY' | 'TERM_AUTHORITY_UNRESOLVED';
	termIndex: number | null;
	preferences: Array<{
		facultyId: number;
		status: 'SUBMITTED';
		timeSlots: Array<{ day: string; startTime: string; endTime: string; preference: string }>;
	}>;
}

export async function loadReviewedAvailabilityForActiveTerm(
	schoolId: number,
	schoolYearId: number,
	client?: unknown,
): Promise<ReviewedAvailabilityRead> {
	const db = resolveClient(client);
	const contract = await loadVerifiedOrderedTermContract(schoolId, schoolYearId, db as never);
	return loadReviewedAvailabilityForTerm(schoolId, schoolYearId, contract?.activeTermOrder ?? null, db);
}

/**
 * Generation read for an explicit, already-verified active ordered term. `null`
 * means the term authority is unresolved and returns zero rows — generation must
 * fail closed upstream and must never assume Term 1.
 */
export async function loadReviewedAvailabilityForTerm(
	schoolId: number,
	schoolYearId: number,
	termIndex: number | null,
	client?: unknown,
): Promise<ReviewedAvailabilityRead> {
	const db = resolveClient(client);
	if (termIndex == null || !Number.isInteger(termIndex) || termIndex < 1) {
		return { ok: false, code: 'TERM_AUTHORITY_UNRESOLVED', termIndex: null, preferences: [] };
	}
	const rows = await db.facultyAvailability.findMany({
		where: { schoolId, schoolYearId, termIndex, status: 'REVIEWED' },
		include: { slots: SLOT_SELECT },
		orderBy: { facultyId: 'asc' },
	});
	return {
		ok: true,
		code: 'READY',
		termIndex,
		preferences: rows.map((row) => ({
			facultyId: row.facultyId,
			status: 'SUBMITTED' as const,
			timeSlots: (row.slots ?? []).map((slot) => ({
				day: String(slot.day),
				startTime: String(slot.startTime),
				endTime: String(slot.endTime),
				preference: String(slot.state),
			})),
		})),
	};
}

// ─── Feasibility (review gate) ───

export interface AvailabilityFeasibility {
	feasible: boolean;
	requiredMinutes: number;
	weeklyCapacityMinutes: number;
	remainingMinutes: number;
}

function minutesOf(time: string): number {
	const [hours, minutes] = time.split(':').map(Number);
	return hours * 60 + minutes;
}

/** Total length of the union of a day's intervals (collapses overlaps). */
function unionMinutes(intervals: Array<{ startTime: string; endTime: string }>): number {
	const sorted = intervals
		.map((interval) => ({ start: minutesOf(interval.startTime), end: minutesOf(interval.endTime) }))
		.sort((left, right) => left.start - right.start);
	let total = 0;
	let currentStart = -1;
	let currentEnd = -1;
	for (const interval of sorted) {
		if (interval.start > currentEnd) {
			if (currentEnd > currentStart) total += currentEnd - currentStart;
			currentStart = interval.start;
			currentEnd = interval.end;
		} else if (interval.end > currentEnd) {
			currentEnd = interval.end;
		}
	}
	if (currentEnd > currentStart) total += currentEnd - currentStart;
	return total;
}

/**
 * Evaluate whether a submitted authority leaves enough weekly teaching capacity
 * for the teacher's required load. `UNAVAILABLE` windows are subtracted from the
 * canonical day-shape capacity; a set that leaves NO usable capacity in the week
 * (the "unavailable all week" case) is infeasible regardless of load.
 */
export async function evaluateAvailabilityFeasibility(
	input: { schoolId: number; schoolYearId: number; facultyId: number; slots: AvailabilitySlotInput[] },
	client?: unknown,
): Promise<AvailabilityFeasibility> {
	const db = resolveClient(client);

	let requiredMinutes = 0;
	if (db.facultySubject && db.subject) {
		const assignments = await db.facultySubject.findMany({ where: { schoolId: input.schoolId, facultyId: input.facultyId }, select: { subjectId: true } });
		const subjectIds = [...new Set(assignments.map((row) => row.subjectId))];
		if (subjectIds.length > 0) {
			const subjects = await db.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, minMinutesPerWeek: true } });
			requiredMinutes = subjects.reduce((total, subject) => total + (subject.minMinutesPerWeek ?? 0), 0);
		}
	}

	let periodsPerDay = DEFAULT_AVAILABILITY_PERIODS_PER_DAY;
	let periodLengthMinutes = DEFAULT_AVAILABILITY_PERIOD_LENGTH_MINUTES;
	if (db.schedulingPolicy) {
		const policy = await db.schedulingPolicy.findUnique({
			where: { schoolId_schoolYearId: { schoolId: input.schoolId, schoolYearId: input.schoolYearId } },
			select: { periodsPerDay: true, periodLengthMinutes: true },
		});
		if (policy) {
			if (Number.isInteger(policy.periodsPerDay) && (policy.periodsPerDay ?? 0) > 0) periodsPerDay = policy.periodsPerDay as number;
			if (Number.isInteger(policy.periodLengthMinutes) && (policy.periodLengthMinutes ?? 0) > 0) periodLengthMinutes = policy.periodLengthMinutes as number;
		}
	}
	const weeklyCapacityMinutes = AVAILABILITY_DAYS.length * periodsPerDay * periodLengthMinutes;

	const unavailableByDay = new Map<string, Array<{ startTime: string; endTime: string }>>();
	for (const slot of input.slots) {
		if (slot.state !== 'UNAVAILABLE') continue;
		const list = unavailableByDay.get(slot.day) ?? [];
		list.push({ startTime: slot.startTime, endTime: slot.endTime });
		unavailableByDay.set(slot.day, list);
	}
	let unavailableMinutes = 0;
	for (const intervals of unavailableByDay.values()) unavailableMinutes += unionMinutes(intervals);

	const remainingMinutes = Math.max(0, weeklyCapacityMinutes - unavailableMinutes);
	const feasible = remainingMinutes > 0 && remainingMinutes >= requiredMinutes;
	return { feasible, requiredMinutes, weeklyCapacityMinutes, remainingMinutes };
}

// ─── Writes ───

export interface SaveAvailabilityInput {
	schoolId: number;
	schoolYearId: number;
	facultyId: number;
	termIndex: number;
	slots: unknown;
	notes?: string | null;
	version?: number | null;
}

export async function saveAvailabilityDraft(input: SaveAvailabilityInput, client?: unknown): Promise<FacultyAvailabilityRecord> {
	const db = resolveClient(client);
	const schoolId = positiveInt(input.schoolId, 'schoolId');
	const schoolYearId = positiveInt(input.schoolYearId, 'schoolYearId');
	const facultyId = positiveInt(input.facultyId, 'facultyId');
	const termIndex = assertTermIndexInRange(input.termIndex);
	const slots = normalizeAvailabilitySlots(input.slots);

	const { termIndex: activeTermIndex } = await resolveActiveAvailabilityTermIndex(schoolId, schoolYearId, db);
	if (termIndex !== activeTermIndex) {
		throw err(409, 'TERM_SCOPE_MISMATCH', `termIndex ${termIndex} is not the persisted active term (${activeTermIndex}); availability is written against the active ordered term only.`);
	}
	await assertFacultyInSchool(db, schoolId, facultyId);

	const notes = input.notes ?? null;
	const slotRows = slots.map((slot) => ({ day: slot.day, startTime: slot.startTime, endTime: slot.endTime, state: slot.state }));

	// R3 (correction): the row + version are re-read INSIDE the write transaction,
	// so a concurrent edit cannot be overwritten (lost update) and a reviewed
	// authority cannot be silently reset. A version mismatch aborts with 409 and
	// zero writes (verification gate 5).
	const saved = await runTransaction(db, async (tx) => {
		const existing = await tx.facultyAvailability.findUnique({
			where: { schoolId_schoolYearId_facultyId_termIndex: { schoolId, schoolYearId, facultyId, termIndex } },
			include: { slots: SLOT_SELECT },
		});
		if (existing) {
			if (input.version != null && input.version !== existing.version) {
				throw err(409, 'VERSION_CONFLICT', `Version conflict: expected ${existing.version}, got ${input.version}. Reload and retry.`);
			}
			await tx.facultyAvailabilitySlot.deleteMany({ where: { availabilityId: existing.id } });
			return tx.facultyAvailability.update({
				where: { id: existing.id },
				data: {
					status: 'DRAFT',
					notes,
					submittedAt: null,
					reviewedBy: null,
					reviewedAt: null,
					reviewerNotes: null,
					version: existing.version + 1,
					...(slotRows.length > 0 ? { slots: { createMany: { data: slotRows } } } : {}),
				},
				include: { slots: SLOT_SELECT },
			});
		}
		return tx.facultyAvailability.create({
			data: {
				schoolId,
				schoolYearId,
				facultyId,
				termIndex,
				status: 'DRAFT',
				notes,
				...(slotRows.length > 0 ? { slots: { createMany: { data: slotRows } } } : {}),
			},
			include: { slots: SLOT_SELECT },
		});
	});
	return toRecord(saved);
}

export interface SubmitAvailabilityInput {
	schoolId: number;
	schoolYearId: number;
	facultyId: number;
	version: number;
	slots?: unknown;
	notes?: string | null;
}

export async function submitAvailability(input: SubmitAvailabilityInput, client?: unknown): Promise<FacultyAvailabilityRecord> {
	const db = resolveClient(client);
	const schoolId = positiveInt(input.schoolId, 'schoolId');
	const schoolYearId = positiveInt(input.schoolYearId, 'schoolYearId');
	const facultyId = positiveInt(input.facultyId, 'facultyId');
	const version = positiveInt(input.version, 'version');
	const slots = input.slots === undefined ? null : normalizeAvailabilitySlots(input.slots);

	const { termIndex } = await resolveActiveAvailabilityTermIndex(schoolId, schoolYearId, db);
	await assertFacultyInSchool(db, schoolId, facultyId);

	// R3 (correction): re-read + version CAS inside the write transaction.
	const submitted = await runTransaction(db, async (tx) => {
		const existing = await tx.facultyAvailability.findUnique({
			where: { schoolId_schoolYearId_facultyId_termIndex: { schoolId, schoolYearId, facultyId, termIndex } },
			include: { slots: SLOT_SELECT },
		});
		if (!existing) throw err(404, 'AVAILABILITY_NOT_FOUND', 'No availability draft exists for this teacher and active term.');
		if (version !== existing.version) {
			throw err(409, 'VERSION_CONFLICT', `Version conflict: expected ${existing.version}, got ${version}. Reload and retry.`);
		}
		const notes = input.notes !== undefined ? input.notes ?? null : existing.notes;
		const slotRows = slots === null
			? (existing.slots ?? []).map((slot) => ({ day: slot.day, startTime: slot.startTime, endTime: slot.endTime, state: slot.state }))
			: slots.map((slot) => ({ day: slot.day, startTime: slot.startTime, endTime: slot.endTime, state: slot.state }));
		await tx.facultyAvailabilitySlot.deleteMany({ where: { availabilityId: existing.id } });
		return tx.facultyAvailability.update({
			where: { id: existing.id },
			data: {
				status: 'SUBMITTED',
				notes,
				submittedAt: new Date(),
				reviewedBy: null,
				reviewedAt: null,
				reviewerNotes: null,
				version: existing.version + 1,
				...(slotRows.length > 0 ? { slots: { createMany: { data: slotRows } } } : {}),
			},
			include: { slots: SLOT_SELECT },
		});
	});
	return toRecord(submitted);
}

export interface ReviewAvailabilityInput {
	schoolId: number;
	schoolYearId: number;
	facultyId: number;
	version: number;
	decision: AvailabilityReviewDecision;
	reviewerId: number;
	reviewerNotes?: string | null;
}

export async function reviewAvailability(input: ReviewAvailabilityInput, client?: unknown): Promise<FacultyAvailabilityRecord> {
	const db = resolveClient(client);
	const schoolId = positiveInt(input.schoolId, 'schoolId');
	const schoolYearId = positiveInt(input.schoolYearId, 'schoolYearId');
	const facultyId = positiveInt(input.facultyId, 'facultyId');
	const version = positiveInt(input.version, 'version');
	const reviewerId = positiveInt(input.reviewerId, 'reviewerId');
	if (!VALID_REVIEW_DECISIONS.has(input.decision)) {
		throw err(400, 'INVALID_DECISION', 'decision must be REVIEWED or REJECTED.');
	}

	const { termIndex } = await resolveActiveAvailabilityTermIndex(schoolId, schoolYearId, db);
	// R3 (correction): re-read the row inside the write transaction, then apply
	// the submitted/version CAS and feasibility gate before the single update.
	// Every rejection aborts before any write (gate 5 / gate 6).
	const reviewed = await runTransaction(db, async (tx) => {
		const existing = await tx.facultyAvailability.findUnique({
			where: { schoolId_schoolYearId_facultyId_termIndex: { schoolId, schoolYearId, facultyId, termIndex } },
			include: { slots: SLOT_SELECT },
		});
		if (!existing) throw err(404, 'AVAILABILITY_NOT_FOUND', 'No availability submission exists for this teacher and active term.');
		if (existing.status !== 'SUBMITTED') {
			throw err(422, 'NOT_SUBMITTED', 'Only a submitted availability authority can be reviewed.');
		}
		if (version !== existing.version) {
			throw err(409, 'VERSION_CONFLICT', `Version conflict: expected ${existing.version}, got ${version}. Reload and retry.`);
		}
		if (input.decision === 'REVIEWED') {
			const feasibility = await evaluateAvailabilityFeasibility(
				{ schoolId, schoolYearId, facultyId, slots: toRecord(existing).slots },
				tx,
			);
			if (!feasibility.feasible) {
				throw err(
					422,
					'AVAILABILITY_INFEASIBLE',
					`This availability leaves ${feasibility.remainingMinutes} usable teaching minutes per week but the teacher's required load is ${feasibility.requiredMinutes}; narrow the UNAVAILABLE windows and resubmit.`,
				);
			}
		}
		return tx.facultyAvailability.update({
			where: { id: existing.id },
			data: {
				status: input.decision,
				reviewedBy: reviewerId,
				reviewedAt: new Date(),
				reviewerNotes: input.reviewerNotes ?? null,
				version: existing.version + 1,
			},
			include: { slots: SLOT_SELECT },
		});
	});
	return toRecord(reviewed);
}
