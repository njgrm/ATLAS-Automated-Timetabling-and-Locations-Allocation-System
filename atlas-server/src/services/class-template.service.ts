/**
 * Class Template Service
 *
 * Manages configurable class templates per school. Each template defines:
 * - The program type (REGULAR, STE, SPA, etc.)
 * - Period structure (period length in minutes, periods per day)
 * - Subject bundle (which subjects belong to this class type)
 *
 * Templates replace the previously hardcoded STE/SPA subject inference.
 * Schools can clone, customize, and extend templates without changing core logic.
 *
 * AUTHZ-CLASS-TEMPLATE-C07: this module is actor-school scoped. Reads and writes
 * are bound to the verified actor school supplied by the router; no function here
 * defaults a school, and default-template creation is reachable only through the
 * explicit `initializeDefaultTemplatesForSchool` command. No GET path writes.
 */

import { getDataContext } from '../lib/data-context.js';
import type { Prisma, PrismaClient, ProgramType } from '@prisma/client';

const db = () => getDataContext();

// ─── Default templates seeded per school ───

interface DefaultTemplateSpec {
	name: string;
	label: string;
	programType: ProgramType;
	gradeApplicability: number[];
	periodLengthMinutes: number;
	periodsPerDay: number;
	isDefault: boolean;
	// Subject codes belonging to this template
	subjectCodes: string[];
}

const DEFAULT_TEMPLATE_SPECS: DefaultTemplateSpec[] = [
	{
		name: 'Regular BEC',
		label: 'Regular',
		programType: 'REGULAR',
		gradeApplicability: [7, 8, 9, 10],
		periodLengthMinutes: 60,
		periodsPerDay: 8,
		isDefault: true,
		subjectCodes: ['FIL', 'ENG', 'MATH', 'AP', 'MAPEH', 'ESP', 'HG', 'SCI_BIO', 'SCI_CHEM', 'SCI_ES', 'TLE_ICT_EXP', 'TLE_AFA_EXP', 'TLE_FCS_EXP'],
	},
	{
		name: 'Science, Technology & Engineering',
		label: 'STE',
		programType: 'STE',
		gradeApplicability: [7, 8, 9, 10],
		periodLengthMinutes: 45,
		periodsPerDay: 10,
		isDefault: false,
		subjectCodes: ['FIL', 'ENG', 'MATH', 'AP', 'MAPEH', 'ESP', 'HG', 'SCI_BIO', 'SCI_CHEM', 'SCI_ES', 'TLE_ICT_EXP', 'TLE_AFA_EXP', 'TLE_FCS_EXP', 'STE_ENV_SCI', 'STE_BIOTECH', 'STE_APPLIED_CHEM', 'STE_APPLIED_PHYS', 'STE_ROBOTICS', 'STE_RESEARCH'],
	},
	{
		name: 'Special Program in the Arts',
		label: 'SPA',
		programType: 'SPA',
		gradeApplicability: [7, 8, 9, 10],
		periodLengthMinutes: 45,
		periodsPerDay: 10,
		isDefault: false,
		subjectCodes: ['FIL', 'ENG', 'MATH', 'AP', 'MAPEH', 'ESP', 'HG', 'SCI_BIO', 'SCI_CHEM', 'SCI_ES', 'TLE_ICT_EXP', 'TLE_AFA_EXP', 'TLE_FCS_EXP', 'SPA_SPEC', 'DEVL_READING'],
	},
	{
		name: 'Special Program in Sports',
		label: 'SPS',
		programType: 'SPS',
		gradeApplicability: [7, 8, 9, 10],
		periodLengthMinutes: 45,
		periodsPerDay: 10,
		isDefault: false,
		subjectCodes: ['FIL', 'ENG', 'MATH', 'AP', 'MAPEH', 'ESP', 'HG', 'SCI_BIO', 'SCI_CHEM', 'SCI_ES', 'TLE_ICT_EXP', 'TLE_AFA_EXP', 'TLE_FCS_EXP', 'SPS_SPEC', 'DEVL_READING'],
	},
];

// ─── Shared projections ───

const TEMPLATE_INCLUDE = {
	subjectBindings: {
		include: {
			subject: {
				select: { id: true, code: true, name: true, programScopes: true },
			},
		},
	},
} as const;

const TEMPLATE_ORDER_BY: Prisma.ClassTemplateOrderByWithRelationInput[] = [{ isDefault: 'desc' }, { name: 'asc' }];

/** Structural row shape shared by every scoped template projection. */
interface TemplateRow {
	id: number;
	schoolId: number;
	name: string;
	label: string;
	programType: ProgramType;
	gradeApplicability: number[];
	periodLengthMinutes: number;
	periodsPerDay: number;
	isActive: boolean;
	isDefault: boolean;
	createdAt: Date;
	updatedAt: Date;
	subjectBindings: Array<{
		subject: {
			id: number;
			code: string;
			name: string;
			programScopes: ProgramType[];
		};
	}>;
}

export interface ClassTemplateWithSubjects {
	id: number;
	schoolId: number;
	name: string;
	label: string;
	programType: ProgramType;
	gradeApplicability: number[];
	periodLengthMinutes: number;
	periodsPerDay: number;
	isActive: boolean;
	isDefault: boolean;
	createdAt: Date;
	updatedAt: Date;
	subjects: Array<{
		id: number;
		code: string;
		name: string;
		programScopes: ProgramType[];
	}>;
}

export interface TemplatePeriodProfile {
	programType: ProgramType;
	periodLengthMinutes: number;
	periodsPerDay: number;
}

function toClassTemplate(t: TemplateRow): ClassTemplateWithSubjects {
	return {
		id: t.id,
		schoolId: t.schoolId,
		name: t.name,
		label: t.label,
		programType: t.programType,
		gradeApplicability: t.gradeApplicability,
		periodLengthMinutes: t.periodLengthMinutes,
		periodsPerDay: t.periodsPerDay,
		isActive: t.isActive,
		isDefault: t.isDefault,
		createdAt: t.createdAt,
		updatedAt: t.updatedAt,
		subjects: t.subjectBindings.map((b) => b.subject),
	};
}

/**
 * Discriminated result for an actor-school scoped template operation.
 * `CROSS_SCHOOL` never carries a payload: the foreign row is never projected.
 */
export type TemplateScopeResult =
	| { ok: true; template: ClassTemplateWithSubjects }
	| { ok: false; reason: 'NOT_FOUND' | 'CROSS_SCHOOL' };

// ─── Default-template initialization command ───

export interface EnsureDefaultTemplatesResult {
	createdProgramTypes: ProgramType[];
	createdIds: number[];
}

/**
 * Create the missing default class templates for `schoolId`.
 *
 * This is a WRITE helper and is reachable only from
 * `initializeDefaultTemplatesForSchool`. It is never called from a read path.
 * An optional interactive `client` binds the call to the caller's transaction.
 */
export async function ensureDefaultTemplates(
	schoolId: number,
	client: Prisma.TransactionClient | PrismaClient = db(),
): Promise<EnsureDefaultTemplatesResult> {
	const createdProgramTypes: ProgramType[] = [];
	const createdIds: number[] = [];

	for (const spec of DEFAULT_TEMPLATE_SPECS) {
		const existing = await client.classTemplate.findUnique({
			where: {
				schoolId_programType: { schoolId, programType: spec.programType },
			},
		});
		if (existing) {
			continue;
		}

		// Resolve subject IDs from codes for this school
		const subjects = await client.subject.findMany({
			where: { schoolId, code: { in: spec.subjectCodes }, isActive: true },
			select: { id: true, code: true },
		});
		const bindingRows = subjects.map((s) => ({ subjectId: s.id }));

		const created = await client.classTemplate.create({
			data: {
				schoolId,
				name: spec.name,
				label: spec.label,
				programType: spec.programType,
				gradeApplicability: spec.gradeApplicability,
				periodLengthMinutes: spec.periodLengthMinutes,
				periodsPerDay: spec.periodsPerDay,
				isActive: true,
				isDefault: spec.isDefault,
				subjectBindings: {
					create: bindingRows,
				},
			},
			select: { id: true },
		});

		createdProgramTypes.push(spec.programType);
		createdIds.push(created.id);
	}

	return { createdProgramTypes, createdIds };
}

export interface InitializeDefaultTemplatesResult {
	templates: ClassTemplateWithSubjects[];
	createdProgramTypes: ProgramType[];
	createdCount: number;
	idempotent: boolean;
}

/**
 * Explicit, audited, idempotent default-template initialization command.
 *
 * The whole command runs in ONE interactive transaction: the creates, the
 * exactly-one audit row, and the projected read are atomic. A replay creates
 * zero templates, reports `createdCount: 0` / `idempotent: true`, and still
 * writes exactly one audit row for that invocation. Any failure rolls back the
 * template rows and the audit row together.
 */
export async function initializeDefaultTemplatesForSchool(
	schoolId: number,
	actorId: number,
): Promise<InitializeDefaultTemplatesResult> {
	return db().$transaction(async (tx: Prisma.TransactionClient) => {
		const created = await ensureDefaultTemplates(schoolId, tx);
		const idempotent = created.createdIds.length === 0;

		const templates = await tx.classTemplate.findMany({
			where: { schoolId },
			include: TEMPLATE_INCLUDE,
			orderBy: TEMPLATE_ORDER_BY,
		});

		await tx.auditLog.create({
			data: {
				schoolId,
				schoolYearId: null,
				action: 'CLASS_TEMPLATE_INITIALIZE',
				actorId,
				targetIds: created.createdIds,
				metadata: {
					createdProgramTypes: created.createdProgramTypes,
					createdCount: created.createdIds.length,
					idempotent,
					source: 'class-template.initialize',
				},
			},
		});

		return {
			templates: templates.map(toClassTemplate),
			createdProgramTypes: created.createdProgramTypes,
			createdCount: created.createdIds.length,
			idempotent,
		};
	});
}

/**
 * Ensure templates exist for all program types found in fetched sections.
 *
 * NOTE: currently has ZERO production callers (unreachable export, retained
 * intentionally). It is not wired to any route and must never be called from a
 * GET path.
 */
export async function ensureTemplatesForProgramTypes(
	schoolId: number,
	programTypes: ProgramType[],
): Promise<{ seeded: ProgramType[] }> {
	const seeded: ProgramType[] = [];
	const unique = [...new Set(programTypes)];

	for (const programType of unique) {
		const existing = await db().classTemplate.findUnique({
			where: { schoolId_programType: { schoolId, programType } },
		});
		if (existing) continue;

		// Try matching against the known default spec first
		const spec = DEFAULT_TEMPLATE_SPECS.find((s) => s.programType === programType);

		if (spec) {
			const subjects = await db().subject.findMany({
				where: { schoolId, code: { in: spec.subjectCodes } },
				select: { id: true },
			});
			await db().classTemplate.create({
				data: {
					schoolId,
					name: spec.name,
					label: spec.label,
					programType,
					gradeApplicability: spec.gradeApplicability,
					periodLengthMinutes: spec.periodLengthMinutes,
					periodsPerDay: spec.periodsPerDay,
					isActive: true,
					isDefault: spec.isDefault,
					subjectBindings: {
						create: subjects.map((s) => ({ subjectId: s.id })),
					},
				},
			});
		} else {
			// Unknown / less common program type — seed a minimal placeholder
			// with the same period structure as REGULAR so generation doesn't stall.
			// Officers can customize the template afterward.
			const regularSubjects = await db().subject.findMany({
				where: {
					schoolId,
					programScopes: { has: 'REGULAR' },
					isActive: true,
				},
				select: { id: true },
			});
			await db().classTemplate.create({
				data: {
					schoolId,
					name: programType,
					label: programType,
					programType,
					gradeApplicability: [7, 8, 9, 10],
					periodLengthMinutes: 45,
					periodsPerDay: 10,
					isActive: true,
					isDefault: false,
					subjectBindings: {
						create: regularSubjects.map((s) => ({ subjectId: s.id })),
					},
				},
			});
		}

		seeded.push(programType);
		console.log(`[class-template] Auto-seeded template for programType=${programType} schoolId=${schoolId}`);
	}

	return { seeded };
}

// ─── Reads (actor-school scoped, zero writes) ───

export async function getTemplatesBySchool(schoolId: number): Promise<ClassTemplateWithSubjects[]> {
	const templates = await db().classTemplate.findMany({
		where: { schoolId },
		include: TEMPLATE_INCLUDE,
		orderBy: TEMPLATE_ORDER_BY,
	});

	return templates.map(toClassTemplate);
}

/**
 * School-scoped template read. A foreign row is never returned: the query is
 * bound to `schoolId` so a cross-school caller sees the same `null` as an
 * absent id, and the router discriminates 403 from 404 with
 * `probeTemplateOwnerSchoolId`.
 */
export async function getTemplateByIdForSchool(
	id: number,
	schoolId: number,
): Promise<ClassTemplateWithSubjects | null> {
	const t = await db().classTemplate.findFirst({
		where: { id, schoolId },
		include: TEMPLATE_INCLUDE,
	});
	if (!t) return null;
	return toClassTemplate(t);
}

/**
 * Minimal existence probe used only to discriminate 403 (foreign owner) from
 * 404 (absent). It selects identifiers only — never a payload — so a cross-
 * school caller learns nothing about the foreign row's contents.
 */
export async function probeTemplateOwnerSchoolId(id: number): Promise<number | null> {
	const row = await db().classTemplate.findUnique({
		where: { id },
		select: { id: true, schoolId: true },
	});
	return row ? row.schoolId : null;
}

// ─── Writes (actor-school scoped, owner check inside the write transaction) ───

/**
 * AUTHZ-CLASS-TEMPLATE-C07R1 — subject-bundle tenant binding.
 *
 * `ClassTemplateSubject` carries no `schoolId`, so nothing at the database layer
 * stops a school-A template from binding a school-B `subjectId`. Because
 * `TEMPLATE_INCLUDE` projects the subject `code`/`name`, such a binding would
 * disclose another school's subject catalog through the actor's own
 * `GET /class-templates?schoolId=<actor>`.
 *
 * Called INSIDE the same interactive transaction as the write, before any
 * `classTemplate` / `classTemplateSubject` mutation:
 *  - a requested id owned by ANOTHER school -> typed 403 `CROSS_SCHOOL_DENIED`;
 *  - a requested id that does not exist at all -> typed 400 `INVALID_PARAM`;
 *  - any non-positive-integer id -> typed 400 `INVALID_PARAM`.
 * Both rejections leave zero writes.
 */
async function assertSubjectsBelongToSchool(
	tx: Prisma.TransactionClient,
	schoolId: number,
	subjectIds: number[],
): Promise<void> {
	if (subjectIds.length === 0) return;

	const requested = [...new Set(subjectIds)];
	const malformed = requested.filter((id) => !Number.isInteger(id) || id <= 0);
	if (malformed.length > 0) {
		throw Object.assign(
			new Error('subjectIds must contain positive integer subject ids.'),
			{ statusCode: 400, code: 'INVALID_PARAM' },
		);
	}

	// Scoped resolution: only ids owned by the actor school are acceptable.
	const scoped = await tx.subject.findMany({
		where: { id: { in: requested }, schoolId },
		select: { id: true },
	});
	const ownedIds = new Set(scoped.map((subject) => subject.id));
	const unresolved = requested.filter((id) => !ownedIds.has(id));
	if (unresolved.length === 0) return;

	// Identifier-only probe (never a payload) to tell "another school's subject"
	// apart from "no such subject".
	const existingElsewhere = await tx.subject.findMany({
		where: { id: { in: unresolved } },
		select: { id: true },
	});
	if (existingElsewhere.length > 0) {
		throw Object.assign(
			new Error('Cannot bind another school\u2019s subjects to this class template.'),
			{ statusCode: 403, code: 'CROSS_SCHOOL_DENIED' },
		);
	}
	throw Object.assign(
		new Error('subjectIds contains one or more subjects that do not exist.'),
		{ statusCode: 400, code: 'INVALID_PARAM' },
	);
}

/**
 * Create a template owned by `schoolId` with an optional actor-school subject
 * bundle. The subject tenant binding and the create run in ONE interactive
 * transaction: a foreign subject throws a typed 403 and an unknown subject
 * throws a typed 400, both with zero `classTemplate` / `classTemplateSubject`
 * writes.
 */
export async function createTemplate(
	schoolId: number,
	data: {
		name: string;
		label: string;
		programType: ProgramType;
		gradeApplicability: number[];
		periodLengthMinutes: number;
		periodsPerDay: number;
		subjectIds?: number[];
	},
): Promise<ClassTemplateWithSubjects> {
	// Validate: no empty period structure
	if (data.periodLengthMinutes <= 0 || data.periodsPerDay <= 0) {
		throw Object.assign(
			new Error('periodLengthMinutes and periodsPerDay must be positive integers.'),
			{ statusCode: 400, code: 'INVALID_PERIOD_STRUCTURE' },
		);
	}

	const subjectIds = data.subjectIds ?? [];

	// One interactive transaction: the subject-scope validation and the create
	// share a single snapshot, so a subject cannot move school between the check
	// and the binding write.
	const t = await db().$transaction(async (tx: Prisma.TransactionClient) => {
		await assertSubjectsBelongToSchool(tx, schoolId, subjectIds);

		return tx.classTemplate.create({
			data: {
				schoolId,
				name: data.name,
				label: data.label,
				programType: data.programType,
				gradeApplicability: data.gradeApplicability,
				periodLengthMinutes: data.periodLengthMinutes,
				periodsPerDay: data.periodsPerDay,
				isActive: true,
				isDefault: false,
				subjectBindings: subjectIds.length
					? { create: subjectIds.map((sid) => ({ subjectId: sid })) }
					: undefined,
			},
			include: TEMPLATE_INCLUDE,
		});
	});

	return toClassTemplate(t);
}

/**
 * Actor-school scoped metadata update.
 *
 * The owning-school check runs INSIDE one interactive transaction together with
 * the update (no TOCTOU): a foreign template returns `CROSS_SCHOOL`, an absent
 * template returns `NOT_FOUND`, and both leave zero writes. The update predicate
 * also carries `schoolId` so the row can never be retargeted across schools.
 * Existing typed 400s (`INVALID_PERIOD_LENGTH`, `INVALID_PERIODS_PER_DAY`) are
 * preserved.
 */
export async function updateTemplateForSchool(
	id: number,
	schoolId: number,
	data: Partial<{
		name: string;
		label: string;
		gradeApplicability: number[];
		periodLengthMinutes: number;
		periodsPerDay: number;
		isActive: boolean;
	}>,
): Promise<TemplateScopeResult> {
	return db().$transaction(async (tx: Prisma.TransactionClient) => {
		const existing = await tx.classTemplate.findUnique({
			where: { id },
			select: { id: true, schoolId: true },
		});
		if (!existing) return { ok: false, reason: 'NOT_FOUND' } as const;
		if (existing.schoolId !== schoolId) return { ok: false, reason: 'CROSS_SCHOOL' } as const;

		if (data.periodLengthMinutes !== undefined && data.periodLengthMinutes <= 0) {
			throw Object.assign(
				new Error('periodLengthMinutes must be a positive integer.'),
				{ statusCode: 400, code: 'INVALID_PERIOD_LENGTH' },
			);
		}
		if (data.periodsPerDay !== undefined && data.periodsPerDay <= 0) {
			throw Object.assign(
				new Error('periodsPerDay must be a positive integer.'),
				{ statusCode: 400, code: 'INVALID_PERIODS_PER_DAY' },
			);
		}

		const updateData: Record<string, unknown> = {};
		if (data.name !== undefined) updateData.name = data.name;
		if (data.label !== undefined) updateData.label = data.label;
		if (data.gradeApplicability !== undefined) updateData.gradeApplicability = data.gradeApplicability;
		if (data.periodLengthMinutes !== undefined) updateData.periodLengthMinutes = data.periodLengthMinutes;
		if (data.periodsPerDay !== undefined) updateData.periodsPerDay = data.periodsPerDay;
		if (data.isActive !== undefined) updateData.isActive = data.isActive;

		const t = await tx.classTemplate.update({
			where: { id, schoolId },
			data: updateData,
			include: TEMPLATE_INCLUDE,
		});

		return { ok: true, template: toClassTemplate(t) } as const;
	});
}

/**
 * Replace the subject bundle for an actor-school owned template.
 *
 * Removes all existing bindings and creates the new set. The owning-school
 * verification, the subject tenant binding, and the binding replacement happen
 * in ONE interactive transaction (no TOCTOU): a foreign template returns
 * `CROSS_SCHOOL`, an absent template returns `NOT_FOUND`, a foreign subject
 * throws a typed 403, and an unknown subject throws a typed 400 — in every
 * rejection case zero `classTemplateSubject` rows are touched.
 */
export async function setTemplateSubjectsForSchool(
	templateId: number,
	schoolId: number,
	subjectIds: number[],
): Promise<TemplateScopeResult> {
	if (subjectIds.length === 0) {
		throw Object.assign(
			new Error('A class template must have at least one subject in its bundle.'),
			{ statusCode: 400, code: 'EMPTY_SUBJECT_BUNDLE' },
		);
	}

	return db().$transaction(async (tx: Prisma.TransactionClient) => {
		const existing = await tx.classTemplate.findUnique({
			where: { id: templateId },
			select: { id: true, schoolId: true },
		});
		if (!existing) return { ok: false, reason: 'NOT_FOUND' } as const;
		if (existing.schoolId !== schoolId) return { ok: false, reason: 'CROSS_SCHOOL' } as const;

		// Tenant binding: every requested subject must belong to the actor school
		// before any binding row is touched.
		await assertSubjectsBelongToSchool(tx, schoolId, subjectIds);

		await tx.classTemplateSubject.deleteMany({ where: { templateId } });
		await tx.classTemplateSubject.createMany({
			data: subjectIds.map((subjectId) => ({ templateId, subjectId })),
		});

		const t = await tx.classTemplate.findUnique({
			where: { id: templateId },
			include: TEMPLATE_INCLUDE,
		});
		if (!t) return { ok: false, reason: 'NOT_FOUND' } as const;
		return { ok: true, template: toClassTemplate(t) } as const;
	});
}

/**
 * Get period profiles for all active templates in a school.
 * Used by the schedule constructor to determine period length per program type.
 *
 * `client` defaults to the ambient data context so existing callers are
 * unchanged; a transaction-consistent caller may pass its interactive
 * transaction client to bind the read to one snapshot.
 */
export async function getTemplatePeriodProfiles(
	schoolId: number,
	client: Prisma.TransactionClient | PrismaClient = db(),
): Promise<TemplatePeriodProfile[]> {
	const templates = await client.classTemplate.findMany({
		where: { schoolId, isActive: true },
		select: { programType: true, periodLengthMinutes: true, periodsPerDay: true },
	});

	return templates.map((t) => ({
		programType: t.programType,
		periodLengthMinutes: t.periodLengthMinutes,
		periodsPerDay: t.periodsPerDay,
	}));
}

/**
 * Get the set of subject IDs that belong to a template for a given program type.
 * Used for subject filtering during demand construction.
 */
export async function getTemplateSubjectIds(
	schoolId: number,
	programType: ProgramType,
): Promise<Set<number> | null> {
	const template = await db().classTemplate.findUnique({
		where: {
			schoolId_programType: { schoolId, programType },
		},
		include: {
			subjectBindings: { select: { subjectId: true } },
		},
	});

	if (!template || !template.isActive) return null;
	return new Set(template.subjectBindings.map((b) => b.subjectId));
}
