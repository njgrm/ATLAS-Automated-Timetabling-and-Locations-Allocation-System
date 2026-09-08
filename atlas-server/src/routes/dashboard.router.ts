import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticateWithSystemToken } from '../middleware/authenticate.js';
import { requirePrivilegedRole } from '../middleware/authorize.js';
import { getUpstreamAuthToken } from '../middleware/upstream-auth.js';
import { getDashboardReadinessSummary, resolveDashboardScope } from '../services/dashboard-readiness.service.js';

const router = Router();

function positiveInt(value: unknown, name: string): number | string {
	const numeric = Number(value);
	if (!Number.isInteger(numeric) || numeric <= 0) {
		return `${name} must be a positive integer.`;
	}
	return numeric;
}

async function handleDashboardReadinessSummary(req: Request, res: Response, next: NextFunction) {
	try {
		// EVAL-C01 — the Dashboard school always comes from the authenticated
		// actor. There is no school-1 fallback: an unresolved actor or a
		// cross-school request is rejected before any domain read runs.
		const actorSchoolId = Number(req.user?.schoolId);
		const querySchoolId = req.query.schoolId === undefined
			? undefined
			: positiveInt(req.query.schoolId, 'schoolId');
		if (typeof querySchoolId === 'string') {
			res.status(400).json({ code: 'INVALID_PARAM', message: querySchoolId });
			return;
		}
		const scope = resolveDashboardScope(
			Number.isInteger(actorSchoolId) ? actorSchoolId : null,
			querySchoolId ?? null,
		);
		if (!scope.ok) {
			res.status(403).json({ code: scope.code, message: scope.message });
			return;
		}
		const schoolId = scope.schoolId;

		// EVAL-C01R — a requested schoolYearId is validated (typed 400 when
		// malformed) but is deliberately NOT forwarded: the runtime active
		// year is the sole authority for current Dashboard lifecycle, so a
		// historical or mismatched requested year can never produce current
		// readiness or publication state.
		if (req.query.schoolYearId !== undefined) {
			const schoolYearId = positiveInt(req.query.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
				return;
			}
		}

		const upstreamAuthToken = getUpstreamAuthToken(req);
		const summary = await getDashboardReadinessSummary({ schoolId, authToken: upstreamAuthToken });
		res.json(summary);
	} catch (err) {
		next(err);
	}
}

router.get('/readiness-summary', authenticateWithSystemToken, requirePrivilegedRole, handleDashboardReadinessSummary);
router.get('/summary', authenticateWithSystemToken, requirePrivilegedRole, handleDashboardReadinessSummary);

export default router;
