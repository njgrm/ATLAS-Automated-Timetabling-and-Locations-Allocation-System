/**
 * BENEFICIARY-EXPORT-PARITY-C05R1 — Teacher Program presentation / signatory
 * authority.
 *
 * ATLAS-owned, typed, school/year-scoped editable profile for the official
 * teacher-program DOCX: School Head, PSDS, CID Chief and ASDS names + displayed
 * titles, plus an optional footer line. This is deliberately NOT stored inside
 * constraint-warning configuration.
 *
 * Immutability model:
 *  - `teacher_program_presentation_revisions` is append-only. Every committed
 *    save appends exactly one new immutable revision.
 *  - The effective (draft/review) profile is the highest revision.
 *  - A published/archived export resolves the revision that was effective at
 *    `publication.publishedAt` (`created_at <= published_at`), so later edits
 *    never rewrite historical output identity.
 *
 * Authority model:
 *  - The write path requires a positive actor id, actor-school equality (the
 *    route enforces this before any service call), the single active
 *    non-archived school year, optimistic revision CAS, and typed validation.
 *  - A committed change writes exactly one audit record.
 *  - A no-change replay performs zero writes and returns the existing revision.
 *  - Every read/preview/export path is zero-write.
 */

import { getDataContext } from '../lib/data-context.js';

// ─── Types ───

export interface TeacherProgramSignatoryEntry {
	name: string | null;
	/** Displayed title. Always present (falls back to the canonical role title). */
	title: string;
}

export interface TeacherProgramSignatoryProfile {
	/** Highest applied revision, or `null` when nothing has been configured. */
	revision: number | null;
	schoolHead: TeacherProgramSignatoryEntry;
	psds: TeacherProgramSignatoryEntry;
	cidChief: TeacherProgramSignatoryEntry;
	asds: TeacherProgramSignatoryEntry;
	footerText: string | null;
}

export interface TeacherProgramSignatoryInput {
	schoolHeadName?: string | null;
	schoolHeadTitle?: string | null;
	psdsName?: string | null;
	psdsTitle?: string | null;
	cidChiefName?: string | null;
	cidChiefTitle?: string | null;
	asdsName?: string | null;
	asdsTitle?: string | null;
	footerText?: string | null;
}

export type SaveSignatoryProfileResult = {
	revision: number;
	replayed: boolean;
	auditId: number | null;
	profile: TeacherProgramSignatoryProfile;
};

export class PresentationProfileError extends Error {
	readonly statusCode: number;
	readonly code: string;
	readonly details?: Record<string, unknown>;

	constructor(statusCode: number, code: string, message: string, details?: Record<string, unknown>) {
		super(message);
		this.name = 'PresentationProfileError';
		this.statusCode = statusCode;
		this.code = code;
		this.details = details;
	}
}

// ─── Canonical titles (never invented names) ───

export const SIGNATORY_ROLE_TITLES = {
	schoolHead: 'School Head',
	psds: 'Public School District Supervisor',
	cidChief: 'Chief – Curriculum Implementation Division',
	asds: 'Assistant Schools Division Superintendent',
} as const;

const NAME_MAX = 120;
const FOOTER_MAX = 200;

// ─── Normalization / validation ───

function normalizeText(
	value: unknown,
	field: string,
	maxLength: number,
	label: string,
): string | null {
	if (value === undefined || value === null) return null;
	if (typeof value !== 'string') {
		throw new PresentationProfileError(400, 'PRESENTATION_PROFILE_INVALID', `${label} must be a string.`, { field });
	}
	const trimmed = value.replace(/\s+/g, ' ').trim();
	if (trimmed.length === 0) return null;
	// Reject control characters and line separators outright; these are
	// single-line identity fields, not free-form rich text.
	if (/[\u0000-\u001f\u007f\u2028\u2029]/.test(trimmed)) {
		throw new PresentationProfileError(400, 'PRESENTATION_PROFILE_INVALID', `${label} must not contain control characters.`, { field });
	}
	if (trimmed.length > maxLength) {
		throw new PresentationProfileError(400, 'PRESENTATION_PROFILE_INVALID', `${label} must be at most ${maxLength} characters.`, { field });
	}
	return trimmed;
}

export type NormalizedSignatoryProfile = {
	schoolHeadName: string | null;
	schoolHeadTitle: string | null;
	psdsName: string | null;
	psdsTitle: string | null;
	cidChiefName: string | null;
	cidChiefTitle: string | null;
	asdsName: string | null;
	asdsTitle: string | null;
	footerText: string | null;
};

export function normalizeSignatoryInput(input: TeacherProgramSignatoryInput): NormalizedSignatoryProfile {
	if (input == null || typeof input !== 'object') {
		throw new PresentationProfileError(400, 'PRESENTATION_PROFILE_INVALID', 'A presentation profile payload is required.');
	}
	return {
		schoolHeadName: normalizeText(input.schoolHeadName, 'schoolHeadName', NAME_MAX, 'School Head name'),
		schoolHeadTitle: normalizeText(input.schoolHeadTitle, 'schoolHeadTitle', NAME_MAX, 'School Head title'),
		psdsName: normalizeText(input.psdsName, 'psdsName', NAME_MAX, 'PSDS name'),
		psdsTitle: normalizeText(input.psdsTitle, 'psdsTitle', NAME_MAX, 'PSDS title'),
		cidChiefName: normalizeText(input.cidChiefName, 'cidChiefName', NAME_MAX, 'CID Chief name'),
		cidChiefTitle: normalizeText(input.cidChiefTitle, 'cidChiefTitle', NAME_MAX, 'CID Chief title'),
		asdsName: normalizeText(input.asdsName, 'asdsName', NAME_MAX, 'ASDS name'),
		asdsTitle: normalizeText(input.asdsTitle, 'asdsTitle', NAME_MAX, 'ASDS title'),
		footerText: normalizeText(input.footerText, 'footerText', FOOTER_MAX, 'Footer text'),
	};
}

function rowToProfile(row: {
	revision: number;
	schoolHeadName: string | null;
	schoolHeadTitle: string | null;
	psdsName: string | null;
	psdsTitle: string | null;
	cidChiefName: string | null;
	cidChiefTitle: string | null;
	asdsName: string | null;
	asdsTitle: string | null;
	footerText: string | null;
}): TeacherProgramSignatoryProfile {
	return {
		revision: row.revision,
		schoolHead: { name: row.schoolHeadName ?? null, title: row.schoolHeadTitle ?? SIGNATORY_ROLE_TITLES.schoolHead },
		psds: { name: row.psdsName ?? null, title: row.psdsTitle ?? SIGNATORY_ROLE_TITLES.psds },
		cidChief: { name: row.cidChiefName ?? null, title: row.cidChiefTitle ?? SIGNATORY_ROLE_TITLES.cidChief },
		asds: { name: row.asdsName ?? null, title: row.asdsTitle ?? SIGNATORY_ROLE_TITLES.asds },
		footerText: row.footerText ?? null,
	};
}

export function emptySignatoryProfile(): TeacherProgramSignatoryProfile {
	return {
		revision: null,
		schoolHead: { name: null, title: SIGNATORY_ROLE_TITLES.schoolHead },
		psds: { name: null, title: SIGNATORY_ROLE_TITLES.psds },
		cidChief: { name: null, title: SIGNATORY_ROLE_TITLES.cidChief },
		asds: { name: null, title: SIGNATORY_ROLE_TITLES.asds },
		footerText: null,
	};
}

const PROFILE_SELECT = {
	revision: true,
	schoolHeadName: true,
	schoolHeadTitle: true,
	psdsName: true,
	psdsTitle: true,
	cidChiefName: true,
	cidChiefTitle: true,
	asdsName: true,
	asdsTitle: true,
	footerText: true,
} as const;

// ─── Read paths (zero writes) ───

export async function readEffectiveSignatoryProfile(params: {
	schoolId: number;
	schoolYearId: number;
	client?: any;
}): Promise<TeacherProgramSignatoryProfile> {
	const db = (params.client ?? getDataContext()) as any;
	// An injected read-only fixture may omit the delegate entirely; an absent
	// store is an empty profile, never an invented person.
	if (typeof db?.teacherProgramPresentationRevision?.findFirst !== 'function') return emptySignatoryProfile();
	const row = await db.teacherProgramPresentationRevision.findFirst({
		where: { schoolId: params.schoolId, schoolYearId: params.schoolYearId },
		orderBy: { revision: 'desc' },
		select: PROFILE_SELECT,
	});
	return row ? rowToProfile(row) : emptySignatoryProfile();
}

/**
 * Resolve the profile that was effective at `publishedAt`. Published and
 * archived exports bind to this immutable revision instead of the current
 * mutable one, so later active-year edits never rewrite history.
 */
export async function readSignatoryProfileAsOfPublication(params: {
	schoolId: number;
	schoolYearId: number;
	publishedAt: string | Date;
	client?: any;
}): Promise<TeacherProgramSignatoryProfile> {
	const db = (params.client ?? getDataContext()) as any;
	const publishedAt = params.publishedAt instanceof Date ? params.publishedAt : new Date(params.publishedAt);
	if (Number.isNaN(publishedAt.getTime())) return emptySignatoryProfile();
	if (typeof db?.teacherProgramPresentationRevision?.findFirst !== 'function') return emptySignatoryProfile();
	const row = await db.teacherProgramPresentationRevision.findFirst({
		where: {
			schoolId: params.schoolId,
			schoolYearId: params.schoolYearId,
			createdAt: { lte: publishedAt },
		},
		orderBy: { revision: 'desc' },
		select: PROFILE_SELECT,
	});
	return row ? rowToProfile(row) : emptySignatoryProfile();
}

/**
 * Resolve the profile one export should render: the current effective profile
 * for a draft/review run, or the immutable published-time revision for a
 * published/archived run. Zero writes in both directions.
 */
export async function resolveExportSignatoryProfile(params: {
	schoolId: number;
	schoolYearId: number;
	isPublished: boolean;
	publishedAt: string | null;
	client?: any;
}): Promise<TeacherProgramSignatoryProfile> {
	if (params.isPublished && params.publishedAt) {
		return readSignatoryProfileAsOfPublication({
			schoolId: params.schoolId,
			schoolYearId: params.schoolYearId,
			publishedAt: params.publishedAt,
			client: params.client,
		});
	}
	return readEffectiveSignatoryProfile({
		schoolId: params.schoolId,
		schoolYearId: params.schoolYearId,
		client: params.client,
	});
}

// ─── Active-year authority ───

/**
 * The write path is bound to the single active, non-archived school year for
 * the actor's school. Fails closed on zero/multiple active mirrors and on a
 * requested year that is not the active one. No school-1/current-year fallback.
 */
export async function assertActiveSchoolYear(params: {
	schoolId: number;
	schoolYearId: number;
	client?: any;
}): Promise<void> {
	const db = (params.client ?? getDataContext()) as any;
	const active = await db.enrollProSchoolYearMirror.findMany({
		where: { schoolId: params.schoolId, isActive: true, isArchived: false },
		select: { enrollProSchoolYearId: true },
	});
	if (!Array.isArray(active) || active.length === 0) {
		throw new PresentationProfileError(409, 'ACTIVE_YEAR_UNAVAILABLE', 'No active, non-archived school-year mirror exists for this school.');
	}
	if (active.length > 1) {
		throw new PresentationProfileError(409, 'ACTIVE_YEAR_AMBIGUOUS', 'More than one active, non-archived school-year mirror exists for this school.');
	}
	if (active[0].enrollProSchoolYearId !== params.schoolYearId) {
		throw new PresentationProfileError(409, 'SCHOOL_YEAR_NOT_ACTIVE', 'Presentation signatories can only be edited for the active school year.');
	}
}

// ─── Write path (append-only + CAS + audit + idempotent replay) ───

function normalizedEquals(
	current: NormalizedSignatoryProfile,
	next: NormalizedSignatoryProfile,
): boolean {
	return (
		current.schoolHeadName === next.schoolHeadName
		&& current.schoolHeadTitle === next.schoolHeadTitle
		&& current.psdsName === next.psdsName
		&& current.psdsTitle === next.psdsTitle
		&& current.cidChiefName === next.cidChiefName
		&& current.cidChiefTitle === next.cidChiefTitle
		&& current.asdsName === next.asdsName
		&& current.asdsTitle === next.asdsTitle
		&& current.footerText === next.footerText
	);
}

function rowToNormalized(row: Record<string, unknown>): NormalizedSignatoryProfile {
	return {
		schoolHeadName: (row.schoolHeadName as string | null) ?? null,
		schoolHeadTitle: (row.schoolHeadTitle as string | null) ?? null,
		psdsName: (row.psdsName as string | null) ?? null,
		psdsTitle: (row.psdsTitle as string | null) ?? null,
		cidChiefName: (row.cidChiefName as string | null) ?? null,
		cidChiefTitle: (row.cidChiefTitle as string | null) ?? null,
		asdsName: (row.asdsName as string | null) ?? null,
		asdsTitle: (row.asdsTitle as string | null) ?? null,
		footerText: (row.footerText as string | null) ?? null,
	};
}

export async function saveSignatoryProfile(params: {
	schoolId: number;
	schoolYearId: number;
	actorId: number;
	expectedRevision: number;
	input: TeacherProgramSignatoryInput;
	client?: any;
}): Promise<SaveSignatoryProfileResult> {
	const { schoolId, schoolYearId, actorId, expectedRevision } = params;
	if (!Number.isInteger(actorId) || actorId <= 0) {
		throw new PresentationProfileError(401, 'ACTOR_REQUIRED', 'A positive authenticated actor id is required.');
	}
	if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
		throw new PresentationProfileError(400, 'EXPECTED_REVISION_REQUIRED', 'expectedRevision must be a non-negative integer.');
	}

	const next = normalizeSignatoryInput(params.input);
	const db = (params.client ?? getDataContext()) as any;

	await assertActiveSchoolYear({ schoolId, schoolYearId, client: params.client });

	const current = await db.teacherProgramPresentationRevision.findFirst({
		where: { schoolId, schoolYearId },
		orderBy: { revision: 'desc' },
	});
	const currentRevision = (current?.revision as number | undefined) ?? 0;
	if (currentRevision !== expectedRevision) {
		throw new PresentationProfileError(409, 'PRESENTATION_PROFILE_STALE', 'The presentation profile changed since it was loaded. Reload before saving.', {
			expectedRevision,
			currentRevision,
		});
	}

	// Idempotent replay / no-change: zero writes, zero audit rows.
	if (current && normalizedEquals(rowToNormalized(current), next)) {
		return {
			revision: current.revision as number,
			replayed: true,
			auditId: (current.auditId as number | null) ?? null,
			profile: rowToProfile(current),
		};
	}

	const run = async (tx: any): Promise<SaveSignatoryProfileResult> => {
		// Re-read the complete qualifying set inside the transaction so the CAS
		// is bound to a stable revision under concurrency.
		const latest = await tx.teacherProgramPresentationRevision.findFirst({
			where: { schoolId, schoolYearId },
			orderBy: { revision: 'desc' },
		});
		const latestRevision = (latest?.revision as number | undefined) ?? 0;
		if (latestRevision !== expectedRevision) {
			throw new PresentationProfileError(409, 'PRESENTATION_PROFILE_STALE', 'The presentation profile changed during the save. Reload before saving.', {
				expectedRevision,
				currentRevision: latestRevision,
			});
		}
		const nextRevision = latestRevision + 1;

		const audit = await tx.auditLog.create({
			data: {
				schoolId,
				schoolYearId,
				action: 'TEACHER_PROGRAM_PRESENTATION_UPDATED',
				actorId,
				targetIds: [schoolId, schoolYearId],
				metadata: JSON.parse(JSON.stringify({
					revision: nextRevision,
					previousRevision: latestRevision,
					changedFields: Object.entries(next)
						.filter(([, value]) => value != null)
						.map(([key]) => key),
				})),
			},
		});

		const created = await tx.teacherProgramPresentationRevision.create({
			data: {
				schoolId,
				schoolYearId,
				revision: nextRevision,
				...next,
				createdBy: actorId,
				auditId: audit.id,
			},
		});

		return {
			revision: nextRevision,
			replayed: false,
			auditId: audit.id as number,
			profile: rowToProfile(created),
		};
	};

	// Production uses a real Serializable interactive transaction; the injected
	// read-only fixture client may not expose `$transaction`, so fall back to the
	// client itself (tests assert the CAS/audit/replay semantics).
	if (typeof db.$transaction === 'function') {
		try {
			return await db.$transaction(run, { isolationLevel: 'Serializable' });
		} catch (error) {
			// A concurrent save that committed first surfaces as a write conflict
			// (P2034) or a revision uniqueness violation (P2002). Both are the
			// documented stale-revision rejection, never a lost update.
			const code = (error as { code?: string })?.code;
			if (code === 'P2002' || code === 'P2034') {
				throw new PresentationProfileError(409, 'PRESENTATION_PROFILE_STALE', 'The presentation profile changed during the save. Reload before saving.', { conflictCode: code });
			}
			throw error;
		}
	}
	return run(db);
}
