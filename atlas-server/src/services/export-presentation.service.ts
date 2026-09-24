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
	officialSchoolName: string | null;
	headerLine: string | null;
	regionLine: string | null;
	divisionLine: string | null;
	districtLine: string | null;
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
	officialSchoolName?: string | null;
	headerLine?: string | null;
	regionLine?: string | null;
	divisionLine?: string | null;
	districtLine?: string | null;
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

// ─── Missing-schema guard (EXPORT-PRESENTATION-SCHEMA-GUARD-C06B) ───

/**
 * The teacher-program presentation revision store lives in migration
 * `0003_teacher_program_presentation`, which may not be applied on a
 * deployment yet. When its table (Prisma `P2021`) or one of its columns
 * (Prisma `P2022`) is absent, every consumer must fail closed with this one
 * typed, non-leaking response instead of surfacing the raw Prisma failure.
 *
 * This constant is the single client-facing message for the export route, the
 * presentation settings routes, and any future consumer.
 */
export const EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE_CODE = 'EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE';

export const EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE_MESSAGE =
	'Teacher-program presentation settings are unavailable because the required presentation schema has not been provisioned on this deployment. No official document can be produced until an administrator applies the pending schema migration.';

/**
 * Translate ONLY a Prisma `P2021` (table does not exist) or `P2022` (column does
 * not exist) raised by a teacher-program presentation revision store call.
 *
 * Every other failure — `P2002`/`P2034` conflicts, validation errors, a plain
 * `Error`, a future Prisma code — propagates byte-identically to the caller, so
 * the existing `PRESENTATION_PROFILE_STALE` mapping and every unrelated
 * authority (for example `assertActiveSchoolYear`, which reads a core table
 * outside migration 0003) stay intact. The guard is deliberately applied only
 * to the revision store calls, never to a surrounding core-schema read.
 */
async function withPresentationSchemaGuard(operation: () => Promise<any>): Promise<any> {
	try {
		return await operation();
	} catch (error) {
		const code = (error as { code?: unknown } | null)?.code;
		if (code === 'P2021' || code === 'P2022') {
			// Server-side diagnosis only: the swallowed upstream Prisma failure
			// must stay diagnosable while the client response stays typed.
			console.error(
				`[export-presentation] teacher-program presentation revision store is unavailable (Prisma ${String(code)}); migration 0003_teacher_program_presentation is not applied on this deployment.`,
			);
			throw new PresentationProfileError(
				503,
				EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE_CODE,
				EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE_MESSAGE,
			);
		}
		throw error;
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
	officialSchoolName: string | null;
	headerLine: string | null;
	regionLine: string | null;
	divisionLine: string | null;
	districtLine: string | null;
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
		officialSchoolName: normalizeText(input.officialSchoolName, 'officialSchoolName', 200, 'Official school name'),
		headerLine: normalizeText(input.headerLine, 'headerLine', 200, 'Header line'),
		regionLine: normalizeText(input.regionLine, 'regionLine', 160, 'Region line'),
		divisionLine: normalizeText(input.divisionLine, 'divisionLine', 160, 'Division line'),
		districtLine: normalizeText(input.districtLine, 'districtLine', 160, 'District line'),
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
	officialSchoolName: string | null;
	headerLine: string | null;
	regionLine: string | null;
	divisionLine: string | null;
	districtLine: string | null;
}): TeacherProgramSignatoryProfile {
	return {
		revision: row.revision,
		schoolHead: { name: row.schoolHeadName ?? null, title: row.schoolHeadTitle ?? SIGNATORY_ROLE_TITLES.schoolHead },
		psds: { name: row.psdsName ?? null, title: row.psdsTitle ?? SIGNATORY_ROLE_TITLES.psds },
		cidChief: { name: row.cidChiefName ?? null, title: row.cidChiefTitle ?? SIGNATORY_ROLE_TITLES.cidChief },
		asds: { name: row.asdsName ?? null, title: row.asdsTitle ?? SIGNATORY_ROLE_TITLES.asds },
		footerText: row.footerText ?? null,
		officialSchoolName: row.officialSchoolName ?? null,
		headerLine: row.headerLine ?? null,
		regionLine: row.regionLine ?? null,
		divisionLine: row.divisionLine ?? null,
		districtLine: row.districtLine ?? null,
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
		officialSchoolName: null,
		headerLine: null,
		regionLine: null,
		divisionLine: null,
		districtLine: null,
	};
}

/** The three supplied legacy forms contain Hinigaran signatory examples. They
 * are a compatibility fallback only for that exact institution; no other
 * school inherits reference personal data. Explicit saved values always win. */
export function applyTemplateSignatoryFallback(profile: TeacherProgramSignatoryProfile, schoolName: string): TeacherProgramSignatoryProfile {
	if (schoolName.trim().toLocaleLowerCase() !== 'hinigaran national high school'.toLocaleLowerCase()) return profile;
	return {
		...profile,
		schoolHead: { ...profile.schoolHead, name: profile.schoolHead.name ?? 'JUDY ANN B. NONATO' },
		psds: { ...profile.psds, name: profile.psds.name ?? 'EMILIA L. ENGLIS' },
		cidChief: { ...profile.cidChief, name: profile.cidChief.name ?? 'ARCH. NELSON G. BEDAURE, PhD' },
		asds: { ...profile.asds, name: profile.asds.name ?? 'JULITO L. FELICANO, CESE' },
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
	officialSchoolName: true,
	headerLine: true,
	regionLine: true,
	divisionLine: true,
	districtLine: true,
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
	const row = await withPresentationSchemaGuard(() => db.teacherProgramPresentationRevision.findFirst({
		where: { schoolId: params.schoolId, schoolYearId: params.schoolYearId },
		orderBy: { revision: 'desc' },
		select: PROFILE_SELECT,
	}));
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
	const row = await withPresentationSchemaGuard(() => db.teacherProgramPresentationRevision.findFirst({
		where: {
			schoolId: params.schoolId,
			schoolYearId: params.schoolYearId,
			createdAt: { lte: publishedAt },
		},
		orderBy: { revision: 'desc' },
		select: PROFILE_SELECT,
	}));
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
		&& current.officialSchoolName === next.officialSchoolName
		&& current.headerLine === next.headerLine
		&& current.regionLine === next.regionLine
		&& current.divisionLine === next.divisionLine
		&& current.districtLine === next.districtLine
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
		officialSchoolName: (row.officialSchoolName as string | null) ?? null,
		headerLine: (row.headerLine as string | null) ?? null,
		regionLine: (row.regionLine as string | null) ?? null,
		divisionLine: (row.divisionLine as string | null) ?? null,
		districtLine: (row.districtLine as string | null) ?? null,
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

	const current = await withPresentationSchemaGuard(() => db.teacherProgramPresentationRevision.findFirst({
		where: { schoolId, schoolYearId },
		orderBy: { revision: 'desc' },
	}));
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
		const latest = await withPresentationSchemaGuard(() => tx.teacherProgramPresentationRevision.findFirst({
			where: { schoolId, schoolYearId },
			orderBy: { revision: 'desc' },
		}));
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

		const created = await withPresentationSchemaGuard(() => tx.teacherProgramPresentationRevision.create({
			data: {
				schoolId,
				schoolYearId,
				revision: nextRevision,
				...next,
				createdBy: actorId,
				auditId: audit.id,
			},
		}));

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
