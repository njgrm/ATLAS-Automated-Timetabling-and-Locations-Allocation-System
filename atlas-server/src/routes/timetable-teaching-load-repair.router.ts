import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import {
	applyTeachingLoadRepair,
	previewTeachingLoadRepair,
} from '../services/timetable-teaching-load-repair.service.js';

const router = Router();
const PRIVILEGED_ROLES: Set<string> = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);

function positiveInt(raw: unknown, name: string): number | string {
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return `${name} must be a positive integer.`;
	return n;
}

function parseScope(params: Record<string, string>): { schoolId: number; schoolYearId: number; runId: number } | string {
	const schoolId = positiveInt(params.schoolId, 'schoolId');
	if (typeof schoolId === 'string') return schoolId;
	const schoolYearId = positiveInt(params.schoolYearId, 'schoolYearId');
	if (typeof schoolYearId === 'string') return schoolYearId;
	const runId = positiveInt(params.runId, 'runId');
	if (typeof runId === 'string') return runId;
	return { schoolId, schoolYearId, runId };
}

function assertPrivileged(req: Request, res: Response): boolean {
	const role = req.user?.role;
	if (!role || !PRIVILEGED_ROLES.has(role)) {
		res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can repair Teaching Load from timetable review.' });
		return false;
	}
	return true;
}

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/teaching-load-repairs/preview',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertPrivileged(req, res)) return;
			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			const result = await previewTeachingLoadRepair(scope.runId, scope.schoolId, scope.schoolYearId, req.body ?? {});
			res.json(result);
		} catch (e) { next(e); }
	},
);

router.post(
	'/:schoolId/:schoolYearId/runs/:runId/teaching-load-repairs/apply',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!assertPrivileged(req, res)) return;
			const scope = parseScope(req.params as Record<string, string>);
			if (typeof scope === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: scope }); return; }
			const actorId = req.user?.userId;
			if (!actorId) { res.status(401).json({ code: 'NO_USER', message: 'Authenticated user required.' }); return; }
			const result = await applyTeachingLoadRepair(scope.runId, scope.schoolId, scope.schoolYearId, actorId, req.body ?? {});
			res.json(result);
		} catch (e) { next(e); }
	},
);

export default router;
