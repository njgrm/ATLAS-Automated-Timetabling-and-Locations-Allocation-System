import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as windowService from '../services/grade-window.service.js';

const router = Router();

const PRIVILEGED_ROLES: Set<string> = new Set(['admin', 'officer', 'SYSTEM_ADMIN']);

function positiveInt(raw: unknown, name: string): number | string {
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return `${name} must be a positive integer.`;
	return n;
}

// ─── GET /:schoolId/:schoolYearId/grade-windows — list windows ───

router.get(
	'/:schoolId/:schoolYearId/grade-windows',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can view grade windows.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const windows = await windowService.listGradeWindows(schoolId, schoolYearId);
			res.json({ windows });
		} catch (e) { next(e); }
	},
);

// ─── PUT /:schoolId/:schoolYearId/grade-windows — batch upsert windows ───

router.put(
	'/:schoolId/:schoolYearId/grade-windows',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can update grade windows.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }

			const { windows } = req.body;
			if (!Array.isArray(windows)) {
				res.status(400).json({ code: 'INVALID_BODY', message: 'Body must contain a windows array.' });
				return;
			}

			const result = await windowService.upsertGradeWindows(schoolId, schoolYearId, windows);
			res.json({ windows: result });
		} catch (e) { next(e); }
	},
);

// ─── DELETE /:schoolId/:schoolYearId/grade-windows/:gradeLevel — delete window ───

router.delete(
	'/:schoolId/:schoolYearId/grade-windows/:gradeLevel',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const role = req.user?.role;
			if (!role || !PRIVILEGED_ROLES.has(role)) {
				res.status(403).json({ code: 'FORBIDDEN', message: 'Only admin, officer, or SYSTEM_ADMIN can delete grade windows.' });
				return;
			}

			const schoolId = positiveInt(req.params.schoolId, 'schoolId');
			if (typeof schoolId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolId }); return; }
			const schoolYearId = positiveInt(req.params.schoolYearId, 'schoolYearId');
			if (typeof schoolYearId === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: schoolYearId }); return; }
			const gradeLevel = positiveInt(req.params.gradeLevel, 'gradeLevel');
			if (typeof gradeLevel === 'string') { res.status(400).json({ code: 'INVALID_PARAM', message: gradeLevel }); return; }

			await windowService.deleteGradeWindow(schoolId, schoolYearId, gradeLevel);
			res.status(204).end();
		} catch (e) { next(e); }
	},
);

export default router;
