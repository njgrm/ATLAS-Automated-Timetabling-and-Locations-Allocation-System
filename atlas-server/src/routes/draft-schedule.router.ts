/**
 * SMART-DRAFT-READ-S3 — companion read-only DRAFT schedule family.
 *
 * ## Why this exists
 * Before this router, a companion (AIMS/SMART) could read only the PUBLIC
 * published schedule family (`published-schedule.router.ts`). Draft reads were
 * JWT-only (`generation.router.ts` `/runs/latest/draft`, `/runs/:runId/draft`).
 * This router exposes a draft read that is safe for a machine consumer.
 *
 * ## The security model (fail-closed)
 * 1. **Authentication.** Every route requires a valid credential via
 *    `authenticateWithSystemToken` (ATLAS system token / integration key, or a
 *    valid ATLAS JWT). No credential → `401 NO_TOKEN`.
 * 2. **Explicit term.** `termIndex` is REQUIRED on every read and validated
 *    against the verified ordered-term contract, exactly like the published
 *    family (`academic-term.service.ts`). Missing → `400 TERM_INDEX_REQUIRED`;
 *    malformed → `400 INVALID_TERM_INDEX`; outside the contract →
 *    `400 TERM_INDEX_OUTSIDE_CONTRACT`; no verified contract →
 *    `409 TERM_STRUCTURE_UNAVAILABLE`; unresolved `active` →
 *    `409 TERM_SELECTION_REQUIRED`. Missing term identity never becomes Term 1.
 * 3. **Draft-only.** Only a `COMPLETED`, `runType: FULL`, UNPUBLISHED run is a
 *    draft. A published run is never served as a draft (`404 DRAFT_RUN_NOT_FOUND`)
 *    and can never be shared as one (`409 RUN_ALREADY_PUBLISHED`).
 * 4. **Explicit per-run sharing toggle (default OFF).** A run's draft is readable
 *    only while `summary.draftSharedWithTeachers === true`. Otherwise
 *    `403 DRAFT_SHARING_DISABLED`. The toggle is written by an authenticated
 *    scheduler (JWT + `timetable:edit` capability + actor-school scope) through
 *    `PATCH /generation/:schoolId/:schoolYearId/runs/:runId/draft-sharing`.
 * 5. **Scope is the route parameter plus the toggle.** `faculty-external` scopes
 *    entries to the named teacher; `sections` scopes to the named section. There
 *    is deliberately NO whole-run / whole-school read (locked decision D3). A
 *    caller can never read an arbitrary teacher's draft unless the run is
 *    explicitly shared. A caller whose identity is itself faculty-scoped (a
 *    resolvable faculty identity, non-scheduler role) can only read its OWN
 *    teacher draft even when shared — otherwise `403 CROSS_FACULTY_DENIED`.
 *
 * ## Payload
 * The producer is the existing `generation.service.getRunDraft` (`DraftReport`,
 * whose entries already carry a normalized `termIndex`). This router filters it
 * by the requested term and scope and wraps it with an additive `source`
 * provenance block. The published payload is NOT touched.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, authenticateWithSystemToken } from '../middleware/authenticate.js';
import { assertRequestSchoolScope, hasPrivilegedRole, requestHasCapability } from '../middleware/authorize.js';
import { getDataContext } from '../lib/data-context.js';
import { getRunDraft, type DraftReport } from '../services/generation.service.js';
import { isPublishedSummary } from '../services/manual-edit.service.js';
import {
	MAX_ACADEMIC_TERM_INDEX,
	isTermIndexWithinContract,
	loadVerifiedOrderedTermContract,
	parseSupportedTermIndex,
	type LoadedAcademicTermContract,
	type OrderedAcademicTerm,
} from '../services/academic-term.service.js';
import { resolveCanonicalFacultyFromAuthPayload } from '../services/faculty-identity.service.js';
import type { ScheduledEntry } from '../services/constraint-validator.js';
import type { AtlasCapability } from '../services/scheduler-capabilities.js';

const router = Router();
const db = () => getDataContext();

/** Roles that may read any shared draft / write the sharing toggle without a faculty-identity match. */
const SCHEDULER_PRINCIPAL_ROLES = new Set(['admin', 'officer', 'SYSTEM_ADMIN', 'scheduler']);

/** The additive run-summary flag. Absent/false means not shared. */
const DRAFT_SHARING_SUMMARY_FLAG = 'draftSharedWithTeachers';

type DraftError = Error & { statusCode: number; code: string; details?: Record<string, unknown> };

function draftError(statusCode: number, code: string, message: string, details?: Record<string, unknown>): DraftError {
	const error = new Error(message) as DraftError;
	error.statusCode = statusCode;
	error.code = code;
	error.details = details;
	return error;
}

function positiveInt(raw: unknown, name: string): number | string {
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return `${name} must be a positive integer.`;
	return n;
}

function readBoolean(raw: unknown): boolean | null {
	return typeof raw === 'boolean' ? raw : null;
}

/**
 * Local mirror of `generation.router.ts` `hasWorkspaceCapability`: capability
 * first, then a strict positive school parse, then actor-school equality, all
 * before any service dispatch. Rejection writes a typed response and returns
 * false with zero downstream reads/writes.
 */
function hasWorkspaceCapability(req: Request, res: Response, capability: AtlasCapability): boolean {
	if (!requestHasCapability(req, capability)) {
		res.status(403).json({ code: 'FORBIDDEN', message: `This generation action requires the ${capability} capability.` });
		return false;
	}
	const schoolId = positiveInt(req.params.schoolId, 'schoolId');
	if (typeof schoolId === 'string') {
		res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
		return false;
	}
	return assertRequestSchoolScope(req, res, schoolId);
}

type DraftRunRow = {
	id: number;
	status: string;
	runType: string;
	summary: unknown;
	version: number;
};

/**
 * The latest COMPLETED, FULL, UNPUBLISHED run for the scope is "the draft".
 * A performance fixture (`runType: PERFORMANCE_FIXTURE`) is never a draft, and a
 * published run is never a draft — both fail closed. Ordered deterministically.
 */
async function resolveLatestDraftRun(schoolId: number, schoolYearId: number): Promise<DraftRunRow> {
	const run = await db().generationRun.findFirst({
		where: { schoolId, schoolYearId, status: 'COMPLETED', runType: 'FULL' },
		orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
		select: { id: true, status: true, runType: true, summary: true, version: true },
	});
	if (!run) {
		throw draftError(404, 'DRAFT_RUN_NOT_FOUND', 'No completed draft run exists for this school year.');
	}
	if (isPublishedSummary(run.summary)) {
		throw draftError(404, 'DRAFT_RUN_NOT_FOUND', 'The current run for this school year is published, not a draft.', {
			reason: 'PUBLISHED_RUN_IS_NOT_A_DRAFT',
		});
	}
	return run;
}

type ResolvedDraftTerm = {
	termIndex: number;
	termScope: 'explicit' | 'active';
	contract: LoadedAcademicTermContract;
};

/**
 * Reuse the published term semantics: an explicit `termIndex` (1..4 or
 * `active`) is required and is validated against the verified ordered-term
 * contract. No new term semantics are invented; no term is clamped or defaulted.
 */
async function resolveRequiredDraftTerm(req: Request, schoolId: number, schoolYearId: number): Promise<ResolvedDraftTerm> {
	const raw = req.query.termIndex;
	if (raw == null || String(raw).trim() === '') {
		throw draftError(400, 'TERM_INDEX_REQUIRED', 'termIndex is required for a draft read; provide a numeric term (1..N) or "active".');
	}
	const value = String(raw).trim().toLowerCase();
	let requested: number | 'active';
	if (value === 'active') {
		requested = 'active';
	} else {
		const parsed = parseSupportedTermIndex(value);
		if (parsed === null) {
			throw draftError(400, 'INVALID_TERM_INDEX', `termIndex must be 1..${MAX_ACADEMIC_TERM_INDEX}, or "active".`);
		}
		requested = parsed;
	}

	const contract = await loadVerifiedOrderedTermContract(schoolId, schoolYearId);
	if (!contract) {
		throw draftError(409, 'TERM_STRUCTURE_UNAVAILABLE', 'No verified ordered term contract is available for this school year, so the requested term cannot be validated.');
	}
	if (requested === 'active') {
		if (contract.activeTermOrder == null) {
			throw draftError(409, 'TERM_SELECTION_REQUIRED', 'The active term is unresolved. Choose one ordered term.', {
				orderedTerms: contract.terms.map((term) => ({ ...term })),
			});
		}
		return { termIndex: contract.activeTermOrder, termScope: 'active', contract };
	}
	if (!isTermIndexWithinContract(requested, contract.terms)) {
		throw draftError(
			400,
			'TERM_INDEX_OUTSIDE_CONTRACT',
			`termIndex ${requested} is outside the verified ${contract.terms.length}-term ${contract.format} contract for this school year.`,
		);
	}
	return { termIndex: requested, termScope: 'explicit', contract };
}

function isDraftShared(run: DraftRunRow): boolean {
	return (run.summary as Record<string, unknown> | null)?.[DRAFT_SHARING_SUMMARY_FLAG] === true;
}

function assertDraftShared(run: DraftRunRow): void {
	if (!isDraftShared(run)) {
		throw draftError(403, 'DRAFT_SHARING_DISABLED', 'Draft sharing with teachers is disabled for this run.');
	}
}

async function resolveFacultyIdByExternalId(schoolId: number, externalFacultyId: number): Promise<number> {
	const mirror = await db().facultyMirror.findFirst({
		where: { schoolId, externalId: externalFacultyId },
		select: { id: true },
	});
	if (!mirror) {
		throw draftError(404, 'FACULTY_NOT_FOUND', `No faculty member with external ID ${externalFacultyId} found for school ${schoolId}.`);
	}
	return mirror.id;
}

/**
 * A non-scheduler principal must resolve to the requested teacher. A scheduler /
 * officer / system-token principal (the companion machine path) is exempt.
 */
async function assertFacultyReadScope(req: Request, schoolId: number, schoolYearId: number, targetFacultyId: number): Promise<void> {
	if (hasPrivilegedRole(req.user?.role) || SCHEDULER_PRINCIPAL_ROLES.has(req.user?.role ?? '')) return;
	const identity = await resolveCanonicalFacultyFromAuthPayload(req.user, { schoolId, schoolYearId });
	if (!identity || identity.faculty.id !== targetFacultyId) {
		throw draftError(403, 'CROSS_FACULTY_DENIED', 'A teacher may only read their own draft schedule.');
	}
}

function applyScopeFilter(entries: ScheduledEntry[], filter: { facultyId?: number; sectionId?: number }): ScheduledEntry[] {
	if (filter.facultyId !== undefined) {
		return entries.filter((entry) => entry.facultyId === filter.facultyId);
	}
	if (filter.sectionId !== undefined) {
		const sectionId = filter.sectionId;
		return entries.filter(
			(entry) => entry.sectionId === sectionId || (entry.cohortMemberSectionIds?.includes(sectionId) ?? false),
		);
	}
	return entries;
}

type DraftSchedulePayload = {
	source: {
		runId: number;
		schoolId: number;
		schoolYearId: number;
		termScope: 'explicit' | 'active';
		termIndex: number;
		orderedTerms: OrderedAcademicTerm[];
		isDraft: true;
		runStatus: string;
		draftSharedWithTeachers: true;
		inputFingerprint: string | null;
		inputStateStatus: string | null;
	};
	entries: ScheduledEntry[];
	unassignedItems: unknown[];
	summary: unknown;
	inputState: unknown;
	version: number;
	finishedAt: string | null;
	createdAt: string;
	status: string;
	runId: number;
};

function buildDraftPayload(
	args: {
		schoolId: number;
		schoolYearId: number;
		run: DraftRunRow;
		term: ResolvedDraftTerm;
		filter: { facultyId?: number; sectionId?: number };
	},
	report: DraftReport,
): DraftSchedulePayload {
	const scopedEntries = applyScopeFilter(report.entries, args.filter);

	// Missing term identity is unresolved authority. A term-filtered read over
	// entries without termIndex fails closed instead of silently dropping or
	// coercing rows (mirrors the published family's `TERM_FILTER_NOT_READY`).
	if (scopedEntries.some((entry) => entry.termIndex == null)) {
		throw draftError(501, 'TERM_FILTER_NOT_READY', 'Some entries lack reliable termIndex. Term-filtered draft reads are not available until every entry has termIndex.');
	}

	const entries = scopedEntries.filter((entry) => entry.termIndex === args.term.termIndex);

	return {
		source: {
			runId: args.run.id,
			schoolId: args.schoolId,
			schoolYearId: args.schoolYearId,
			termScope: args.term.termScope,
			termIndex: args.term.termIndex,
			orderedTerms: args.term.contract.terms.map((term) => ({ ...term })),
			isDraft: true,
			runStatus: args.run.status,
			draftSharedWithTeachers: true,
			inputFingerprint: report.inputState?.runFingerprint ?? null,
			inputStateStatus: report.inputState?.status ?? null,
		},
		entries,
		// Unassigned demand is run-wide and not attributable to one teacher or
		// section. This family exposes only scoped reads (D3: never a whole-school
		// draft), so a scoped response never carries the run-wide unassigned set.
		unassignedItems: [],
		summary: report.summary,
		inputState: report.inputState,
		version: report.version,
		finishedAt: report.finishedAt,
		createdAt: report.createdAt,
		status: report.status,
		runId: report.runId,
	};
}

type DraftReadScope = 'faculty' | 'section';

/** Shared handler for the three read routes: parse, validate, resolve, project. */
function createDraftReadHandler(scope: DraftReadScope) {
	return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const filter: { facultyId?: number; sectionId?: number } = {};
			if (scope === 'faculty') {
				const externalFacultyId = positiveInt(req.params.externalFacultyId, 'externalFacultyId');
				if (typeof externalFacultyId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: externalFacultyId }); return; }
				filter.facultyId = await resolveFacultyIdByExternalId(schoolId, externalFacultyId);
			} else if (scope === 'section') {
				const sectionId = positiveInt(req.params.sectionId, 'sectionId');
				if (typeof sectionId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: sectionId }); return; }
				filter.sectionId = sectionId;
			}

			const term = await resolveRequiredDraftTerm(req, schoolId, schoolYearId);
			const run = await resolveLatestDraftRun(schoolId, schoolYearId);
			assertDraftShared(run);
			if (scope === 'faculty') {
				await assertFacultyReadScope(req, schoolId, schoolYearId, filter.facultyId!);
			}

			const report = await getRunDraft(run.id, schoolId, schoolYearId);
			res.json(buildDraftPayload({ schoolId, schoolYearId, run, term, filter }, report));
		} catch (error) {
			next(error);
		}
	};
}

// ─── Draft read family (read-only, term-scoped, sharing-gated) ───

router.get(
	'/schools/:schoolId/school-years/:schoolYearId/schedules/draft/faculty-external/:externalFacultyId',
	authenticateWithSystemToken,
	createDraftReadHandler('faculty'),
);

router.get(
	'/schools/:schoolId/school-years/:schoolYearId/schedules/draft/sections/:sectionId',
	authenticateWithSystemToken,
	createDraftReadHandler('section'),
);

// D3 (locked): there is deliberately NO whole-run / whole-school draft read.
// A run-wide route would expose every teacher's draft in one response, which D3
// forbids. Only the param-scoped reads above exist, both gated by the per-run
// sharing toggle (default OFF); see §8A of the companion contract.

// ─── Per-run "share draft with teachers" toggle (default OFF) ───

/**
 * Write the additive run-summary sharing flag with a version CAS so a
 * concurrent generation/manual edit cannot be clobbered and this toggle cannot
 * be silently lost. The flag change and its audit row commit together.
 */
router.patch(
	'/generation/:schoolId/:schoolYearId/runs/:runId/draft-sharing',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!hasWorkspaceCapability(req, res, 'timetable:edit')) return;

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const runId = positiveInt(req.params.runId, 'runId');
			if (typeof runId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: runId }); return; }

			const enabled = readBoolean(req.body?.enabled);
			if (enabled === null) {
				res.status(400).json({ code: 'INVALID_BODY', message: 'enabled must be a boolean.' });
				return;
			}
			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }

			const run = await db().generationRun.findFirst({
				where: { id: runId, schoolId, schoolYearId },
				select: { id: true, status: true, runType: true, summary: true, version: true },
			});
			if (!run) {
				res.status(404).json({ code: 'DRAFT_RUN_NOT_FOUND', message: 'Generation run not found in this school/year scope.' });
				return;
			}
			if (isPublishedSummary(run.summary)) {
				res.status(409).json({
					code: 'RUN_ALREADY_PUBLISHED',
					message: 'A published run is not a draft and cannot be shared with teachers.',
				});
				return;
			}
			if (run.runType !== 'FULL' || run.status !== 'COMPLETED') {
				res.status(409).json({
					code: 'DRAFT_SHARING_UNAVAILABLE',
					message: 'Draft sharing is only available for a completed official (FULL) run.',
				});
				return;
			}

			const current = isDraftShared(run as DraftRunRow);
			if (current === enabled) {
				res.json({ runId, enabled, changed: false, version: run.version });
				return;
			}

			const nextSummary = {
				...((run.summary as Record<string, unknown> | null) ?? {}),
				[DRAFT_SHARING_SUMMARY_FLAG]: enabled,
			};
			const nextVersion = await db().$transaction(async (tx: any) => {
				const updated = await tx.generationRun.updateMany({
					where: { id: runId, schoolId, schoolYearId, version: run.version },
					data: { summary: nextSummary as object, version: { increment: 1 } },
				});
				if (updated.count !== 1) {
					throw draftError(409, 'DRAFT_SHARING_CONFLICT', 'The run changed while draft sharing was being updated. Re-read the run and retry.');
				}
				await tx.auditLog.create({
					data: {
						schoolId,
						schoolYearId,
						action: enabled ? 'DRAFT_SHARING_ENABLED' : 'DRAFT_SHARING_DISABLED',
						actorId,
						targetIds: [runId],
						metadata: { enabled } as object,
					},
				});
				return run.version + 1;
			});

			res.json({ runId, enabled, changed: true, version: nextVersion });
		} catch (error) {
			next(error);
		}
	},
);

export default router;
