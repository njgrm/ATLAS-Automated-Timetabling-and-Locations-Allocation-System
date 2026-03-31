import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as policyService from '../services/scheduling-policy.service.js';

const router = Router();

// ─── Helpers ───

const PRIVILEGED_ROLES: Set<string> = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);

function positiveInt(raw: unknown, name: string): number | string {
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return `${name} must be a positive integer.`;
	return n;
}

// ─── GET /:schoolId/:schoolYearId — fetch policy (with default fallback) ───

router.get(
	'/:schoolId/:schoolYearId',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view scheduling policy.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const policy = await policyService.getOrCreatePolicy(schoolId, schoolYearId);
			res.json({ policy });
		} catch (e) { next(e); }
	},
);

// ─── PUT /:schoolId/:schoolYearId — upsert policy ───

router.put(
	'/:schoolId/:schoolYearId',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can update scheduling policy.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const policy = await policyService.upsertPolicy(schoolId, schoolYearId, req.body);
			res.json({ policy });
		} catch (e) { next(e); }
	},
);

export default router;
