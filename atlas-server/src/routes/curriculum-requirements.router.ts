import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import * as termConfigService from '../services/term-config.service.js';
import * as offeringService from '../services/school-year-offering.service.js';
import * as decisionCandidatesService from '../services/curriculum-decision-candidates.service.js';

const router = Router();

/**
 * SCA-02/02R — Curriculum Requirements routes (ATLAS-owned current-year authority).
 *
 * Transport only: every business rule lives in
 * `school-year-offering.service.ts` / `term-config.service.ts` /
 * `school-year-authority.service.ts`.
 * All scopes derive from the authenticated actor's school; a present but
 * invalid body schoolId is rejected, never silently accepted. Nothing here
 * calls EnrollPro offering endpoints: required subjects are
 * operator-persisted ATLAS truth. Teaching Load and generation consumers
 * are untouched — they switch demand authority only in SCA-04.
 */

function resolveActorSchoolId(req: Request): number {
	const schoolId = Number(req.user?.schoolId);
	if (!Number.isInteger(schoolId) || schoolId <= 0) {
		return 0;
	}
	return schoolId;
}

function resolveActorId(req: Request): number | null {
	const actorId = Number(req.user?.userId);
	return Number.isInteger(actorId) && actorId > 0 ? actorId : null;
}

function resolveSchoolYearId(req: Request, res: Response): number | null {
	const schoolYearId = Number(req.params.schoolYearId);
	if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId path parameter must be a positive integer.' });
		return null;
	}
	return schoolYearId;
}

function requireActorSchool(req: Request, res: Response): number | null {
	const actorSchoolId = resolveActorSchoolId(req);
	if (!actorSchoolId) {
		res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required.' });
		return null;
	}
	return actorSchoolId;
}

/** Reject unknown top-level body fields before any business logic runs. */
function rejectUnknownBodyFields(body: unknown, allowed: Set<string>, what: string, res: Response): boolean {
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		res.status(400).json({ code: 'INVALID_PARAM', message: `${what} must be a JSON object.` });
		return true;
	}
	const unknown = Object.keys(body as Record<string, unknown>).filter((k) => !allowed.has(k));
	if (unknown.length > 0) {
		res.status(400).json({ code: 'UNKNOWN_FIELD', message: `${what} contains unknown field(s): ${unknown.join(', ')}.` });
		return true;
	}
	return false;
}

/**
 * Strict optional-id parsing. Absent (null/undefined) → null. A present but
 * non-integer value → undefined (invalid), so the whole input is rejected
 * with 400 before any Prisma call. Bare Number() coercion would let NaN
 * reach the database layer as an untyped 500.
 */
function parseOptionalId(value: unknown): number | null | undefined {
	if (value === null || value === undefined) return null;
	const n = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);
	if (!Number.isInteger(n) || (n as number) <= 0) return undefined;
	return n as number;
}

/**
 * SCA-02R strict input shaping. No coercion: term identities must already
 * be strings (never String()-mapped), rotation metadata must already be
 * correctly typed, and unknown fields reject. Returns null when the input
 * is malformed; the service owns semantic validation.
 */
function toOfferingInput(raw: unknown): offeringService.OfferingInput | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const o = raw as Record<string, unknown>;
	for (const key of Object.keys(o)) {
		if (!offeringService.KNOWN_OFFERING_FIELDS.has(key)) return null;
	}
	if (typeof o.gradeLevel !== 'number' || typeof o.programType !== 'string') return null;
	if (typeof o.classification !== 'string' || typeof o.weeklyMinutes !== 'number') return null;
	if (typeof o.termMode !== 'string' || !Array.isArray(o.termIdentities)) return null;
	if (o.termIdentities.some((t) => typeof t !== 'string')) return null;
	const subjectId = parseOptionalId(o.subjectId);
	const sectionMirrorId = parseOptionalId(o.sectionMirrorId);
	const cohortId = parseOptionalId(o.cohortId);
	if (subjectId === undefined || sectionMirrorId === undefined || cohortId === undefined) return null;
	if (o.rotationFamily !== undefined && o.rotationFamily !== null && typeof o.rotationFamily !== 'string') return null;
	if (o.rotationOrder !== undefined && o.rotationOrder !== null && typeof o.rotationOrder !== 'number') return null;
	return {
		subjectId,
		gradeLevel: o.gradeLevel,
		programType: o.programType as offeringService.OfferingInput['programType'],
		sectionMirrorId,
		cohortId,
		classification: o.classification as offeringService.OfferingInput['classification'],
		weeklyMinutes: o.weeklyMinutes,
		rotationFamily: (o.rotationFamily as string | null | undefined) ?? null,
		rotationOrder: (o.rotationOrder as number | null | undefined) ?? null,
		termMode: o.termMode as offeringService.OfferingInput['termMode'],
		termIdentities: o.termIdentities as string[],
	};
}

/**
 * SCA-02R: a present body schoolId must be a well-formed integer matching
 * the actor school. Malformed values → 400; well-formed mismatches → 403.
 * Never silently ignored.
 */
function checkBodySchoolId(req: Request, actorSchoolId: number, res: Response): boolean {
	const raw = req.body?.schoolId;
	if (raw === null || raw === undefined) return true;
	const parsed = typeof raw === 'number' ? raw : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);
	if (!Number.isInteger(parsed) || (parsed as number) <= 0) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId must be a positive integer matching the authenticated school.' });
		return false;
	}
	if ((parsed as number) !== actorSchoolId) {
		res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: `Cannot operate on school ${parsed}: the authenticated actor belongs to school ${actorSchoolId}.` });
		return false;
	}
	return true;
}

// GET /curriculum-requirements/:schoolYearId/requirements — snapshot (read-only)
router.get('/:schoolYearId/requirements', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = requireActorSchool(req, res);
		const schoolYearId = resolveSchoolYearId(req, res);
		if (actorSchoolId === null || schoolYearId === null) return;
		const snapshot = await offeringService.getCurriculumRequirements(actorSchoolId, schoolYearId);
		res.json(snapshot);
	} catch (err) {
		next(err);
	}
});

// PUT /curriculum-requirements/:schoolYearId/terms — upsert term configuration
router.put('/:schoolYearId/terms', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = requireActorSchool(req, res);
		const schoolYearId = resolveSchoolYearId(req, res);
		if (actorSchoolId === null || schoolYearId === null) return;
		if (rejectUnknownBodyFields(req.body, new Set(['schoolId', 'termCount', 'termIdentities', 'isActive', 'expectedUpdatedAt']), 'term configuration', res)) return;
		if (!checkBodySchoolId(req, actorSchoolId, res)) return;
		const { termCount, termIdentities, isActive, expectedUpdatedAt } = req.body ?? {};
		const termConfig = await termConfigService.upsertTermConfig(
			actorSchoolId,
			schoolYearId,
			{ termCount, termIdentities, isActive, expectedUpdatedAt },
			resolveActorId(req) ?? undefined,
		);
		res.json({ termConfig });
	} catch (err) {
		next(err);
	}
});

// GET /curriculum-requirements/:schoolYearId/readiness — read-only readiness (read-only)
router.get('/:schoolYearId/readiness', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = requireActorSchool(req, res);
		const schoolYearId = resolveSchoolYearId(req, res);
		if (actorSchoolId === null || schoolYearId === null) return;
		const readiness = await offeringService.evaluateCurriculumReadiness(actorSchoolId, schoolYearId);
		res.json({ readiness });
	} catch (err) {
		next(err);
	}
});

// GET /curriculum-requirements/:schoolYearId/requirement-suggestions — unapproved catalog suggestions (read-only)
router.get('/:schoolYearId/requirement-suggestions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = requireActorSchool(req, res);
		const schoolYearId = resolveSchoolYearId(req, res);
		if (actorSchoolId === null || schoolYearId === null) return;
		const result = await offeringService.suggestRequirementsFromCatalog(actorSchoolId, schoolYearId);
		res.json(result);
	} catch (err) {
		next(err);
	}
});

// GET /curriculum-requirements/:schoolYearId/decision-candidates — SCA-03E
// operator decision workspace source (read-only). Candidates are
// reconstructed dynamically from current subjects, active sections, and
// annual ownership evidence; ownership is SUGGESTION_ONLY provenance.
// Performs zero writes and authorizes no mutation.
router.get('/:schoolYearId/decision-candidates', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = requireActorSchool(req, res);
		const schoolYearId = resolveSchoolYearId(req, res);
		if (actorSchoolId === null || schoolYearId === null) return;
		const candidates = await decisionCandidatesService.getDecisionCandidates(actorSchoolId, schoolYearId);
		res.json({ candidates });
	} catch (err) {
		next(err);
	}
});

// POST /curriculum-requirements/requirements — versioned single-row create
router.post('/requirements', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = requireActorSchool(req, res);
		if (actorSchoolId === null) return;
		if (rejectUnknownBodyFields(req.body, new Set(['schoolId', 'schoolYearId', 'offering']), 'requirement create', res)) return;
		const schoolYearId = Number(req.body?.schoolYearId);
		if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required and must be a positive integer.' });
			return;
		}
		if (!checkBodySchoolId(req, actorSchoolId, res)) return;
		if (!checkOfferingKeys(req.body?.offering, res)) return;
		const input = toOfferingInput(req.body?.offering);
		if (!input) {
			res.status(400).json({ code: 'INVALID_OFFERING', message: 'offering must use known fields with strict types: gradeLevel, programType, classification, weeklyMinutes, termMode, string termIdentities, integer-or-null ids.' });
			return;
		}
		const requirement = await offeringService.createRequirement(actorSchoolId, schoolYearId, input, resolveActorId(req));
		res.status(201).json({ requirement });
	} catch (err) {
		next(err);
	}
});

// PATCH /curriculum-requirements/requirements/:id — versioned single-row update
router.patch('/requirements/:id', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = requireActorSchool(req, res);
		if (actorSchoolId === null) return;
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a positive integer.' });
			return;
		}
		const { expectedVersion, ...patch } = req.body ?? {};
		for (const key of Object.keys(patch)) {
			if (!offeringService.KNOWN_REQUIREMENT_PATCH_FIELDS.has(key)) {
				res.status(400).json({ code: 'UNKNOWN_FIELD', message: `requirement patch contains unknown field(s): ${key}.` });
				return;
			}
		}
		const requirement = await offeringService.updateRequirementAtomic(id, actorSchoolId, expectedVersion, patch, resolveActorId(req));
		res.json({ requirement });
	} catch (err) {
		next(err);
	}
});

// POST /curriculum-requirements/requirements/:id/retire — versioned soft retire
router.post('/requirements/:id/retire', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = requireActorSchool(req, res);
		if (actorSchoolId === null) return;
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a positive integer.' });
			return;
		}
		if (rejectUnknownBodyFields(req.body ?? {}, new Set(['expectedVersion']), 'requirement retire', res)) return;
		const requirement = await offeringService.retireRequirementAtomic(id, actorSchoolId, req.body?.expectedVersion, resolveActorId(req));
		res.json({ requirement });
	} catch (err) {
		next(err);
	}
});

/** Shared strict batch-body parsing for preview and apply. */
function parseBatchBody(req: Request, res: Response): offeringService.OfferingInput[] | null {
	if (rejectUnknownBodyFields(req.body, new Set(['offerings', 'expectedFingerprint', 'expectedSourceVersions', 'expectedTermConfigUpdatedAt']), 'batch requirements', res)) return null;
	const raw = req.body?.offerings;
	if (!Array.isArray(raw)) {
		res.status(400).json({ code: 'INVALID_OFFERING', message: 'offerings must be an array of requirement inputs.' });
		return null;
	}
	const proposed: offeringService.OfferingInput[] = [];
	for (const item of raw) {
		if (!checkOfferingKeys(item, res)) return null;
		const input = toOfferingInput(item);
		if (!input) {
			res.status(400).json({ code: 'INVALID_OFFERING', message: 'Every offering must use known fields with strict types: string termIdentities, integer-or-null ids, typed rotation metadata.' });
			return null;
		}
		proposed.push(input);
	}
	return proposed;
}

/** SCA-02R: unknown offering fields reject as UNKNOWN_FIELD (not generic INVALID_OFFERING). */
function checkOfferingKeys(raw: unknown, res: Response): boolean {
	const unknown = offeringService.unknownFieldNames(raw, offeringService.KNOWN_OFFERING_FIELDS);
	if (unknown === null) return true;
	if (unknown.length > 0) {
		res.status(400).json({ code: 'UNKNOWN_FIELD', message: `offering contains unknown field(s): ${unknown.join(', ')}.` });
		return false;
	}
	return true;
}

// POST /curriculum-requirements/:schoolYearId/requirements/preview — read-only batch preview
router.post('/:schoolYearId/requirements/preview', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = requireActorSchool(req, res);
		const schoolYearId = resolveSchoolYearId(req, res);
		if (actorSchoolId === null || schoolYearId === null) return;
		const proposed = parseBatchBody(req, res);
		if (!proposed) return;
		const preview = await offeringService.previewOfferings(actorSchoolId, schoolYearId, proposed);
		res.json({ preview });
	} catch (err) {
		next(err);
	}
});

// POST /curriculum-requirements/:schoolYearId/requirements/apply — fingerprint-bound batch apply
router.post('/:schoolYearId/requirements/apply', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = requireActorSchool(req, res);
		const schoolYearId = resolveSchoolYearId(req, res);
		if (actorSchoolId === null || schoolYearId === null) return;
		const proposed = parseBatchBody(req, res);
		if (!proposed) return;
		const receipt = await offeringService.applyCurriculumBatch({
			schoolId: actorSchoolId,
			schoolYearId,
			proposedOfferings: proposed,
			actorId: resolveActorId(req),
			expectedFingerprint: req.body?.expectedFingerprint,
			expectedSourceVersions: req.body?.expectedSourceVersions,
			expectedTermConfigUpdatedAt: req.body?.expectedTermConfigUpdatedAt,
		});
		res.json({ receipt });
	} catch (err) {
		next(err);
	}
});

export default router;
