import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import * as templateService from '../services/class-template.service.js';
import type { ProgramType } from '@prisma/client';

const router = Router();

const VALID_PROGRAM_TYPES = new Set<string>(['REGULAR', 'STE', 'SPA', 'SPS', 'OTHER']);

const ACTOR_SCHOOL_REQUIRED_BODY = {
	code: 'ACTOR_SCHOOL_REQUIRED',
	message: 'The authenticated actor must have an assigned school.',
} as const;

const CROSS_SCHOOL_READ_BODY = {
	code: 'CROSS_SCHOOL_DENIED',
	message: 'Cannot read another school\u2019s class templates.',
} as const;

const CROSS_SCHOOL_WRITE_BODY = {
	code: 'CROSS_SCHOOL_DENIED',
	message: 'Cannot modify another school\u2019s class templates.',
} as const;

/**
 * The verified JWT actor school is the ONLY implicit scope for this router.
 * It must be a positive integer; anything else fails closed before dispatch.
 */
function actorSchoolIdOf(req: Request): number | null {
	const schoolId = req.user?.schoolId;
	return typeof schoolId === 'number' && Number.isInteger(schoolId) && schoolId > 0 ? schoolId : null;
}

/**
 * Actor-school guard. Returns the actor school, or writes the typed 403 and
 * returns `null` so the handler returns BEFORE any parameter validation,
 * school equality check, or service dispatch.
 */
function requireActorSchool(req: Request, res: Response): number | null {
	const schoolId = actorSchoolIdOf(req);
	if (schoolId === null) {
		res.status(403).json(ACTOR_SCHOOL_REQUIRED_BODY);
		return null;
	}
	return schoolId;
}

/** Positive-integer parse. `null` means "malformed" (typed 400 by the caller). */
function parsePositiveInt(value: unknown): number | null {
	if (typeof value === 'number') {
		return Number.isInteger(value) && value > 0 ? value : null;
	}
	if (typeof value !== 'string' || value.trim() === '') return null;
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Optional-body school scope: absent => actor school; present => must equal it. */
function resolveRequestedSchoolId(
	value: unknown,
	actorSchoolId: number,
	res: Response,
): { ok: true; schoolId: number } | { ok: false } {
	if (value === undefined || value === null || value === '') {
		return { ok: true, schoolId: actorSchoolId };
	}
	const parsed = parsePositiveInt(value);
	if (parsed === null) {
		res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId must be a positive integer.' });
		return { ok: false };
	}
	if (parsed !== actorSchoolId) {
		res.status(403).json(CROSS_SCHOOL_WRITE_BODY);
		return { ok: false };
	}
	return { ok: true, schoolId: actorSchoolId };
}

// GET /class-templates?schoolId=X — actor-school scoped read. ZERO writes.
router.get('/', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = requireActorSchool(req, res);
		if (actorSchoolId === null) return;

		const requestedSchoolId = parsePositiveInt(req.query.schoolId);
		if (requestedSchoolId === null) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		if (requestedSchoolId !== actorSchoolId) {
			res.status(403).json(CROSS_SCHOOL_READ_BODY);
			return;
		}

		const templates = await templateService.getTemplatesBySchool(actorSchoolId);
		res.json({ templates });
	} catch (err) {
		next(err);
	}
});

// GET /class-templates/:id — owning-school bound read. ZERO writes.
router.get('/:id', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = requireActorSchool(req, res);
		if (actorSchoolId === null) return;

		const id = parsePositiveInt(req.params.id);
		if (id === null) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}

		const template = await templateService.getTemplateByIdForSchool(id, actorSchoolId);
		if (template) {
			res.json({ template });
			return;
		}

		// Scoped read missed. Discriminate absent (404) from foreign-owned (403)
		// with identifiers only; a foreign row's payload is never returned.
		const ownerSchoolId = await templateService.probeTemplateOwnerSchoolId(id);
		if (ownerSchoolId === null) {
			res.status(404).json({ code: 'NOT_FOUND', message: 'Class template not found.' });
			return;
		}
		res.status(403).json(CROSS_SCHOOL_READ_BODY);
	} catch (err) {
		next(err);
	}
});

// POST /class-templates/initialize — the ONLY production path that creates defaults.
router.post('/initialize', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = requireActorSchool(req, res);
		if (actorSchoolId === null) return;

		const actorId = req.user?.userId;
		if (typeof actorId !== 'number' || !Number.isInteger(actorId) || actorId <= 0) {
			res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
			return;
		}

		const requested = resolveRequestedSchoolId((req.body ?? {}).schoolId, actorSchoolId, res);
		if (!requested.ok) return;

		const result = await templateService.initializeDefaultTemplatesForSchool(requested.schoolId, actorId);
		res.json(result);
	} catch (err) {
		next(err);
	}
});

// POST /class-templates — create a custom template
router.post('/', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = requireActorSchool(req, res);
		if (actorSchoolId === null) return;

		const { schoolId, name, label, programType, gradeApplicability, periodLengthMinutes, periodsPerDay, subjectIds } = req.body ?? {};

		const requested = resolveRequestedSchoolId(schoolId, actorSchoolId, res);
		if (!requested.ok) return;

		if (!name || !label || !programType || !gradeApplicability || !periodLengthMinutes || !periodsPerDay) {
			res.status(400).json({ code: 'MISSING_FIELDS', message: 'name, label, programType, gradeApplicability, periodLengthMinutes, periodsPerDay are required.' });
			return;
		}
		if (!VALID_PROGRAM_TYPES.has(String(programType))) {
			res.status(400).json({ code: 'INVALID_PROGRAM_TYPE', message: `programType must be one of: ${[...VALID_PROGRAM_TYPES].join(', ')}` });
			return;
		}
		const template = await templateService.createTemplate(requested.schoolId, {
			name,
			label,
			programType: programType as ProgramType,
			gradeApplicability: Array.isArray(gradeApplicability) ? gradeApplicability.map(Number) : [],
			periodLengthMinutes: Number(periodLengthMinutes),
			periodsPerDay: Number(periodsPerDay),
			subjectIds: Array.isArray(subjectIds) ? subjectIds.map(Number) : undefined,
		});
		res.status(201).json({ template });
	} catch (err: any) {
		if (err?.code === 'P2002') {
			res.status(409).json({ code: 'DUPLICATE', message: 'A template for this program type already exists for this school.' });
			return;
		}
		next(err);
	}
});

// PATCH /class-templates/:id — update metadata (not subjects; use PUT /class-templates/:id/subjects)
router.patch('/:id', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = requireActorSchool(req, res);
		if (actorSchoolId === null) return;

		const id = parsePositiveInt(req.params.id);
		if (id === null) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}

		const result = await templateService.updateTemplateForSchool(id, actorSchoolId, req.body ?? {});
		if (!result.ok) {
			if (result.reason === 'CROSS_SCHOOL') {
				res.status(403).json(CROSS_SCHOOL_WRITE_BODY);
				return;
			}
			res.status(404).json({ code: 'NOT_FOUND', message: 'Class template not found.' });
			return;
		}
		res.json({ template: result.template });
	} catch (err) {
		next(err);
	}
});

// PUT /class-templates/:id/subjects — replace subject bundle
router.put('/:id/subjects', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorSchoolId = requireActorSchool(req, res);
		if (actorSchoolId === null) return;

		const id = parsePositiveInt(req.params.id);
		if (id === null) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'id must be a number.' });
			return;
		}
		const { subjectIds } = req.body ?? {};
		if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
			res.status(400).json({ code: 'MISSING_FIELDS', message: 'subjectIds array is required and must not be empty.' });
			return;
		}

		const result = await templateService.setTemplateSubjectsForSchool(id, actorSchoolId, subjectIds.map(Number));
		if (!result.ok) {
			if (result.reason === 'CROSS_SCHOOL') {
				res.status(403).json(CROSS_SCHOOL_WRITE_BODY);
				return;
			}
			res.status(404).json({ code: 'NOT_FOUND', message: 'Class template not found.' });
			return;
		}
		res.json({ template: result.template });
	} catch (err) {
		next(err);
	}
});

export default router;
