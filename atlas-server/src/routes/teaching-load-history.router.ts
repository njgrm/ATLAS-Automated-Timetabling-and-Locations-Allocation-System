import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import {
	getTeachingLoadHistory,
	listTeachingLoadHistoryYears,
} from '../services/teaching-load-history.service.js';

const router = Router();

function actorSchoolId(req: Request, res: Response): number | null {
	const schoolId = req.user?.schoolId;
	if (typeof schoolId === 'number' && Number.isInteger(schoolId) && schoolId > 0) return schoolId;
	res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated actor school scope is required.' });
	return null;
}

router.get('/history-years', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = actorSchoolId(req, res);
		if (schoolId == null) return;
		res.json({ schoolId, years: await listTeachingLoadHistoryYears(schoolId) });
	} catch (error) {
		next(error);
	}
});

router.get('/history-years/:schoolYearId', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = actorSchoolId(req, res);
		if (schoolId == null) return;
		const schoolYearId = Number(req.params.schoolYearId);
		if (!Number.isInteger(schoolYearId) || schoolYearId < 1) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId must be a positive integer.' });
			return;
		}
		res.json(await getTeachingLoadHistory(schoolId, schoolYearId));
	} catch (error) {
		next(error);
	}
});

export default router;
