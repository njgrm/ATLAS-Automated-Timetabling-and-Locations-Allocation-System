import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as sectionService from '../services/section.service.js';

const router = Router();

// Auth: GET /sections/summary/:schoolYearId
router.get('/summary/:schoolYearId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolYearId = Number(req.params.schoolYearId);
		if (!schoolYearId || Number.isNaN(schoolYearId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId must be a number.' });
			return;
		}
		const schoolId = Number(req.query.schoolId);
		if (!schoolId || Number.isNaN(schoolId)) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required and must be a positive number.' });
			return;
		}
		const authToken = req.headers.authorization?.slice(7);
		const summary = await sectionService.getSectionSummary(schoolYearId, schoolId, authToken);
		res.json(summary);
	} catch (err: any) {
		// If the upstream is unreachable, return a degraded response
		if (err?.code === 'UPSTREAM_ERROR' || err?.cause?.code === 'ECONNREFUSED' || err?.message?.includes('fetch failed')) {
			res.status(503).json({
				code: 'UPSTREAM_UNAVAILABLE',
				message: 'Section data source is currently unavailable.',
				totalSections: 0,
				byGradeLevel: {},
				sections: [],
			});
			return;
		}
		next(err);
	}
});

export default router;
