/**
 * A8 c4 — "Cover a class" read + write surface, mounted at
 * `/api/v1/teaching-load` beside the history and carry-forward routers.
 *
 * Auth is `authenticate` + `requirePrivilegedRole`, matching every existing
 * Teaching Load write (`faculty-assignment.router.ts`, the history and
 * carry-forward routers): privileged roles are `admin|officer|SYSTEM_ADMIN`. A
 * new capability gate here would have made these routes stricter than the
 * Teaching Load writes they sit beside, and the client has one role model.
 *
 * Actor-school authority is `assertRequestSchoolScope` on every route, so a
 * cross-school read or write is rejected before any service dispatch.
 *
 * Every response shape is the FIXED CONTRACT (docs/handoffs/lane-c-to-a2.md,
 * commit 6c5987ed). Nothing here reshapes a field.
 */

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { assertRequestSchoolScope, requirePrivilegedRole } from '../middleware/authorize.js';
import {
	CoverContractError,
	createCoverAssignment,
	listCoverCandidates,
	listCoverOpenClasses,
} from '../services/teaching-load-cover.service.js';

const router = Router();

/** Path ids are parsed strictly here; the service repeats the check fail-closed. */
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

function fail(res: Response, error: unknown, next: NextFunction): void {
	if (error instanceof CoverContractError) {
		// `code` is ALWAYS present; a typed error without it would leave the client
		// unable to branch on the 400/409 it is written against.
		res.status(error.statusCode).json({ code: error.code, message: error.message, ...error.payload });
		return;
	}
	next(error);
}

// Auth: GET /teaching-load/:schoolId/:schoolYearId/cover-candidates
// Read-only, ranked, never a placeholder. `subjectId` AND `sectionId` are both
// required: without the section, `hoursAfter` would be a guess.
router.get('/:schoolId/:schoolYearId/cover-candidates', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = parsePositiveInt(req.params.schoolId, 'schoolId');
		const schoolYearId = parsePositiveInt(req.params.schoolYearId, 'schoolYearId');
		if (!assertRequestSchoolScope(req, res, schoolId)) return;
		const subjectId = req.query.subjectId === undefined
			? null
			: parsePositiveInt(req.query.subjectId, 'subjectId');
		const sectionId = req.query.sectionId === undefined
			? null
			: parsePositiveInt(req.query.sectionId, 'sectionId');
		if (subjectId === null || sectionId === null) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'subjectId and sectionId are both required and must be positive integers.' });
			return;
		}
		res.json(await listCoverCandidates({ schoolId, schoolYearId, subjectId, sectionId }));
	} catch (error) {
		fail(res, error, next);
	}
});

// Auth: GET /teaching-load/:schoolId/:schoolYearId/cover-open-classes
// The honest open-class set: a placeholder-owned class is OPEN. Optional
// `subjectId` / `gradeLevel` filters; both may be omitted.
router.get('/:schoolId/:schoolYearId/cover-open-classes', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = parsePositiveInt(req.params.schoolId, 'schoolId');
		const schoolYearId = parsePositiveInt(req.params.schoolYearId, 'schoolYearId');
		if (!assertRequestSchoolScope(req, res, schoolId)) return;
		res.json(await listCoverOpenClasses({
			schoolId,
			schoolYearId,
			subjectId: req.query.subjectId,
			gradeLevel: req.query.gradeLevel,
		}));
	} catch (error) {
		fail(res, error, next);
	}
});

// Auth: POST /teaching-load/:schoolId/:schoolYearId/cover-assignments
// The single Assign action. `grantPermission` defaults to false; retrying the
// identical body with `true` writes the permission row AND the ownership row in
// one transaction.
router.post('/:schoolId/:schoolYearId/cover-assignments', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const actorUserId = actorUserIdOf(req);
		if (actorUserId == null) {
			res.status(403).json({ code: 'ACTOR_USER_REQUIRED', message: 'A strict positive authenticated actor user id is required to assign a cover class.' });
			return;
		}
		const schoolId = parsePositiveInt(req.params.schoolId, 'schoolId');
		const schoolYearId = parsePositiveInt(req.params.schoolYearId, 'schoolYearId');
		if (!assertRequestSchoolScope(req, res, schoolId)) return;
		const body = (req.body ?? {}) as Record<string, unknown>;
		const result = await createCoverAssignment({
			schoolId,
			schoolYearId,
			facultyId: parsePositiveInt(body.facultyId, 'facultyId'),
			subjectId: parsePositiveInt(body.subjectId, 'subjectId'),
			sectionId: parsePositiveInt(body.sectionId, 'sectionId'),
			grantPermission: body.grantPermission === true,
			actorId: actorUserId,
		});
		res.json(result);
	} catch (error) {
		fail(res, error, next);
	}
});

export default router;
