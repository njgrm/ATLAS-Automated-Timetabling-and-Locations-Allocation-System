import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, authenticateWithSystemToken } from '../middleware/authenticate.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import * as sectionService from '../services/section.service.js';
import { syncSectionsFromExternal } from '../services/section.service.js';
import { sectionSourceMode, fetchEnrollProActiveSchoolYear } from '../services/section-adapter.js';

const router = Router();

// Auth: GET /sections/summary/:schoolYearId
router.get('/summary/:schoolYearId', authenticate, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolYearId = Number(req.params.schoolYearId);
		if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolYearId must be a positive integer.' });
			return;
		}
		const schoolId = Number(req.query.schoolId);
		if (!Number.isInteger(schoolId) || schoolId <= 0) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId query parameter is required and must be a positive integer.' });
			return;
		}
		const authToken = req.headers.authorization?.slice(7);
		const summary = await sectionService.getSectionSummary(schoolYearId, schoolId, authToken);
		res.json({ ...summary, sourceMode: sectionSourceMode });
	} catch (err: any) {
		// If the upstream is unreachable, return explicit error (do not silently masquerade)
		if (err?.code === 'UPSTREAM_ERROR' || err?.cause?.code === 'ECONNREFUSED' || err?.message?.includes('fetch failed')) {
			res.status(503).json({
				code: 'UPSTREAM_UNAVAILABLE',
				message: 'Section data source is currently unavailable.',
				sourceMode: sectionSourceMode,
				totalSections: 0,
				byGradeLevel: {},
				sections: [],
			});
			return;
		}
		next(err);
	}
});

/**
 * POST /api/v1/sections/sync
 * Manually trigger a reconciliation from EnrollPro sections into ATLAS SectionMirror.
 */
router.post('/sync', authenticateWithSystemToken, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = Number(req.body.schoolId);
		if (!schoolId) {
			res.status(400).json({ code: 'INVALID_PARAM', message: 'schoolId is required' });
			return;
		}

		const authToken = req.headers.authorization?.slice(7);
		const upstreamAuthToken = req.user?.authSource === 'system' ? undefined : authToken;

		// Resolve schoolYearId: use caller-supplied value if present, otherwise fetch from EnrollPro.
		let schoolYearId: number;
		if (req.body.schoolYearId !== undefined) {
			schoolYearId = Number(req.body.schoolYearId);
		} else {
			const activeYear = await fetchEnrollProActiveSchoolYear(upstreamAuthToken);
			schoolYearId = activeYear?.id ?? 1;
		}

		const [result, activeYear] = await Promise.all([
			syncSectionsFromExternal(schoolId, schoolYearId, upstreamAuthToken),
			fetchEnrollProActiveSchoolYear(upstreamAuthToken),
		]);
		res.json({ ...result, ...(activeYear ? { enrollProActiveYear: activeYear.yearLabel } : {}) });
	} catch (err) {
		next(err);
	}
});

export default router;
