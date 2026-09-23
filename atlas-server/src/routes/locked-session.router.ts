import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requestHasCapability } from '../middleware/authorize.js';
import * as lockService from '../services/locked-session.service.js';

const router = Router();

function assertTimetableCapability(req: Request, res: Response, capability: 'timetable:edit' | 'timetable:read'): boolean {
	if (requestHasCapability(req, capability)) return true;
	res.status(403).json({ code: 'FORBIDDEN', message: `The ${capability} capability is required.` });
	return false;
}

function positiveInt(raw: unknown, name: string): number | string {
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return `${name} must be a positive integer.`;
	return n;
}

// ─── GET /:schoolId/:schoolYearId/locks — list locks ───

router.get(
	'/:schoolId/:schoolYearId/locks',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertTimetableCapability(req, res, 'timetable:read')) return;

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const locks = await lockService.listLocks(schoolId, schoolYearId);
			res.json({ locks });
		} catch (e) { next(e); }
	},
);

// ─── POST /:schoolId/:schoolYearId/locks — create lock ───

router.post(
	'/:schoolId/:schoolYearId/locks',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertTimetableCapability(req, res, 'timetable:edit')) return;

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }

			const lock = await lockService.createLock(schoolId, schoolYearId, actorId, req.body);
			res.status(201).json({ lock });
		} catch (e) { next(e); }
	},
);

// ─── DELETE /:schoolId/:schoolYearId/locks/:lockId — delete lock ───

router.delete(
	'/:schoolId/:schoolYearId/locks/:lockId',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertTimetableCapability(req, res, 'timetable:edit')) return;

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const lockId = positiveInt(req.params.lockId, 'lockId');
			if (typeof lockId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: lockId }); return; }

			await lockService.deleteLock(lockId, schoolId, schoolYearId);
			res.status(204).end();
		} catch (e) { next(e); }
	},
);

// ─── GET /:schoolId/:schoolYearId/period-slots — canonical period slots from policy ───

router.get(
	'/:schoolId/:schoolYearId/period-slots',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertTimetableCapability(req, res, 'timetable:read')) return;

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const slots = await lockService.getEffectivePeriodSlots(schoolId, schoolYearId);
			res.json({ slots });
		} catch (e) { next(e); }
	},
);

export default router;
