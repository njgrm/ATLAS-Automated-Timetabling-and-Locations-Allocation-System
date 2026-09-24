/**
 * FACULTY-GRADE-PREFERENCE-C01 (decision D10).
 *
 * ATLAS-owned, optional, SOFT grade-level preference for a teacher. It is an
 * `autoFill` ranking hint only: it never blocks a candidate and never reduces
 * coverage. The row is keyed `(schoolId, facultyId)` with **no `schoolYearId`**
 * so it is persistent across rollover and must never be cleared by the
 * EnrollPro faculty sync. An empty `gradeLevels` means "no preference" and
 * changes nothing.
 *
 * Values are numeric Philippine JHS grades 7-10. EnrollPro grade-level IDs
 * (typically 1-4) are explicitly rejected by the API so a caller cannot
 * accidentally persist a mirror ID as a grade.
 */

import { getDataContext } from '../lib/data-context.js';

/** Numeric Philippine JHS grade levels. EnrollPro grade-level IDs are NOT valid here. */
export const PREFERRED_GRADE_LEVELS = [7, 8, 9, 10] as const;
export type PreferredGradeLevel = (typeof PREFERRED_GRADE_LEVELS)[number];
const VALID_PREFERRED_GRADE_LEVELS = new Set<number>(PREFERRED_GRADE_LEVELS);

export interface FacultyGradePreferenceRecord {
	facultyId: number;
	gradeLevels: number[];
	updatedAt: Date | null;
}

export class FacultyGradePreferenceError extends Error {
	readonly statusCode: number;
	readonly code: string;

	constructor(code: string, message: string, statusCode: number) {
		super(message);
		this.name = 'FacultyGradePreferenceError';
		this.code = code;
		this.statusCode = statusCode;
	}
}

/**
 * Validate and canonicalise a caller-supplied preference set. Accepts only an
 * array of integer JHS grades 7-10; dedupes and sorts ascending. Rejects
 * anything else (including EnrollPro grade-level IDs such as 1-4) with a typed
 * 400 so no invalid value reaches persistence.
 */
export function normalizePreferredGradeLevels(raw: unknown): number[] {
	if (raw === undefined || raw === null) {
		throw new FacultyGradePreferenceError(
			'INVALID_GRADE_LEVELS',
			'gradeLevels must be an array of numeric JHS grades 7-10.',
			400,
		);
	}
	if (!Array.isArray(raw)) {
		throw new FacultyGradePreferenceError(
			'INVALID_GRADE_LEVELS',
			'gradeLevels must be an array of numeric JHS grades 7-10. EnrollPro grade-level IDs are not accepted.',
			400,
		);
	}
	const seen = new Set<number>();
	for (const value of raw) {
		if (typeof value !== 'number' || !Number.isInteger(value) || !VALID_PREFERRED_GRADE_LEVELS.has(value)) {
			throw new FacultyGradePreferenceError(
				'INVALID_GRADE_LEVELS',
				`gradeLevels may only contain numeric JHS grades 7-10 (received ${JSON.stringify(value)}). EnrollPro grade-level IDs are not accepted.`,
				400,
			);
		}
		seen.add(value);
	}
	return [...seen].sort((left, right) => left - right);
}

/** The minimum injected client surface this service reads/writes. */
type PreferenceClient = {
	facultyMirror: {
		findFirst: (args: unknown) => Promise<{ id: number } | null>;
	};
	facultyGradePreference: {
		findMany: (args: unknown) => Promise<Array<{ facultyId: number; gradeLevels: number[]; updatedAt: Date | null }>>;
		findUnique: (args: unknown) => Promise<{ facultyId: number; gradeLevels: number[]; updatedAt: Date | null } | null>;
		upsert: (args: unknown) => Promise<{ facultyId: number; gradeLevels: number[]; updatedAt: Date | null }>;
	};
};

function resolveClient(client?: unknown): PreferenceClient {
	return (client ?? getDataContext()) as unknown as PreferenceClient;
}

function toRecord(row: { facultyId: number; gradeLevels: number[]; updatedAt: Date | null }): FacultyGradePreferenceRecord {
	return {
		facultyId: row.facultyId,
		gradeLevels: [...row.gradeLevels].sort((left, right) => left - right),
		updatedAt: row.updatedAt ?? null,
	};
}

/**
 * List every persisted preference for a school. There is deliberately no
 * `schoolYearId` filter: the contract is year-independent.
 */
export async function listFacultyGradePreferences(
	schoolId: number,
	client?: unknown,
): Promise<FacultyGradePreferenceRecord[]> {
	const db = resolveClient(client);
	const rows = await db.facultyGradePreference.findMany({
		where: { schoolId },
		select: { facultyId: true, gradeLevels: true, updatedAt: true },
		orderBy: { facultyId: 'asc' },
	});
	return rows.map(toRecord);
}

/** Read one teacher's preference. Null means "no preference" (equivalent to empty). */
export async function getFacultyGradePreference(
	schoolId: number,
	facultyId: number,
	client?: unknown,
): Promise<FacultyGradePreferenceRecord | null> {
	const db = resolveClient(client);
	const row = await db.facultyGradePreference.findUnique({
		where: { schoolId_facultyId: { schoolId, facultyId } },
		select: { facultyId: true, gradeLevels: true, updatedAt: true },
	});
	return row ? toRecord(row) : null;
}

/**
 * Upsert one teacher's preference. The faculty must belong to the school.
 * The identity is `(schoolId, facultyId)` only — never a school year.
 */
export async function setFacultyGradePreference(
	schoolId: number,
	facultyId: number,
	rawGradeLevels: unknown,
	client?: unknown,
): Promise<FacultyGradePreferenceRecord> {
	const gradeLevels = normalizePreferredGradeLevels(rawGradeLevels);
	const db = resolveClient(client);
	const faculty = await db.facultyMirror.findFirst({
		where: { id: facultyId, schoolId },
		select: { id: true },
	});
	if (!faculty) {
		throw new FacultyGradePreferenceError(
			'FACULTY_NOT_FOUND',
			'Faculty profile not found for this school.',
			404,
		);
	}
	const row = await db.facultyGradePreference.upsert({
		where: { schoolId_facultyId: { schoolId, facultyId } },
		create: { schoolId, facultyId, gradeLevels },
		update: { gradeLevels },
		select: { facultyId: true, gradeLevels: true, updatedAt: true },
	});
	return toRecord(row);
}

/**
 * Soft predicate used by Teaching Load ranking: does this teacher's preference
 * include the section's numeric grade? An empty/unset preference always
 * returns false and is treated as "no opinion" by callers.
 */
export function preferenceIncludesGrade(gradeLevels: readonly number[] | undefined, sectionGradeLevel: number): boolean {
	if (!gradeLevels || gradeLevels.length === 0) return false;
	if (!Number.isInteger(sectionGradeLevel)) return false;
	return gradeLevels.includes(sectionGradeLevel);
}
