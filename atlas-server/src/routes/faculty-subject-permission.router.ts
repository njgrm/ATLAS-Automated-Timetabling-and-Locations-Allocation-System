/**
 * A8 c4 — the cross-department subject permission list behind a teacher, mounted
 * at `/api/v1/faculty`.
 *
 * FIXED CONTRACT §4: officer-only; `schoolId` required on all three routes; the
 * teacher AND the subject must belong to that school or the answer is
 * `400 SCHOOL_SCOPE_MISMATCH`. POST is idempotent 200 `{created}` (never 201,
 * never a duplicate-row error); DELETE is 200 `{removed}` and deleting an absent
 * permission is `removed: false`, never a 404.
 *
 * Every write audits and invalidates the qualification policy cache so a granted
 * permission is effective on the very next `cover-candidates` read.
 */

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { assertRequestSchoolScope, requirePrivilegedRole } from '../middleware/authorize.js';
import {
	CoverContractError,
	createSubjectPermission,
	deleteSubjectPermission,
	listSubjectPermissions,
} from '../services/teaching-load-cover.service.js';

const router = Router();

function parsePositiveInt(raw: unknown, field: string): number {
	const numeric = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isSafeInteger(numeric) || numeric < 1) {
		throw new CoverContractError(400, 'INVALID_PARAM', `${field} must be a positive integer.`);
	}
	return numeric;
}

function actorUserIdOf(req: Request): number | null {
	const userId = req.user?.userId;
	return typeof userId === 'number' && Number.isInteger(userId) && userId > 0 ? userId : null;
}

/** The teacher-profile edit is not year-scoped, so the audit year is the active one. */
function auditYearId(req: Request): number {
	const raw = (req.user as { schoolYearId?: unknown } | undefined)?.schoolYearId;
	return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : 0;
}

function fail(res: Response, error: unknown, next: NextFunction): void {
	if (error instanceof CoverContractError) {
		res.status(error.statusCode).json({ message: error.message, ...error.payload });
		return;
	}
	next(error);
}

// Auth: GET /faculty/:facultyId/subject-permissions?schoolId=<n>
router.get('/:facultyId/subject-permissions', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = parsePositiveInt(req.query.schoolId, 'schoolId');
		if (!assertRequestSchoolScope(req, res, schoolId)) return;
		res.json(await listSubjectPermissions({
			schoolId,
			facultyId: parsePositiveInt(req.params.facultyId, 'facultyId'),
		}));
	} catch (error) {
		fail(res, error, next);
	}
});

// Auth: POST /faculty/:facultyId/subject-permissions  body { schoolId, subjectId }
router.post('/:facultyId/subject-permissions', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorUserId = actorUserIdOf(req);
		if (actorUserId == null) {
			res.status(403).json({ code: 'ACTOR_USER_REQUIRED', message: 'A strict positive authenticated actor user id is required to change a permission.' });
			return;
		}
		const body = (req.body ?? {}) as Record<string, unknown>;
		const schoolId = parsePositiveInt(body.schoolId, 'schoolId');
		if (!assertRequestSchoolScope(req, res, schoolId)) return;
		res.json(await createSubjectPermission({
			schoolId,
			facultyId: parsePositiveInt(req.params.facultyId, 'facultyId'),
			subjectId: parsePositiveInt(body.subjectId, 'subjectId'),
			actorId: actorUserId,
			schoolYearId: auditYearId(req),
		}));
	} catch (error) {
		fail(res, error, next);
	}
});

// Auth: DELETE /faculty/:facultyId/subject-permissions/:subjectId?schoolId=<n>
// `subjectId` in the path, `schoolId` in the query, NO request body.
router.delete('/:facultyId/subject-permissions/:subjectId', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorUserId = actorUserIdOf(req);
		if (actorUserId == null) {
			res.status(403).json({ code: 'ACTOR_USER_REQUIRED', message: 'A strict positive authenticated actor user id is required to change a permission.' });
			return;
		}
		const schoolId = parsePositiveInt(req.query.schoolId, 'schoolId');
		if (!assertRequestSchoolScope(req, res, schoolId)) return;
		res.json(await deleteSubjectPermission({
			schoolId,
			facultyId: parsePositiveInt(req.params.facultyId, 'facultyId'),
			subjectId: parsePositiveInt(req.params.subjectId, 'subjectId'),
			actorId: actorUserId,
			schoolYearId: auditYearId(req),
		}));
	} catch (error) {
		fail(res, error, next);
	}
});

export default router;
