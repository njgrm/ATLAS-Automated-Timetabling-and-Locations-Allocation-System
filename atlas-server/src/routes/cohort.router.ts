/**
 * Cohort router — TLE inter-section cohort endpoints.
 * Wave 3.5: sync and query TLE cohorts.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as cohortService from '../services/cohort.service.js';

const router = Router();

// Auth: GET /cohorts?schoolId=X&schoolYearId=Y
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId);
		const schoolYearId = Number(req.query.schoolYearId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId query parameter is required.' });
			return;
		}
		const cohorts = await cohortService.getCohortsBySchoolYear(schoolId, schoolYearId);
		res.json({ cohorts });
	} catch (err) {
		next(err);
	}
});

// Auth: GET /cohorts/by-grade?schoolId=X&schoolYearId=Y&gradeLevel=7
router.get('/by-grade', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.query.schoolId);
		const schoolYearId = Number(req.query.schoolYearId);
		const gradeLevel = Number(req.query.gradeLevel);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId query parameter is required.' });
			return;
		}
		if (!gradeLevel || Number.isNaN(gradeLevel)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'gradeLevel query parameter is required.' });
			return;
		}
		const cohorts = await cohortService.getCohortsByGrade(schoolId, schoolYearId, gradeLevel);
		res.json({ cohorts });
	} catch (err) {
		next(err);
	}
});

// Auth: POST /cohorts/sync — trigger sync from external source
router.post('/sync', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		const schoolYearId = Number(req.body.schoolYearId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required.' });
			return;
		}
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId is required.' });
			return;
		}
		const authToken = req.headers.authorization?.slice(7);
		const result = await cohortService.syncCohorts(schoolId, schoolYearId, authToken);
		if (!result.synced) {
			res.status(502).json({
				code: 'SYNC_FAILED',
				message: result.error,
				source: result.source,
			});
			return;
		}
		res.json({
			synced: true,
			source: result.source,
			fetchedAt: result.fetchedAt,
			count: result.count,
		});
	} catch (err) {
		next(err);
	}
});

export default router;
