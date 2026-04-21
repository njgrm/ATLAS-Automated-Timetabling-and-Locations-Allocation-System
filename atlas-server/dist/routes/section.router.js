import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as sectionService from '../services/section.service.js';
import { sectionSourceMode } from '../services/section-adapter.js';
const router = Router();
// Auth: GET /sections/summary/:schoolYearId
router.get('/summary/:schoolYearId', authenticate, async (req, res, next) => {
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
    }
    catch (err) {
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
export default router;
//# sourceMappingURL=section.router.js.map