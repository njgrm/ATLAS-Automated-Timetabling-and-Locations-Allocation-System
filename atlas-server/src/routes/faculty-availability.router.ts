/**
 * TEACHER-AVAILABILITY-AUTHORITY-C01 routes.
 *
 * Scheduler JWT (`authenticate`) + `timetable:edit` capability + strict
 * actor-school scope. All routes are term-scoped: writes are only accepted for
 * the persisted active ordered term, and an unresolved term fails closed with a
 * typed 409. There is no `?? 1` school/existing default anywhere.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { assertRequestSchoolScope, requireCapability } from '../middleware/authorize.js';
import {
	FacultyAvailabilityError,
	getFacultyAvailability,
	reviewAvailability,
	saveAvailabilityDraft,
	submitAvailability,
	type AvailabilityReviewDecision,
} from '../services/faculty-availability.service.js';

const router = Router();

function parsePositiveInt(raw: unknown, name: string): number | string {
	if (typeof raw === 'number') return Number.isSafeInteger(raw) && raw > 0 ? raw : `${name} must be a positive integer.`;
	if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) return `${name} must be a positive integer.`;
	const parsed = Number(raw);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : `${name} must be a positive integer.`;
}

/** Bind the route to the authenticated actor's school before any service dispatch. */
function scopedSchoolId(req: Request, res: Response): number | null {
	const schoolId = parsePositiveInt(req.params.schoolId, 'schoolId');
	if (typeof schoolId === 'string') {
		res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
		return null;
	}
	if (!assertRequestSchoolScope(req, res, schoolId)) return null;
	return schoolId;
}

function scopedParams(
	req: Request,
	res: Response,
): { schoolId: number; schoolYearId: number; facultyId: number } | null {
	const schoolId = scopedSchoolId(req, res);
	if (schoolId === null) return null;
	const schoolYearId = parsePositiveInt(req.params.schoolYearId, 'schoolYearId');
	if (typeof schoolYearId === 'string') {
		res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
		return null;
	}
	const facultyId = parsePositiveInt(req.params.facultyId, 'facultyId');
	if (typeof facultyId === 'string') {
		res.status(400).json({ code: 'INVALID_PARAM', message: facultyId });
		return null;
	}
	return { schoolId, schoolYearId, facultyId };
}

// GET /:schoolId/:schoolYearId/faculty/:facultyId — active-term authority (may be null)
router.get(
	'/:schoolId/:schoolYearId/faculty/:facultyId',
	authenticate,
	requireCapability('timetable:edit'),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const params = scopedParams(req, res);
			if (!params) return;
			const availability = await getFacultyAvailability(params.schoolId, params.schoolYearId, params.facultyId);
			res.json({ availability });
		} catch (error) {
			next(error);
		}
	},
);

// PUT /:schoolId/:schoolYearId/faculty/:facultyId — save a DRAFT for an explicit term
router.put(
	'/:schoolId/:schoolYearId/faculty/:facultyId',
	authenticate,
	requireCapability('timetable:edit'),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const params = scopedParams(req, res);
			if (!params) return;
			const availability = await saveAvailabilityDraft({
				schoolId: params.schoolId,
				schoolYearId: params.schoolYearId,
				facultyId: params.facultyId,
				termIndex: req.body?.termIndex,
				slots: req.body?.slots,
				notes: req.body?.notes ?? null,
				version: req.body?.version ?? null,
			});
			res.json({ availability });
		} catch (error) {
			next(error);
		}
	},
);

// POST /:schoolId/:schoolYearId/faculty/:facultyId/submit — submit the active-term draft
router.post(
	'/:schoolId/:schoolYearId/faculty/:facultyId/submit',
	authenticate,
	requireCapability('timetable:edit'),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const params = scopedParams(req, res);
			if (!params) return;
			const availability = await submitAvailability({
				schoolId: params.schoolId,
				schoolYearId: params.schoolYearId,
				facultyId: params.facultyId,
				version: req.body?.version,
				slots: req.body?.slots,
				notes: req.body?.notes,
			});
			res.json({ availability });
		} catch (error) {
			next(error);
		}
	},
);

// PATCH /:schoolId/:schoolYearId/faculty/:facultyId/review — reviewed-only binding gate
router.patch(
	'/:schoolId/:schoolYearId/faculty/:facultyId/review',
	authenticate,
	requireCapability('timetable:edit'),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const params = scopedParams(req, res);
			if (!params) return;
			const decision = req.body?.decision as AvailabilityReviewDecision;
			const reviewerId = req.user?.userId;
			if (typeof reviewerId !== 'number' || !Number.isSafeInteger(reviewerId) || reviewerId < 1) {
				res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' });
				return;
			}
			const availability = await reviewAvailability({
				schoolId: params.schoolId,
				schoolYearId: params.schoolYearId,
				facultyId: params.facultyId,
				version: req.body?.version,
				decision,
				reviewerId,
				reviewerNotes: req.body?.reviewerNotes ?? null,
			});
			res.json({ availability });
		} catch (error) {
			next(error);
		}
	},
);

export { FacultyAvailabilityError };
export default router;
