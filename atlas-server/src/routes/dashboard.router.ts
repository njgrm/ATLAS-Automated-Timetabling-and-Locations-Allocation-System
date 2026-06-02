import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticateWithSystemToken } from '../middleware/authenticate.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import { getDashboardReadinessSummary } from '../services/dashboard-readiness.service.js';

const router = Router();

function positiveInt(value: unknown, name: string): number | string {
	const numeric = Number(value);
	if (!Number.isInteger(numeric) || numeric <= 0) {
		return `${name} must be a positive integer.`;
	}
	return numeric;
}

router.get('/readiness-summary', authenticateWithSystemToken, requirePrivilegedRole, async (req: Request, res: Response, next: NextFunction) => {
	try {
		const schoolId = positiveInt(req.query.schoolId ?? 1, 'schoolId');
		if (typeof schoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
			return;
		}

		const schoolYearId = req.query.schoolYearId === undefined
			? undefined
			: positiveInt(req.query.schoolYearId, 'schoolYearId');
		if (typeof schoolYearId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
			return;
		}

		const authToken = req.headers.authorization?.startsWith('Bearer ')
			? req.headers.authorization.slice(7)
			: undefined;
		const upstreamAuthToken = req.user?.authSource === 'system' ? undefined : authToken;
		const summary = await getDashboardReadinessSummary({ schoolId, schoolYearId, authToken: upstreamAuthToken });
		res.json(summary);
	} catch (err) {
		next(err);
	}
});

export default router;