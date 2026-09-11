import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { buildDerivedDemand } from '../services/derived-demand.service.js';
import { toDashboardDerivedDemand } from '../services/dashboard-readiness.service.js';

const router = Router();
const PRIVILEGED_ROLES: Set<string> = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);

function positiveInt(raw: unknown, name: string): number | string {
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return `${name} must be a positive integer.`;
	return n;
}

function actorSchoolId(req: Request): number | null {
	const schoolId = Number(req.user?.schoolId);
	return Number.isInteger(schoolId) && schoolId > 0 ? schoolId : null;
}

/**
 * UX-C01 — read-only derived-demand setup readiness for the active school year.
 * One authority: the canonical derived-demand contract. No annual offerings, no
 * term-config rows, and no writes. A blocked/typed read is returned as
 * `available: true, ready: false` with typed blockers; it is never coerced into
 * zero demand or a ready state.
 */
router.get(
	'/:schoolId/:schoolYearId/readiness',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view derived-demand readiness.' });
				return;
			}
			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: schoolId });
				return;
			}
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') {
				res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId });
				return;
			}
			const actorSchool = actorSchoolId(req);
			if (actorSchool === null) {
				res.status(403).json({ code: 'SCHOOL_SCOPE_REQUIRED', message: 'Authenticated school scope is required.' });
				return;
			}
			if (actorSchool !== schoolId) {
				res.status(403).json({ code: 'CROSS_SCHOOL_DENIED', message: 'Cannot read another school\u2019s derived demand.' });
				return;
			}

			const result = await buildDerivedDemand(schoolId, schoolYearId);
			res.json({
				scope: { schoolId, schoolYearId },
				...toDashboardDerivedDemand(result, null),
			});
		} catch (error) {
			const statusCode = (error as { statusCode?: unknown })?.statusCode;
			if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
				const code = (error as { code?: string }).code ?? 'DERIVED_DEMAND_BLOCKED';
				const message = error instanceof Error ? error.message : 'Derived demand is blocked.';
				res.json({
					scope: { schoolId: Number(req.params.schoolId), schoolYearId: Number(req.params.schoolYearId) },
					available: true,
					ready: false,
					yearLabel: null,
					revision: null,
					termStructure: null,
					blockers: [{ code, message }],
					subjectMetadataExceptions: [],
					totals: null,
					blockerCode: code,
					blockerMessage: message,
					error: null,
				});
				return;
			}
			next(error);
		}
	},
);

export default router;
