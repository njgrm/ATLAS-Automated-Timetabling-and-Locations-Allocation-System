/**
 * BENEFICIARY-EXPORT-PARITY-C05R1 — Teacher Program presentation / signatory
 * settings routes.
 *
 *   GET  /:schoolId/:schoolYearId            read the effective profile (zero writes)
 *   POST /:schoolId/:schoolYearId/preview    validate + echo (zero writes)
 *   PUT  /:schoolId/:schoolYearId            append a revision (audited, CAS)
 *
 * Authority: JWT role (privileged Scheduler Officer / IT Admin), positive actor
 * identity, actor-school equality, and the single active school year. Every
 * rejected request dispatches zero service calls.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
	PresentationProfileError,
	normalizeSignatoryInput,
	readEffectiveSignatoryProfile,
	saveSignatoryProfile,
} from '../services/export-presentation.service.js';

const router = Router();

const PRIVILEGED_ROLES: Set<string> = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);

function positiveInt(raw: unknown, name: string): number | string {
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return `${name} must be a positive integer.`;
	return n;
}

function actorSchoolId(req: Request): number | null {
	const schoolId = Number(req.user?.schoolId);
	return Number.isInteger(schoolId) && schoolId > 0 ? schoolId : null;
}

function actorIdOf(req: Request): number | null {
	const actorId = Number(req.user?.userId);
	return Number.isInteger(actorId) && actorId > 0 ? actorId : null;
}

function assertActorSchoolScope(req: Request, res: Response, schoolId: number): boolean {
	const actorSchool = actorSchoolId(req);
	if (actorSchool === null) {
		res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required for presentation settings.' });
		return false;
	}
	if (actorSchool !== schoolId) {
		res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: 'Cannot manage presentation settings for another school.' });
		return false;
	}
	return true;
}

function sendProfileError(res: Response, error: unknown): boolean {
	if (error instanceof PresentationProfileError) {
		res.status(error.statusCode).json({ code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) });
		return true;
	}
	return false;
}

// ─── GET — effective profile (passive read / preview) ───

router.get(
	'/:schoolId/:schoolYearId',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can read teacher-program presentation settings.' });
				return;
			}
			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			if (!assertActorSchoolScope(req, res, schoolId)) return;

			const profile = await readEffectiveSignatoryProfile({ schoolId, schoolYearId });
			res.status(200).json({ data: profile });
		} catch (error) {
			if (sendProfileError(res, error)) return;
			next(error);
		}
	},
);

// ─── POST /preview — validate + echo, zero writes ───

router.post(
	'/:schoolId/:schoolYearId/preview',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can preview teacher-program presentation settings.' });
				return;
			}
			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			if (!assertActorSchoolScope(req, res, schoolId)) return;

			const input = normalizeSignatoryInput(req.body?.profile ?? {});
			const current = await readEffectiveSignatoryProfile({ schoolId, schoolYearId });
			res.status(200).json({ data: { profile: current, normalized: input, currentRevision: current.revision } });
		} catch (error) {
			if (sendProfileError(res, error)) return;
			next(error);
		}
	},
);

// ─── PUT — append one audited revision (CAS) ───

router.put(
	'/:schoolId/:schoolYearId',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can edit teacher-program presentation settings.' });
				return;
			}
			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			if (!assertActorSchoolScope(req, res, schoolId)) return;

			const actorId = actorIdOf(req);
			if (actorId === null) {
				res.status(401).json({ code: 'ACTOR_REQUIRED', message: 'A positive authenticated actor id is required.' });
				return;
			}

			const rawExpected = req.body?.expectedRevision;
			const expectedRevision = Number(rawExpected);
			if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
				res.status(400).json({ code: 'EXPECTED_REVISION_REQUIRED', message: 'expectedRevision must be a non-negative integer.' });
				return;
			}
			const input = normalizeSignatoryInput(req.body?.profile ?? {});

			const result = await saveSignatoryProfile({
				schoolId,
				schoolYearId,
				actorId,
				expectedRevision,
				input,
			});
			res.status(200).json({ data: result });
		} catch (error) {
			if (sendProfileError(res, error)) return;
			next(error);
		}
	},
);

export default router;
